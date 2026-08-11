// tests/plan-clauses.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { isPredicate } from '../evals/score.mjs'

test('a straight-quoted string is caught', () => {
  assert.equal(isPredicate(' test fails with "fn is not defined"'), false)
})

test('a spelled-out count is caught', () => {
  assert.equal(isPredicate(' the four new cases pass'), false)
})
