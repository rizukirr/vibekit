// tests/eval-score.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { scoreScenario, compare } from '../evals/score.mjs'

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
