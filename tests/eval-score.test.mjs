// tests/eval-score.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { scoreScenario, compare, verifyClauses } from '../evals/score.mjs'

const ok = (skills = [], tools = []) => ({ ok: true, skills, tools, usage: { cache_creation_input_tokens: 100, output_tokens: 10 }, cost: 0.01 })
const fired = () => ok([{ name: 'vibekit:example-plain', index: 0 }], [{ name: 'Skill', index: 0 }])
const errored = () => ({ ok: false, skills: [], tools: [], usage: null, cost: null })

const scenario = { id: 's', expect: { skill: 'vibekit:example-plain' } }

test('rate is fired over successful runs', () => {
  const r = scoreScenario(scenario, [fired(), fired(), ok()])
  assert.equal(r.successful, 3)
  assert.ok(Math.abs(r.rate - 2 / 3) < 1e-9)
})

test('errored runs are excluded from the denominator', () => {
  const r = scoreScenario(scenario, [fired(), errored(), errored()])
  assert.equal(r.successful, 1)
  assert.equal(r.errored, 2)
  assert.equal(r.rate, 1)
})

test('a scenario with no successful runs is incomplete, not a zero rate', () => {
  const r = scoreScenario(scenario, [errored(), errored()])
  assert.equal(r.incomplete, true)
  assert.equal(r.rate, null)
})

test('order expectation fails when the skill comes after a forbidden tool', () => {
  const late = ok(
    [{ name: 'vibekit:example-plain', index: 1 }],
    [{ name: 'Write', index: 0 }, { name: 'Skill', index: 1 }],
  )
  const s = { id: 's', expect: { skill: 'vibekit:example-plain', before: ['Write'] } }
  assert.equal(scoreScenario(s, [late]).rate, 0)
})

test('order expectation passes when the skill comes first', () => {
  const early = ok(
    [{ name: 'vibekit:example-plain', index: 0 }],
    [{ name: 'Skill', index: 0 }, { name: 'Write', index: 1 }],
  )
  const s = { id: 's', expect: { skill: 'vibekit:example-plain', before: ['Write'] } }
  assert.equal(scoreScenario(s, [early]).rate, 1)
})

test('a scenario with an empty expectation always satisfies', () => {
  const r = scoreScenario({ id: 'footprint', expect: {} }, [ok(), ok()])
  assert.equal(r.rate, 1)
})

test('averages token metrics across successful runs', () => {
  const r = scoreScenario(scenario, [fired(), fired()])
  assert.equal(r.inputFootprint, 100)
  assert.equal(r.outputTokens, 10)
})

test('compare fails a candidate below the absolute floor', () => {
  const thresholds = { defaults: { minFiringRate: 0.8, maxRateRegression: 0.2 }, scenarios: {} }
  const out = compare({ s: { rate: 0.5 } }, null, thresholds)
  assert.equal(out.pass, false)
  assert.match(out.failures[0], /below floor/)
})

test('compare fails a candidate that regressed against baseline beyond tolerance', () => {
  const thresholds = { defaults: { minFiringRate: 0, maxRateRegression: 0.2 }, scenarios: {} }
  const out = compare({ s: { rate: 0.5 } }, { s: { rate: 1 } }, thresholds)
  assert.equal(out.pass, false)
  assert.match(out.failures[0], /regressed/)
})

const judged = (followed, score) => ({
  ...fired(),
  judge: { followed, score, why: 'because' },
})

test('summarises judge verdicts so a paid grading is not discarded', () => {
  const r = scoreScenario(scenario, [judged(true, 5), judged(false, 1)])
  assert.equal(r.judge.graded, 2)
  assert.equal(r.judge.followedRate, 0.5)
  assert.equal(r.judge.meanScore, 3)
  assert.equal(r.judge.errors, 0)
})

test('judge is null when no run was judged', () => {
  assert.equal(scoreScenario(scenario, [fired(), fired()]).judge, null)
})

test('judge errors are counted, not averaged into the score', () => {
  const broken = { ...fired(), judge: { judge_error: true, followed: null, score: null } }
  const r = scoreScenario(scenario, [judged(true, 4), broken])
  assert.equal(r.judge.graded, 1)
  assert.equal(r.judge.meanScore, 4)
  assert.equal(r.judge.errors, 1)
})

// W3: `expect: {skill: "vibekit:lazy"}` alone passes whether lazy was delegated
// to or fired on its own trigger. `after` is what makes a delegation scenario
// measure delegation.
const chain = { id: 's', expect: { skill: 'vibekit:lazy', after: ['vibekit:brainstorm'] } }

test('after expectation passes when the prerequisite skill fired first', () => {
  const run = ok(
    [{ name: 'vibekit:brainstorm', index: 0 }, { name: 'vibekit:lazy', index: 1 }],
    [{ name: 'Skill', index: 0 }, { name: 'Skill', index: 1 }],
  )
  assert.equal(scoreScenario(chain, [run]).rate, 1)
})

test('after expectation fails when the skill fired without its prerequisite', () => {
  const run = ok([{ name: 'vibekit:lazy', index: 0 }], [{ name: 'Skill', index: 0 }])
  assert.equal(scoreScenario(chain, [run]).rate, 0)
})

test('after expectation fails when the prerequisite fired later', () => {
  const run = ok(
    [{ name: 'vibekit:lazy', index: 0 }, { name: 'vibekit:brainstorm', index: 1 }],
    [{ name: 'Skill', index: 0 }, { name: 'Skill', index: 1 }],
  )
  assert.equal(scoreScenario(chain, [run]).rate, 0)
})

