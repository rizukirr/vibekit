// tests/markers.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { applyRegion } from '../lib/markers.mjs'

const doc = [
  '# Title',
  '',
  '<!-- vibekit:generated:table -->',
  'stale content',
  '<!-- /vibekit:generated -->',
  '',
  'trailing prose',
  '',
].join('\n')

test('replaces only the region between markers', () => {
  const out = applyRegion(doc, 'table', 'fresh content')
  assert.ok(out.includes('fresh content'))
  assert.ok(!out.includes('stale content'))
  assert.ok(out.startsWith('# Title'))
  assert.ok(out.includes('trailing prose'))
})

test('is idempotent', () => {
  const once = applyRegion(doc, 'table', 'fresh content')
  assert.equal(applyRegion(once, 'table', 'fresh content'), once)
})

test('replaces an already-empty region', () => {
  const empty = '<!-- vibekit:generated:table -->\n<!-- /vibekit:generated -->\n'
  assert.ok(applyRegion(empty, 'table', 'rows').includes('rows'))
})

test('throws when the open marker is missing', () => {
  assert.throws(() => applyRegion('# Title\n', 'table'), /missing marker 'table'/)
})

test('throws when the open marker appears twice', () => {
  const dup = doc + '\n<!-- vibekit:generated:table -->\n<!-- /vibekit:generated -->\n'
  assert.throws(() => applyRegion(dup, 'table', 'x'), /duplicate marker 'table'/)
})

test('throws when the close marker is missing', () => {
  const open = '<!-- vibekit:generated:table -->\nrows\n'
  assert.throws(() => applyRegion(open, 'table', 'x'), /unbalanced marker 'table'/)
})
