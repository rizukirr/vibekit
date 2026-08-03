// tests/codex.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { id, emit, regions } from '../runtimes/codex.mjs'
import { MODEL } from './helpers.mjs'

test('is identified as codex', () => {
  assert.equal(id, 'codex')
})

test('emits a plugin manifest pointing at the shared skills directory', () => {
  const plugin = JSON.parse(emit(MODEL)['.codex-plugin/plugin.json'])
  assert.equal(plugin.version, '2.0.0')
  assert.equal(plugin.skills, './skills/')
  assert.equal(plugin.hooks, './hooks/hooks.json')
})

test('emits one toml command per command-enabled skill and no others', () => {
  const files = emit(MODEL)
  assert.ok('commands/alpha.toml' in files)
  assert.ok(!('commands/beta.toml' in files))
})

test('the toml command carries a description and a prompt block', () => {
  const toml = emit(MODEL)['commands/alpha.toml']
  assert.ok(toml.includes('description = "Alpha does A."'))
  assert.ok(toml.includes('prompt = """'))
  assert.ok(toml.includes('{{args}}'))
})

test('emits no path that the claude-code emitter also emits', () => {
  const codexPaths = Object.keys(emit(MODEL))
  assert.ok(!codexPaths.includes('commands/alpha.md'))
  assert.ok(!codexPaths.includes('hooks/hooks.json'))
})

test('owns the AGENTS.md trigger-table region', () => {
  assert.deepEqual(Object.keys(regions(MODEL)), ['AGENTS.md'])
  assert.ok(regions(MODEL)['AGENTS.md']['trigger-table'].includes('| `beta` | none |'))
})
