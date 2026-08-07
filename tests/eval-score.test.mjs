// tests/eval-score.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { scoreScenario, compare, verifyClauses, isPredicate } from '../evals/score.mjs'

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

// Measured, not imagined: three of three failures in the first real eval run
// were the checker rejecting these phrasings, and none was a predicted
// transcript. Widening admits only clauses that were always predicates.
test('exit status phrasings are predicates', () => {
  for (const c of ['exit 0', 'exits 0', 'exit code 1', 'exit status 0', 'exit status of `node --test test/` is 0']) {
    assert.equal(isPredicate(` ${c}`), true, c)
  }
})

test('widening exit status did not admit predicted output', () => {
  assert.equal(isPredicate(' exit status 0 with "fn is not defined"'), false)
  assert.equal(isPredicate(' exit status 0 and 214 lines'), false)
})

// A failure reason names the rule; the artefact shows the text that broke it.
// The session directory is deleted, so without this a disputed false positive
// can only ever be argued about.
test('a failing run keeps the artefact that failed', () => {
  const s = { id: 'p', expect: { verifyClauses: 'predicate' } }
  const bad = { 'docs/plans/a.md': '### Task 1: x → verify: fails with "boom"\n' }
  const r = scoreScenario(s, produced(bad, {}))
  assert.deepEqual(r.failedArtifacts, [bad])
})

test('passing runs and seeded fixtures are not stored', () => {
  const s = { id: 'p', expect: { verifyClauses: 'predicate' } }
  const seeded = { 'docs/specs/s.md': 'seed' }
  const files = { ...seeded, 'docs/plans/a.md': '### Task 1: x → verify: `npm test` exits 0\n' }
  assert.deepEqual(scoreScenario(s, produced(files, seeded)).failedArtifacts, [])
})

// Measured on an agent-written plan: a clause held a `node -e "..."` command
// whose quotes belong to the command, not to a predicted transcript. A code
// span is what you run; prose is what you claim.
test('quotes inside a code span belong to the command', () => {
  const clause = ' `node -e "const a=require(\'node:assert\');a.strictEqual(p.type,\'module\')"` exits 0'
  assert.equal(isPredicate(clause), true)
})

test('stripping spans did not stop quotes in prose being caught', () => {
  assert.equal(isPredicate(' `npm test` fails with "fn is not defined"'), false)
  assert.equal(isPredicate(' `wc -l` reports 214 lines'), false)
})

// A real agent-written plan used `## Task 1:` while the check matched only
// `###`, so it found no headers and passed vacuously. A check that cannot fail
// is not a check.
test('tasksHaveVerify matches the heading levels agents actually use', () => {
  const s = { id: 'p', expect: { tasksHaveVerify: true } }
  for (const h of ['##', '###', '####']) {
    const good = { 'docs/plans/a.md': `${h} Task 1: x → verify: \`npm test\` exits 0\n` }
    const bad = { 'docs/plans/a.md': `${h} Task 1: x\n` }
    assert.equal(scoreScenario(s, produced(good, {})).rate, 1, `${h} good`)
    assert.equal(scoreScenario(s, produced(bad, {})).rate, 0, `${h} bad`)
  }
})

// A real plan documented its own compliance — "one of the three permitted
// predicate forms" — and the word three was read as a stale count. Clauses
// live in task headers; anything else mentioning the marker is prose.
test('prose about the rule is not a clause', () => {
  const s = { id: 'p', expect: { verifyClauses: 'predicate' } }
  const doc = {
    'docs/plans/a.md':
      '### Task 1: thing → verify: `npm test` exit status 0\n\n' +
      '3. **Clauses.** The single `→ verify:` clause is one of the three permitted forms.\n',
  }
  assert.equal(scoreScenario(s, produced(doc, {})).rate, 1)
})

test('a bad clause in a task header is still caught', () => {
  const s = { id: 'p', expect: { verifyClauses: 'predicate' } }
  const doc = { 'docs/plans/a.md': '### Task 1: thing → verify: fails with "boom"\n' }
  assert.equal(scoreScenario(s, produced(doc, {})).rate, 0)
})

// `transcriptContains` needs an exact string, and an agent's phrasing varies.
// A rejection scenario has to match the shape of a refusal, not a fixed
// sentence, or it will fail for the wrong reason.
const spoke = text => [{ ok: true, skills: [], tools: [], dispatches: [], files: {}, seeded: {}, contains: n => text.includes(n), raw: text }]

test('transcriptMatches accepts a regex', () => {
  const s = { id: 'p', expect: { transcriptMatches: 'Task 3[^.]*no .verify' } }
  assert.equal(scoreScenario(s, spoke('Stopping: Task 3 has no →verify clause.')).rate, 1)
})

test('transcriptMatches fails when the transcript does not match', () => {
  const s = { id: 'p', expect: { transcriptMatches: 'Task 3[^.]*no .verify' } }
  assert.equal(scoreScenario(s, spoke('All tasks complete.')).rate, 0)
})

