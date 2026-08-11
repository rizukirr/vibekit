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

// A session that fires a skill and writes nothing is either stalling or
// correctly stopping to ask. The last thing it said is the only evidence.
test('captures the final assistant text', () => {
  const jsonl = [
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'first' }] } }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Which retention count do you want?' }] } }),
    JSON.stringify({ type: 'result', subtype: 'success', is_error: false }),
  ].join('\n')
  assert.equal(parseTranscript(jsonl).finalText, 'Which retention count do you want?')
})

// A dispatch is the unit exec is judged on. Tool names alone cannot say which
// model was chosen or whether the prompt handed over a path or pasted text.
const dispatchLine = (name, input) =>
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } })
const resultLine = JSON.stringify({ type: 'result', subtype: 'success', is_error: false })

test('captures dispatch calls with model and prompt', () => {
  const jsonl = [
    dispatchLine('Task', { model: 'haiku', prompt: 'read docs/briefs/task-1.md' }),
    resultLine,
  ].join('\n')
  const parsed = parseTranscript(jsonl)
  assert.equal(parsed.dispatches.length, 1)
  assert.equal(parsed.dispatches[0].model, 'haiku')
  assert.equal(parsed.dispatches[0].prompt, 'read docs/briefs/task-1.md')
})

test('records a dispatch with no model as null, not missing', () => {
  const jsonl = [dispatchLine('Agent', { prompt: 'do the thing' }), resultLine].join('\n')
  assert.equal(parseTranscript(jsonl).dispatches[0].model, null)
})

test('a transcript with no dispatch has an empty list, not undefined', () => {
  const jsonl = [dispatchLine('Read', { file_path: '/x' }), resultLine].join('\n')
  assert.deepEqual(parseTranscript(jsonl).dispatches, [])
})

test('caps a stored prompt and records the original length', () => {
  const long = 'x'.repeat(5000)
  const jsonl = [dispatchLine('Task', { prompt: long }), resultLine].join('\n')
  const d = parseTranscript(jsonl).dispatches[0]
  assert.equal(d.prompt.length, 4000)
  assert.equal(d.promptLength, 5000)
})
