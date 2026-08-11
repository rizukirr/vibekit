// tests/core.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { id, emit, regions } from '../runtimes/core.mjs'
import { MODEL } from './helpers.mjs'

test('is identified as core', () => {
  assert.equal(id, 'core')
})

test('composes package.json from the config npm block plus generated fields', () => {
  const pkg = JSON.parse(emit(MODEL)['package.json'])
  assert.equal(pkg.name, '@rizukirr/vibekit')
  assert.equal(pkg.version, '0.6.0')
  assert.equal(pkg.type, 'module')
  assert.equal(pkg.license, 'MIT')
  assert.deepEqual(pkg.publishConfig, { access: 'public' })
  assert.ok(pkg.files.includes('skills/'))
  assert.ok(pkg.files.includes('.claude-plugin/'))
})

test('files[] lists directories, never individual skills', () => {
  const pkg = JSON.parse(emit(MODEL)['package.json'])
  assert.ok(!pkg.files.some(entry => entry.includes('alpha')), 'files[] must not name skills')
})

// The spec constrains this project to Node 24+. CI pinning node-version only
// binds CI; an `engines` field is what tells a consumer installing from npm.
test('declares the engines constraint the spec requires', () => {
  const pkg = JSON.parse(emit(MODEL)['package.json'])
  assert.deepEqual(pkg.engines, { node: '>=24' })
})

test('package.json ends with a trailing newline', () => {
  assert.ok(emit(MODEL)['package.json'].endsWith('\n'))
})

test('owns the README skill-list region', () => {
  assert.deepEqual(Object.keys(regions(MODEL)), ['README.md'])
  const table = regions(MODEL)['README.md']['skill-list']
  assert.ok(table.startsWith('| Skill | What it does | Gate |'), 'must render as a table')
  assert.ok(table.includes('| `alpha` | Alpha does A.'), 'must carry each skill as a row')
})

test('merges contributed package.json keys', () => {
  const model = { ...MODEL, contributions: { pkg: { main: './p.js' }, ships: [] } }
  const pkg = JSON.parse(emit(model)['package.json'])
  assert.equal(pkg.main, './p.js')
})

test('merges contributed paths into the files allowlist', () => {
  const model = { ...MODEL, contributions: { pkg: {}, ships: ['.agents/'] } }
  const pkg = JSON.parse(emit(model)['package.json'])
  assert.ok(pkg.files.includes('.agents/'))
  assert.ok(pkg.files.includes('skills/'), 'the base allowlist survives')
})
