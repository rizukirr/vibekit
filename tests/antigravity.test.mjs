// tests/antigravity.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { id, emit, ships, regions } from '../runtimes/antigravity.mjs'
import { MODEL } from './helpers.mjs'

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

test('ships both the manifest and the rules file', () => {
  const paths = ships(MODEL)
  assert.ok(paths.includes('plugin.json'))
  assert.ok(paths.includes('rules/AGENTS.md'))
})
