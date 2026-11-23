// tests/pi.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { id, emit, pkg, ships } from '../runtimes/pi.mjs'
import { MODEL, skillFile } from './helpers.mjs'

const started = {
  ...MODEL,
  config: { ...MODEL.config, bootstrap: 'alpha' },
  skills: [...MODEL.skills, { name: 'lazy', description: 'Lazy. Stays on after.', trigger: 'always', command: false, gate: 'none', dir: 'lazy' }],
}

// The extension finds its skills at ../skills relative to itself, so it is
// imported from a throwaway tree shaped like the shipped package, then handed
// a stand-in for pi that keeps each registered handler.
async function load(t, missing = []) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'vibekit-pi-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  writeFileSync(join(root, 'package.json'), '{"type":"module"}')
  for (const { name } of started.skills) {
    if (missing.includes(name)) continue
    mkdirSync(join(root, 'skills', name), { recursive: true })
    writeFileSync(join(root, 'skills', name, 'SKILL.md'), skillFile({ name }))
  }
  mkdirSync(join(root, '.pi'))
  const file = join(root, '.pi/vibekit.js')
  writeFileSync(file, emit(started)['.pi/vibekit.js'])
  const handlers = {}
  ;(await import(pathToFileURL(file).href)).default({ on: (name, fn) => { handlers[name] = fn } })
  return handlers
}

test('is identified as pi', () => {
  assert.equal(id, 'pi')
})

test('contributes skills and the extension, and ships the extension folder', () => {
  assert.deepEqual(pkg(MODEL).pi, { skills: ['./skills'], extensions: ['./.pi/vibekit.js'] })
  assert.ok('.pi/vibekit.js' in emit(MODEL))
  assert.deepEqual(ships(MODEL), ['.pi/'])
})

test('appends every start skill to the system prompt, saying vibekit is present once', async t => {
  const handlers = await load(t)
  const { systemPrompt } = await handlers.before_agent_start({ prompt: 'hi', systemPrompt: 'base' })
  assert.match(systemPrompt, /^base\n\n<EXTREMELY_IMPORTANT>\nYou have vibekit\.\n/)
  assert.match(systemPrompt, /full content of the alpha skill/)
  assert.match(systemPrompt, /full content of the lazy skill/)
  assert.equal(systemPrompt.split('You have vibekit').length, 2)
})

test('skips a start skill whose file is missing and keeps the rest', async t => {
  const handlers = await load(t, ['lazy'])
  const { systemPrompt } = await handlers.before_agent_start({ prompt: 'hi', systemPrompt: 'base' })
  assert.match(systemPrompt, /full content of the alpha skill/)
  assert.doesNotMatch(systemPrompt, /full content of the lazy skill/)
})

test('registers no tool_call guard', async t => {
  assert.deepEqual(Object.keys(await load(t)), ['before_agent_start'])
})