const produced = (files, seeded = {}) => [{ ok: true, skills: [], tools: [], files, seeded }]

test('fileMatching requires at least one produced file on the path', () => {
  const scenario = { id: 'p', expect: { fileMatching: '^docs/plans/.*\\.md$' } }
  assert.equal(scoreScenario(scenario, produced({ 'docs/plans/a.md': 'x' })).rate, 1)
  assert.equal(scoreScenario(scenario, produced({ 'notes.md': 'x' })).rate, 0)
})

test('onlyNewFilesMatching fails on a new file outside the allowed path', () => {
  const scenario = { id: 'p', expect: { onlyNewFilesMatching: '^docs/plans/' } }
  const seeded = { 'docs/specs/s.md': 'seed' }
  const okFiles = { 'docs/specs/s.md': 'seed', 'docs/plans/a.md': 'x' }
  const badFiles = { 'docs/specs/s.md': 'seed', 'src/index.js': 'x' }
  assert.equal(scoreScenario(scenario, produced(okFiles, seeded)).rate, 1)
  assert.equal(scoreScenario(scenario, produced(badFiles, seeded)).rate, 0)
})

test('onlyNewFilesMatching fails when a seeded file was modified', () => {
  const scenario = { id: 'p', expect: { onlyNewFilesMatching: '^docs/plans/' } }
  const seeded = { 'docs/specs/s.md': 'seed' }
  const edited = { 'docs/specs/s.md': 'seed, edited' }
  assert.equal(scoreScenario(scenario, produced(edited, seeded)).rate, 0)
})

const planWith = clause => ({ 'docs/plans/a.md': `### Task 1: thing → verify: ${clause}\n\nbody\n` })
const scenario4 = { id: 'p', expect: { verifyClauses: 'predicate' } }
const rateOf = files => scoreScenario(scenario4, produced(files, {})).rate

test('predicate clauses pass', () => {
  assert.equal(rateOf(planWith('npm test exits 0')), 1)
  assert.equal(rateOf(planWith('the file exists')), 1)
  assert.equal(rateOf(planWith('grep finds at least 1 match')), 1)
  assert.equal(rateOf(planWith('the endpoint returns 200')), 1)
  assert.equal(rateOf(planWith('the file is under 120 lines')), 1)
})

test('a quoted string in a clause is a predicted transcript', () => {
  assert.equal(rateOf(planWith('test fails with "fn is not defined"')), 0)
  assert.equal(rateOf(planWith("test fails with 'fn is not defined'")), 0)
})

// Every clause in this repo's own plans names its command in a code span.
// Rejecting backticks would flag all of them and measure nothing.
test('a backticked command is not a quoted string', () => {
  assert.equal(rateOf(planWith('`npm test` exits 0')), 1)
})

test('a bare number is a predicted value, even a three-digit one', () => {
  assert.equal(rateOf(planWith('the file is 214 lines long')), 0)
  assert.equal(rateOf(planWith('the file is 42 lines long')), 0)
})

// Added after Task 3: this plan's own Task 3 clause said "the four new
// path-set cases" when there were three. A digits-only check passes that
// straight through, so the defect the design exists to catch escaped its own
// falsification test on the first artefact written under it.
test('a spelled-out number is a predicted value too', () => {
  assert.equal(rateOf(planWith('the four new path-set cases pass')), 0)
  assert.equal(rateOf(planWith('two files are created')), 0)
})

test('a spelled-out threshold is still a predicate', () => {
  assert.equal(rateOf(planWith('grep finds at least one match')), 1)
  assert.equal(rateOf(planWith('no more than two files change')), 1)
})

test('clauses in seeded files are not scored', () => {
  const seeded = { 'docs/specs/s.md': '### Task 1: x → verify: "quoted"\n' }
  assert.equal(scoreScenario(scenario4, produced({ ...seeded }, seeded)).rate, 1)
})

test('tasksHaveVerify fails a task header with no clause', () => {
  const s = { id: 'p', expect: { tasksHaveVerify: true } }
  const good = { 'docs/plans/a.md': '### Task 1: thing → verify: npm test exits 0\n' }
  const bad = { 'docs/plans/a.md': '### Task 1: thing\n' }
  assert.equal(scoreScenario(s, produced(good, {})).rate, 1)
  assert.equal(scoreScenario(s, produced(bad, {})).rate, 0)
})

test('a clause inside a fenced block is documentation, not a clause', () => {
  const doc = '### Task 1: real → verify: `npm test` exits 0\n\n```\n### Task 9: fake → verify: fails with "boom"\n```\n'
  assert.deepEqual(verifyClauses(doc).length, 1)
})

// A bare rate says one run in five broke a rule without saying which. The
// reason is the whole question when the rule itself is under test.
test('a sub-1.00 rate names the expectation that failed', () => {
  const s = { id: 'p', expect: { verifyClauses: 'predicate' } }
  const bad = { 'docs/plans/a.md': '### Task 1: x → verify: fails with "boom"\n' }
  const result = scoreScenario(s, [...produced(bad, {}), ...produced(planWith('`npm test` exits 0'), {})])
  assert.equal(result.rate, 0.5)
  assert.deepEqual(result.failures, ['non-predicate clause in docs/plans/a.md: fails with "boom"'])
})

test('a satisfied scenario reports no failures', () => {
  const s = { id: 'p', expect: { verifyClauses: 'predicate' } }
  assert.deepEqual(scoreScenario(s, produced(planWith('`npm test` exits 0'), {})).failures, [])
})
