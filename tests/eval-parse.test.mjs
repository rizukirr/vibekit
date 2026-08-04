// tests/eval-parse.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseTranscript } from '../evals/parse.mjs'

const fixture = name => readFileSync(`evals/fixtures/${name}.jsonl`, 'utf8')

test('extracts a Skill invocation with its position', () => {
  const t = parseTranscript(fixture('skill-fired'))
  assert.equal(t.ok, true)
  assert.deepEqual(t.skills, [{ name: 'vibekit:example-plain', index: 0 }])
})

test('reports no skills when none were invoked', () => {
  const t = parseTranscript(fixture('no-skill'))
  assert.equal(t.ok, true)
  assert.deepEqual(t.skills, [])
})

test('a rate_limit_event does not make a successful run unsuccessful', () => {
  assert.equal(parseTranscript(fixture('no-skill')).ok, true)
})

test('an errored result is not ok', () => {
  const t = parseTranscript(fixture('errored'))
  assert.equal(t.ok, false)
  assert.equal(t.subtype, 'error_during_execution')
})

test('records tool uses in order so ordering can be checked', () => {
  const t = parseTranscript(fixture('late-skill'))
  const write = t.tools.find(u => u.name === 'Write')
  const skill = t.tools.find(u => u.name === 'Skill')
  assert.ok(write.index < skill.index, 'fixture must have Write before Skill')
})

test('extracts usage and cost', () => {
  const t = parseTranscript(fixture('skill-fired'))
  assert.equal(t.usage.cache_creation_input_tokens, 12892)
  assert.equal(t.usage.output_tokens, 283)
  assert.equal(t.cost, 0.0239948)
})

test('exposes the skills the session discovered', () => {
  const t = parseTranscript(fixture('skill-fired'))
  assert.ok(t.initSkills.includes('vibekit:example-plain'))
})

test('an unparseable transcript is an error, never a silent non-firing run', () => {
  const t = parseTranscript('not json at all\n')
  assert.equal(t.ok, false)
  assert.match(t.error, /no result event/)
})
