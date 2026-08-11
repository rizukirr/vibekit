// tests/opencode.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { id, emit, pkg, ships } from '../runtimes/opencode.mjs'
import { MODEL } from './helpers.mjs'

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

test('registers the skills directory rather than parsing frontmatter', () => {
  const source = emit(MODEL)['.opencode/plugins/vibekit.js']
  assert.match(source, /config\.skills\.paths/)
  assert.doesNotMatch(source, /frontmatter/i)
})

test('ships the plugin directory', () => {
  assert.ok(ships(MODEL).includes('.opencode/'))
})
