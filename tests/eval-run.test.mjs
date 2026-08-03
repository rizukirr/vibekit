// tests/eval-run.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseArgs, planRuns, formatPlan } from '../evals/run.mjs'

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
