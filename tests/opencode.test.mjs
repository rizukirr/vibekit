// tests/opencode.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { id, emit, pkg, ships } from '../runtimes/opencode.mjs'
import { MODEL, skillFile } from './helpers.mjs'

// The plugin finds its skills at ../../skills relative to itself, so it is
// imported from a throwaway tree shaped like the shipped package.
async function load(model, t, missing = [], eol = '\n') {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'vibekit-opencode-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  writeFileSync(join(root, 'package.json'), '{"type":"module"}')
  for (const { name } of model.skills) {
    if (missing.includes(name)) continue
    mkdirSync(join(root, 'skills', name), { recursive: true })
    writeFileSync(join(root, 'skills', name, 'SKILL.md'), skillFile({ name }).replace(/\n/g, eol))
  }
  const file = join(root, '.opencode/plugins/vibekit.js')
  mkdirSync(join(root, '.opencode/plugins'), { recursive: true })
  writeFileSync(file, emit(model)['.opencode/plugins/vibekit.js'])
  return { root, plugin: (await import(pathToFileURL(file).href)).default }
}

// Stands in for the context opencode passes to setup, recording every skill
// the plugin adds.
async function added(plugin) {
  const calls = []
  await plugin.setup({ skill: { transform: async fn => fn({ add: skill => calls.push(skill) }) } })
  return calls
}

test('is identified as opencode', () => {
  assert.equal(id, 'opencode')
})

test('emits a plugin entry point and its install document', () => {
  const files = emit(MODEL)
  assert.ok('.opencode/plugins/vibekit.js' in files)
  assert.ok('.opencode/INSTALL.md' in files)
})

// opencode resolves a git-installed plugin through package.json main. v1
// shipped the plugin file with no main key, so nothing ever loaded it.
test('contributes the main key that makes the plugin reachable', () => {
  assert.equal(pkg(MODEL).main, './.opencode/plugins/vibekit.js')
})

test('default-exports a v2 plugin definition', async t => {
  const { plugin } = await load(MODEL, t)
  assert.equal(plugin.id, 'vibekit')
  assert.equal(typeof plugin.setup, 'function')
})

test('registers every skill with its description and its content', async t => {
  const { root, plugin } = await load(MODEL, t)
  const calls = await added(plugin)
  assert.deepEqual(calls.map(call => call.id), MODEL.skills.map(skill => skill.name))
  for (const [index, skill] of MODEL.skills.entries()) {
    assert.equal(calls[index].name, skill.name)
    assert.equal(calls[index].description, skill.description)
    assert.equal(calls[index].path, join(root, 'skills', skill.name, 'SKILL.md'))
    assert.equal(calls[index].content, '\nbody\n')
  }
})

// Git for Windows checks files out with CRLF by default.
test('strips the frontmatter from skill files with CRLF line endings', async t => {
  const { plugin } = await load(MODEL, t, [], '\r\n')
  const calls = await added(plugin)
  assert.equal(calls.length, MODEL.skills.length)
  assert.equal(calls.filter(call => call.content.startsWith('---')).length, 0)
  assert.equal(calls[0].content, '\r\nbody\r\n')
})

test('carries a description with quotes and a backslash unchanged', async t => {
  const description = `says "hi", it's a \\ path`
  const model = { ...MODEL, skills: [{ ...MODEL.skills[0], description }] }
  const { plugin } = await load(model, t)
  assert.equal((await added(plugin))[0].description, description)
})

test('fails loudly when a skill file is missing', async t => {
  const { root, plugin } = await load(MODEL, t, ['beta'])
  await assert.rejects(added(plugin), error => error.message.includes(join(root, 'skills', 'beta', 'SKILL.md')))
})

test('ships no frontmatter parser', () => {
  assert.doesNotMatch(emit(MODEL)['.opencode/plugins/vibekit.js'], /frontmatter/i)
})

test('ships the plugin directory', () => {
  assert.ok(ships(MODEL).includes('.opencode/'))
})

test('install document gives a local-checkout form that loads the plugin, and the skill.list check', () => {
  const doc = emit(MODEL)['.opencode/INSTALL.md']
  assert.doesNotMatch(doc, /opencode debug skill/)
  assert.match(doc, /Requires opencode v2/)
  assert.match(doc, /export \{ default \} from 'file:\/\/\/path\/to\/local\/vibekit\/\.opencode\/plugins\/vibekit\.js'/)
  assert.doesNotMatch(doc, /"skills": \[/)
  assert.match(doc, new RegExp(`opencode api skill\.list -H "x-opencode-directory:\$PWD" \| grep -c '"id":"${MODEL.config.bootstrap}"'`))
})

// Stands in for the v2 hooks, keeping each registered handler so a test can
// call it the way opencode would.
async function hooked(plugin) {
  const handlers = {}
  const hook = kind => async (name, fn) => { handlers[`${kind}.${name}`] = fn }
  await plugin.setup({
    skill: { transform: async fn => fn({ add: () => {} }) },
    session: { hook: hook('session') },
    tool: { hook: hook('tool') },
    permission: { hook: hook('permission') },
  })
  return handlers
}

const started = {
  ...MODEL,
  config: { ...MODEL.config, bootstrap: 'alpha' },
  skills: [...MODEL.skills, { name: 'lazy', description: 'Lazy. Stays on after.', trigger: 'always', command: false, gate: 'none', dir: 'lazy' }],
}

test('pushes each start skill into the system prompt, saying vibekit is present once', async t => {
  const { plugin } = await load(started, t)
  const handlers = await hooked(plugin)
  const context = { system: [] }
  await handlers['session.context'](context)
  assert.deepEqual(context.system.map(part => part.type), ['text', 'text'])
  assert.match(context.system[0].text, /^<EXTREMELY_IMPORTANT>\nYou have vibekit\.\n[\s\S]*full content of the alpha skill/)
  assert.match(context.system[1].text, /full content of the lazy skill/)
  assert.doesNotMatch(context.system[1].text, /You have vibekit/)
})

test('start blocks carry no carriage return from CRLF skill files', async t => {
  const { plugin } = await load(started, t, [], '\r\n')
  const context = { system: [] }
  await (await hooked(plugin))['session.context'](context)
  assert.equal(context.system.length, 2)
  assert.equal(context.system.filter(part => part.text.includes('\r')).length, 0)
})

test('registers no edit guard', async t => {
  const { plugin } = await load(started, t)
  assert.deepEqual(Object.keys(await hooked(plugin)), ['session.context'])
})
