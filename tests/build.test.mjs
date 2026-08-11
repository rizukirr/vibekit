// tests/build.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync, cpSync } from 'node:fs'
import { join } from 'node:path'
import { build, mergeEmitters, applyRegions, planChanges, mergeContributions, MANIFEST } from '../lib/build.mjs'
import { makeSkillsDir, skillFile, MODEL } from './helpers.mjs'

const alpha = { id: 'alpha', emit: () => ({ 'a.json': '1\n' }) }
const beta = { id: 'beta', emit: () => ({ 'b.json': '2\n' }) }
const clash = { id: 'clash', emit: () => ({ 'a.json': '3\n' }) }

test('merges disjoint emitter output', () => {
  const { files } = mergeEmitters([alpha, beta], MODEL)
  assert.deepEqual(files, { 'a.json': '1\n', 'b.json': '2\n' })
})

test('throws naming both emitters when two claim the same path', () => {
  assert.throws(() => mergeEmitters([alpha, clash], MODEL), /'a\.json' emitted by both 'alpha' and 'clash'/)
})

test('records which emitter owns each path', () => {
  const { owner } = mergeEmitters([alpha, beta], MODEL)
  assert.equal(owner['a.json'], 'alpha')
})

test('reports a file whose content differs as drift', () => {
  const changes = planChanges({ 'a.json': 'new\n' }, { read: () => 'old\n' }, [])
  assert.deepEqual(changes.write, ['a.json'])
  assert.deepEqual(changes.remove, [])
})

test('reports a missing file as drift', () => {
  const changes = planChanges({ 'a.json': 'new\n' }, { read: () => null }, [])
  assert.deepEqual(changes.write, ['a.json'])
})

test('reports no drift when content already matches', () => {
  const changes = planChanges({ 'a.json': 'same\n' }, { read: () => 'same\n' }, [])
  assert.deepEqual(changes.write, [])
})

test('removes a previously generated path that is no longer emitted', () => {
  const changes = planChanges({ 'a.json': 'x\n' }, { read: () => 'x\n' }, ['a.json', 'gone.md'])
  assert.deepEqual(changes.remove, ['gone.md'])
})

test('never removes a path absent from the previous manifest', () => {
  const changes = planChanges({}, { read: () => 'x\n' }, [])
  assert.deepEqual(changes.remove, [])
})

test('loads core plus every configured runtime, in that order', async () => {
  const { emitters } = await build(process.cwd())
  assert.deepEqual(emitters.map(e => e.id), ['core', 'claude-code', 'codex'])
})

// W2: the merge → regions → manifest → plan sequencing used to live untested in
// the CLI. These assert the assembly, not just its parts.
test('assembles every generated path and reports no drift on a clean tree', async () => {
  const { files, write, remove } = await build(process.cwd())
  for (const path of ['package.json', 'CLAUDE.md', 'AGENTS.md', 'README.md',
                      '.claude-plugin/plugin.json', '.codex-plugin/plugin.json', MANIFEST]) {
    assert.ok(path in files, `${path} missing from assembled output`)
  }
  assert.deepEqual(write, [], 'clean tree must report no stale files')
  assert.deepEqual(remove, [], 'clean tree must report no orphans')
})

// N1: the manifest used to omit itself, because Object.keys(files) was read
// before files[MANIFEST] was assigned.
test('the manifest lists itself and every other generated path, sorted', async () => {
  const { files } = await build(process.cwd())
  const listed = files[MANIFEST].split('\n').filter(Boolean)
  assert.ok(listed.includes(MANIFEST), 'manifest must list itself')
  assert.deepEqual(listed, [...Object.keys(files)].sort())
  assert.deepEqual(listed, [...listed].sort(), 'manifest must be sorted')
})

test('applyRegions mutates in place and returns nothing', () => {
  const files = {}
  const io = { read: () => '<!-- vibekit:generated:r -->\n<!-- /vibekit:generated -->\n' }
  const emitter = { id: 'e', emit: () => ({}), regions: () => ({ 'D.md': { r: 'rows' } }) }
  const result = applyRegions([emitter], MODEL, files, {}, io)
  assert.equal(result, undefined)
  assert.ok(files['D.md'].includes('rows'))
})

test('throws when the config names an emitter that does not exist', async () => {
  const { root, cleanup } = makeSkillsDir({ 'using-vibekit': skillFile({ name: 'using-vibekit' }) })
  try {
    writeFileSync(join(root, 'vibekit.config.json'), JSON.stringify({
      ...MODEL.config, runtimes: ['no-such-runtime'],
    }))
    mkdirSync(join(root, 'skills'), { recursive: true })
    cpSync(join(root, 'using-vibekit'), join(root, 'skills', 'using-vibekit'), { recursive: true })
    await assert.rejects(() => build(root), /runtimes\/no-such-runtime\.mjs could not be loaded/)
  } finally { cleanup() }
})

const withPkg = { id: 'withPkg', emit: () => ({}), pkg: () => ({ main: './x.js' }), ships: () => ['.x/'] }
const alsoPkg = { id: 'alsoPkg', emit: () => ({}), pkg: () => ({ main: './y.js' }) }
const withShips = { id: 'withShips', emit: () => ({}), ships: () => ['.y/', '.x/'] }

test('collects pkg contributions from every emitter', () => {
  const { pkg } = mergeContributions([alpha, withPkg], MODEL)
  assert.deepEqual(pkg, { main: './x.js' })
})

test('throws naming both emitters when two claim the same package.json key', () => {
  assert.throws(() => mergeContributions([withPkg, alsoPkg], MODEL), /'main' contributed by both 'withPkg' and 'alsoPkg'/)
})

test('ships entries are merged, sorted and de-duplicated', () => {
  const { ships } = mergeContributions([withPkg, withShips], MODEL)
  assert.deepEqual(ships, ['.x/', '.y/'])
})

test('an emitter exporting neither contributes nothing', () => {
  const { pkg, ships } = mergeContributions([alpha, beta], MODEL)
  assert.deepEqual(pkg, {})
  assert.deepEqual(ships, [])
})