const dispatched = list => [{ ok: true, skills: [], tools: [], dispatches: list, files: {}, seeded: {}, contains: () => false, raw: '' }]
// promptLength is derived, never written by hand. A hand-counted length that
// disagrees with the prompt reads as truncation and makes the fixture
// unsatisfiable — which is exactly what happened on the first attempt at this
// task.
const call = (over = {}) => {
  const prompt = over.prompt ?? 'read docs/briefs/task-1.md'
  return { name: 'Task', index: 0, model: 'haiku', promptLength: prompt.length, ...over, prompt }
}

test('dispatchModelNamed requires every dispatch to name a model', () => {
  const s = { id: 'p', expect: { dispatchModelNamed: true } }
  assert.equal(scoreScenario(s, dispatched([call()])).rate, 1)
  assert.equal(scoreScenario(s, dispatched([call(), call({ model: null })])).rate, 0)
})

// Without this the expectation passes on a session that never dispatched at
// all, which is the vacuous-check failure this repo already shipped once.
test('dispatchModelNamed fails when nothing was dispatched', () => {
  const s = { id: 'p', expect: { dispatchModelNamed: true } }
  assert.equal(scoreScenario(s, dispatched([])).rate, 0)
})

test('dispatchPromptMatches and dispatchPromptOmits judge every dispatch', () => {
  const s = { id: 'p', expect: { dispatchPromptMatches: 'docs/briefs/', dispatchPromptOmits: '```' } }
  assert.equal(scoreScenario(s, dispatched([call()])).rate, 1)
  assert.equal(scoreScenario(s, dispatched([call({ prompt: 'here is the code:\n```js\nx\n```' })])).rate, 0)
})

// A capped prompt could pass an "omits" assertion on text that was cut off.
// promptLength is passed explicitly here to simulate truncation, which is the
// one place a hand-written length is correct.
test('a truncated prompt cannot satisfy dispatchPromptOmits', () => {
  const s = { id: 'p', expect: { dispatchPromptOmits: '```' } }
  const truncated = { ...call(), promptLength: 9999 }
  assert.equal(scoreScenario(s, dispatched([truncated])).rate, 0)
})

// A misspelled expectation key is silently ignored by a guard chain, so the
// scenario scores 1.00 while testing nothing. A check that cannot fail is not
// a check — and this one hides other checks that cannot fail.
test('an unknown expectation key is an error, not a silent pass', () => {
  const s = { id: 'p', expect: { transcriptMatchs: 'typo' } }
  assert.throws(() => scoreScenario(s, [ok()]), /unknown expectation/i)
})

test('every implemented key is accepted', () => {
  const s = {
    id: 'p',
    expect: {
      skill: 'vibekit:example-plain', before: [], after: [],
      transcriptContains: '', transcriptMatches: '',
      fileMatching: '.', onlyNewFilesMatching: '.',
      verifyClauses: 'predicate', tasksHaveVerify: true,
      dispatchModelNamed: false,
    },
  }
  assert.doesNotThrow(() => scoreScenario(s, [ok()]))
})

// raw is the whole stdout, tool results included, so a fixture can satisfy an
// assertion about itself. finalText is the last thing the agent said — a
// refusal shows there and a file it read does not.
const said = text => [{ ok: true, skills: [], tools: [], dispatches: [], files: {}, seeded: {}, contains: () => false, raw: 'irrelevant', finalText: text }]

test('finalTextMatches judges the final message, not the transcript', () => {
  const s = { id: 'p', expect: { finalTextMatches: 'Task 3' } }
  assert.equal(scoreScenario(s, said('Stopping: Task 3 carries no verify clause.')).rate, 1)
  assert.equal(scoreScenario(s, said('All three tasks are complete.')).rate, 0)
})

test('finalTextMatches is not satisfied by transcript contents', () => {
  const s = { id: 'p', expect: { finalTextMatches: 'Task 3' } }
  const run = [{ ok: true, skills: [], tools: [], dispatches: [], files: {}, seeded: {}, contains: () => true, raw: '### Task 3: shout function', finalText: 'Done.' }]
  assert.equal(scoreScenario(s, run).rate, 0)
})

test('finalTextOmits fails a run whose final message contains the pattern', () => {
  const s = { id: 'p', expect: { finalTextOmits: '\\bready\\b' } }
  assert.equal(scoreScenario(s, said('Verdict: ready')).rate, 0)
  assert.equal(scoreScenario(s, said('Cannot verify: no way to run the suite.')).rate, 1)
})

test('finalTextOmits reads the final message, not the transcript', () => {
  const s = { id: 'p', expect: { finalTextOmits: '\\bready\\b' } }
  const run = [{ ok: true, skills: [], tools: [], dispatches: [], files: {}, seeded: {}, contains: () => true, raw: 'the plan says ready', finalText: 'Blocked.' }]
  assert.equal(scoreScenario(s, run).rate, 1)
})
