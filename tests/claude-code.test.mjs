// tests/claude-code.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { id, emit, regions } from '../runtimes/claude-code.mjs'
import { MODEL } from './helpers.mjs'
import { readFileSync } from 'node:fs'
import { buildModel } from '../lib/model.mjs'

test('emits the plugin manifest stamped with the config version', () => {
  const plugin = JSON.parse(emit(MODEL)['.claude-plugin/plugin.json'])
  assert.equal(plugin.name, 'vibekit')
  assert.equal(plugin.version, '0.6.0')
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

test('emits a PreToolUse edit gate listing every hard-gate or command skill on disk', () => {
  const model = buildModel(JSON.parse(readFileSync('vibekit.config.json', 'utf8')), 'skills')
  const entry = JSON.parse(emit(model)['hooks/hooks.json']).hooks.PreToolUse[0]
  const list = entry.hooks[0].command.split(' edit-gate ')[1].split(',')
  assert.equal(entry.matcher, 'Write|Edit|NotebookEdit')
  assert.match(entry.hooks[0].command, /run-hook\.cmd" edit-gate /)
  for (const skill of model.skills) {
    assert.equal(list.includes(skill.name), skill.gate === 'hard' || skill.command, skill.name)
  }
  assert.deepEqual(list, [...list].sort())
})

test('emits no markdown command, because a plugin command hides the skill of the same name', () => {
  assert.ok(MODEL.skills.some(s => s.command))
  const files = emit(MODEL)
  assert.deepEqual(Object.keys(files).filter(p => /^commands\/.*\.md$/.test(p)), [])
})

test('owns the CLAUDE.md trigger-table region', () => {
  assert.deepEqual(Object.keys(regions(MODEL)), ['CLAUDE.md'])
  assert.ok(regions(MODEL)['CLAUDE.md']['trigger-table'].includes('| `alpha` | hard |'))
})

test('is identified as claude-code', () => {
  assert.equal(id, 'claude-code')
})
