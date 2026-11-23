// tests/antigravity.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { id, emit, ships, regions } from '../runtimes/antigravity.mjs'
import { MODEL } from './helpers.mjs'
import { startSkills } from '../lib/start.mjs'

test('is identified as antigravity', () => {
  assert.equal(id, 'antigravity')
})

test('emits a plugin manifest matching the config', () => {
  const manifest = JSON.parse(emit(MODEL)['plugin.json'])
  assert.equal(manifest.name, 'vibekit')
  assert.equal(manifest.version, '0.6.0')
})

test('claims the rules file as a generated region', () => {
  assert.ok('trigger-table' in regions(MODEL)['rules/AGENTS.md'])
})

test('ships the manifest, the hooks file and the rules file', () => {
  const paths = ships(MODEL)
  assert.ok(paths.includes('plugin.json'))
  assert.ok(paths.includes('hooks.json'))
  assert.ok(paths.includes('rules/AGENTS.md'))
})

test('emits one SessionStart hook per start skill that cmd.exe and sh both run, and no edit guard', () => {
  const hooks = JSON.parse(emit(MODEL)['hooks.json']).vibekit
  assert.deepEqual(
    hooks.SessionStart.map(entry => entry.command),
    startSkills(MODEL).map(name => `hooks\\run-hook.cmd session-start antigravity ${name} || ./hooks/run-hook.cmd session-start antigravity ${name}`),
  )
  assert.equal(hooks.PreToolUse, undefined)
})

test('a new skill whose description ends Stays on after. gets its own start hook', () => {
  const zeta = { name: 'zeta', description: 'Zeta. Stays on after.', trigger: 't', command: false, gate: 'none', dir: 'zeta' }
  const hooks = JSON.parse(emit({ ...MODEL, skills: [...MODEL.skills, zeta] })['hooks.json']).vibekit.SessionStart
  assert.ok(hooks.some(entry => entry.command.endsWith(' session-start antigravity zeta')))
})
