// tests/claude-code.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { id, emit, regions } from '../runtimes/claude-code.mjs'
import { MODEL } from './helpers.mjs'

test('emits the plugin manifest stamped with the config version', () => {
  const plugin = JSON.parse(emit(MODEL)['.claude-plugin/plugin.json'])
  assert.equal(plugin.name, 'vibekit')
  assert.equal(plugin.version, '2.0.0')
  assert.equal(plugin.license, 'MIT')
})

test('emits a marketplace manifest whose version matches the plugin manifest', () => {
  const files = emit(MODEL)
  const plugin = JSON.parse(files['.claude-plugin/plugin.json'])
  const market = JSON.parse(files['.claude-plugin/marketplace.json'])
  assert.equal(market.plugins.length, 1)
  assert.equal(market.plugins[0].version, plugin.version)
  assert.equal(market.plugins[0].source, './')
})

test('emits a SessionStart hook that runs through the polyglot wrapper', () => {
  const hooks = JSON.parse(emit(MODEL)['hooks/hooks.json'])
  const entry = hooks.hooks.SessionStart[0]
  assert.equal(entry.matcher, 'startup|clear|compact')
  assert.match(entry.hooks[0].command, /run-hook\.cmd" session-start$/)
  assert.equal(entry.hooks[0].async, false)
})

test('emits one markdown command per command-enabled skill and no others', () => {
  const files = emit(MODEL)
  assert.ok('commands/alpha.md' in files)
  assert.ok(!('commands/beta.md' in files))
})

test('the command file carries the skill description as frontmatter', () => {
  const command = emit(MODEL)['commands/alpha.md']
  assert.ok(command.startsWith('---\n'))
  assert.ok(command.includes('description: Alpha does A.'))
  assert.ok(command.includes('$ARGUMENTS'))
})

test('owns the CLAUDE.md trigger-table region', () => {
  assert.deepEqual(Object.keys(regions(MODEL)), ['CLAUDE.md'])
  assert.ok(regions(MODEL)['CLAUDE.md']['trigger-table'].includes('| `alpha` | hard |'))
})

test('is identified as claude-code', () => {
  assert.equal(id, 'claude-code')
})
