// tests/gemini.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { id, emit, ships, regions } from '../runtimes/gemini.mjs'
import { MODEL } from './helpers.mjs'

test('is identified as gemini', () => {
  assert.equal(id, 'gemini')
})

test('emits an extension manifest pointing at the context file', () => {
  const manifest = JSON.parse(emit(MODEL)['gemini-extension.json'])
  assert.equal(manifest.name, 'vibekit')
  assert.equal(manifest.contextFileName, 'GEMINI.md')
  assert.equal(manifest.version, '2.0.0')
})

test('claims the context file as a generated region', () => {
  assert.ok('trigger-table' in regions(MODEL)['GEMINI.md'])
})

test('ships both the manifest and the context file', () => {
  const paths = ships(MODEL)
  assert.ok(paths.includes('gemini-extension.json'))
  assert.ok(paths.includes('GEMINI.md'))
})
