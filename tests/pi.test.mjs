// tests/pi.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { id, emit, pkg, ships } from '../runtimes/pi.mjs'
import { denyReason } from '../lib/gate.mjs'
import { MODEL, skillFile } from './helpers.mjs'

const guarded = {
  ...MODEL,
  skills: [
    ...MODEL.skills,
    { name: 'lazy', description: 'Lazy. Stays on after.', trigger: 'always', command: false, gate: 'none', dir: 'lazy' },
    { name: 'using-vibekit', description: 'Boot.', trigger: 'start', command: false, gate: 'none', dir: 'using-vibekit' },
  ],
}

// The extension finds its skills at ../skills relative to itself, so it is
// imported from a throwaway tree shaped like the shipped package, then handed
// a stand-in for pi that keeps each registered handler.
async function load(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'vibekit-pi-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  writeFileSync(join(root, 'package.json'), '{"type":"module"}')
  for (const { name } of guarded.skills) {
    mkdirSync(join(root, 'skills', name), { recursive: true })
    writeFileSync(join(root, 'skills', name, 'SKILL.md'), skillFile({ name }))
  }
  mkdirSync(join(root, '.pi'))
  const file = join(root, '.pi/vibekit.js')
  writeFileSync(file, emit(guarded)['.pi/vibekit.js'])
  const handlers = {}
  ;(await import(pathToFileURL(file).href)).default({ on: (name, fn) => { handlers[name] = fn } })
  return { root, handlers }
}

const session = sessionID => ({ sessionManager: { getSessionId: () => sessionID } })
const call = (handlers, toolName, input, sessionID = 's1') => handlers.tool_call({ toolName, input }, session(sessionID))

test('is identified as pi', () => {
  assert.equal(id, 'pi')
})

test('contributes skills and the extension, and ships the extension folder', () => {
  assert.deepEqual(pkg(MODEL).pi, { skills: ['./skills'], extensions: ['./.pi/vibekit.js'] })
  assert.ok('.pi/vibekit.js' in emit(MODEL))
  assert.deepEqual(ships(MODEL), ['.pi/'])
})

test('blocks a write until a pipeline skill and every modifier are read', async t => {
  const { root, handlers } = await load(t)
  assert.deepEqual(await call(handlers, 'write', { path: 'x.txt' }), { block: true, reason: denyReason(['quick', 'lazy']) })
  await call(handlers, 'read', { path: join(root, 'skills/alpha/SKILL.md') })
  await call(handlers, 'read', { path: join(root, 'skills/lazy/SKILL.md'), offset: 1 })
  assert.equal(await call(handlers, 'edit', { path: 'x.txt' }), undefined)
  assert.equal((await call(handlers, 'write', { path: 'x.txt' }, 's2')).block, true)
})

test('counts a skill typed as /skill:name in the prompt', async t => {
  const { handlers } = await load(t)
  await handlers.before_agent_start({ prompt: '<skill name="alpha" location="x">a</skill><skill name="lazy" location="y">b</skill>', systemPrompt: 'base' }, session('s1'))
  assert.equal(await call(handlers, 'write', { path: 'x.txt' }), undefined)
})

test('appends the bootstrap skill to the system prompt', async t => {
  const { handlers } = await load(t)
  const result = await handlers.before_agent_start({ prompt: 'hi', systemPrompt: 'base' }, session('s1'))
  assert.match(result.systemPrompt, /^base\n\n<EXTREMELY_IMPORTANT>/)
  assert.match(result.systemPrompt, /using-vibekit/)
})

test('lets every call through when VIBEKIT_GATE is off or a handler fails', async t => {
  const { handlers } = await load(t)
  process.env.VIBEKIT_GATE = 'off'
  t.after(() => { delete process.env.VIBEKIT_GATE })
  assert.equal(await call(handlers, 'write', { path: 'x.txt' }), undefined)
  delete process.env.VIBEKIT_GATE
  assert.equal(await handlers.tool_call({ toolName: 'write', input: {} }, {}), undefined)
})
