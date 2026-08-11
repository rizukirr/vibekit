import test from 'node:test'
import assert from 'node:assert/strict'
import { id, emit, pkg } from '../runtimes/pi.mjs'
import { MODEL } from './helpers.mjs'

test('is identified as pi', () => {
  assert.equal(id, 'pi')
})

// Pi has native skills, so the package.json block is the whole integration.
// v1 shipped a .pi-plugin/ directory that nothing reads.
test('contributes a skills block and emits no files', () => {
  assert.deepEqual(pkg(MODEL).pi, { skills: ['./skills'] })
  assert.deepEqual(emit(MODEL), {})
})
