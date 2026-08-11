// tests/eval-run.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseArgs, planRuns, formatPlan, estimateCost, validatePlan, extractJson } from '../evals/run.mjs'

const scenarios = [
  { id: 'a', prompt: 'x', n: 3, model: 'haiku' },
  { id: 'b', prompt: 'y', n: 3, model: 'haiku' },
  { id: 'c', prompt: 'z', n: 3, model: 'haiku' },
]

test('parses refs, flags and scenario filter', () => {
  const o = parseArgs(['--baseline', 'main', '--candidate', 'HEAD', '--judge', '--dry-run', '--scenarios', 'a,b', '-n', '2'])
  assert.equal(o.baseline, 'main')
  assert.equal(o.candidate, 'HEAD')
  assert.equal(o.judge, true)
  assert.equal(o.dryRun, true)
  assert.deepEqual(o.scenarios, ['a', 'b'])
  assert.equal(o.n, 2)
})

test('candidate defaults to HEAD and baseline to null', () => {
  const o = parseArgs([])
  assert.equal(o.candidate, 'HEAD')
  assert.equal(o.baseline, null)
})

test('plans one run per scenario per repeat per variant', () => {
  const runs = planRuns(scenarios, { candidate: 'HEAD', baseline: null, scenarios: null, n: null })
  assert.equal(runs.length, 9) // 3 scenarios x 3 repeats x 1 variant
  const withBaseline = planRuns(scenarios, { candidate: 'HEAD', baseline: 'main', scenarios: null, n: null })
  assert.equal(withBaseline.length, 18)
})

test('the printed plan names the session count so an empty plan is visible', () => {
  const runs = planRuns(scenarios, { candidate: 'HEAD', baseline: null, scenarios: null, n: null })
  assert.match(formatPlan(runs, { candidate: 'HEAD', baseline: null }), /9 sessions/)
})

test('estimates a cost range from the planned sessions', () => {
  const runs = planRuns(scenarios, { candidate: 'HEAD', baseline: null, scenarios: null, n: null })
  const est = estimateCost(runs, { judge: false })
  assert.equal(est.sessions, 9)
  assert.ok(est.low > 0 && est.high > est.low, 'range must be positive and ordered')
})

test('judging raises the estimate because it doubles the calls', () => {
  const runs = planRuns(scenarios, { candidate: 'HEAD', baseline: null, scenarios: null, n: null })
  assert.ok(estimateCost(runs, { judge: true }).high > estimateCost(runs, { judge: false }).high)
})

test('the printed plan carries the estimate so a dry run shows the bill', () => {
  const runs = planRuns(scenarios, { candidate: 'HEAD', baseline: null, scenarios: null, n: null })
  assert.match(formatPlan(runs, { candidate: 'HEAD', baseline: null }), /est\. \$/)
})

test('rejects a non-integer -n instead of planning zero runs', () => {
  assert.throws(() => parseArgs(['-n', 'abc']), /-n must be an integer/)
})

test('rejects a flag whose value is another flag', () => {
  assert.throws(() => parseArgs(['--scenarios', '--judge']), /--scenarios requires a value/)
})

test('rejects an unknown scenario id', () => {
  const opts = { scenarios: ['nosuchscenario'] }
  assert.throws(
    () => validatePlan([{}], scenarios, opts, { scenarios: {} }),
    /unknown scenario id\(s\): nosuchscenario/,
  )
})

test('rejects a thresholds key naming a scenario that does not exist', () => {
  assert.throws(
    () => validatePlan([{}], scenarios, { scenarios: null }, { scenarios: { ghost: {} } }),
    /thresholds.json names unknown scenario\(s\): ghost/,
  )
})

// B1: the harness exists to measure. Reporting PASS having measured nothing is
// worse than crashing, because it looks like success and gets committed.
test('refuses to score a plan with zero sessions', () => {
  assert.throws(
    () => validatePlan([], scenarios, { scenarios: null }, { scenarios: {} }),
    /no sessions planned/,
  )
})

// The rubric forbids code fences; the judge model used one anyway on 4 of 5
// calls. A grader that discards four fifths of its own output is not a grader.
test('extracts fenced judge JSON', () => {
  const out = extractJson('```json\n{"followed": true, "score": 5}\n```')
  assert.deepEqual(JSON.parse(out), { followed: true, score: 5 })
})

test('extracts judge JSON wrapped in prose', () => {
  const out = extractJson('Here is my grade:\n{"followed": false, "score": 1}\nHope that helps.')
  assert.deepEqual(JSON.parse(out), { followed: false, score: 1 })
})

test('leaves output with no braces untouched so the caller still fails', () => {
  assert.equal(extractJson('I could not grade this'), 'I could not grade this')
  assert.equal(extractJson(null), '')
})
