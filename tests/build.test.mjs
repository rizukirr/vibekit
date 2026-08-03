// tests/build.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync, cpSync } from 'node:fs'
import { join } from 'node:path'
import { build, mergeEmitters, planChanges } from '../lib/build.mjs'
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
