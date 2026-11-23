// tests/claude-code.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { id, emit, regions } from '../runtimes/claude-code.mjs'
import { MODEL } from './helpers.mjs'
import { readFileSync } from 'node:fs'
import { buildModel } from '../lib/model.mjs'
import { startSkills } from '../lib/start.mjs'

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

test('emits one SessionStart hook per start skill, each through the polyglot wrapper', () => {
  const model = buildModel(JSON.parse(readFileSync('vibekit.config.json', 'utf8')), 'skills')
  const entry = JSON.parse(emit(model)['hooks/hooks.json']).hooks.SessionStart[0]
  assert.equal(entry.matcher, 'startup|clear|compact')
  assert.deepEqual(entry.hooks.map(hook => hook.command.split(' session-start ')[1]), startSkills(model))
  for (const hook of entry.hooks) {
    assert.match(hook.command, /^"\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/run-hook\.cmd" session-start [a-z-]+$/)
    assert.match(hook.commandWindows, /^& "\$env:PLUGIN_ROOT\/hooks\/run-hook\.cmd" session-start [a-z-]+$/)
    assert.equal(hook.shell, 'bash')
    assert.equal(hook.async, false)
  }
})

test('emits no PreToolUse hook', () => {
  assert.equal(JSON.parse(emit(MODEL)['hooks/hooks.json']).hooks.PreToolUse, undefined)
})

test('a new skill whose description ends Stays on after. gets its own start hook', () => {
  const zeta = { name: 'zeta', description: 'Zeta. Stays on after.', trigger: 't', command: false, gate: 'none', dir: 'zeta' }
  const hooks = JSON.parse(emit({ ...MODEL, skills: [...MODEL.skills, zeta] })['hooks/hooks.json']).hooks.SessionStart[0].hooks
  assert.ok(hooks.some(hook => hook.command.endsWith(' session-start zeta')))
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
