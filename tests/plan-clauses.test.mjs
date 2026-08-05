// tests/plan-clauses.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { verifyClauses, isPredicate } from '../evals/score.mjs'

// The rule the `plan` skill states in prose, enforced against the plans this
// repo actually writes. A checker that cannot pass its own project's plans is
// miscalibrated, and prose alone never surfaces that.
const DIR = 'docs/plans'

// Plans dated before the rule existed are records of completed runs. Editing
// them to satisfy a later rule would falsify history, and judging the rule by
// them would indict it on evidence that predates it. New plans are picked up
// automatically by the date prefix, so this needs no maintenance.
const RULE_FROM = '2026-08-05'

test('every verify clause in this repo is a predicate', () => {
  const offenders = []
  for (const name of readdirSync(DIR).filter(f => f.endsWith('.md') && f.slice(0, 10) >= RULE_FROM)) {
    for (const clause of verifyClauses(readFileSync(join(DIR, name), 'utf8'))) {
      if (!isPredicate(clause)) offenders.push(`${name}: ${clause.trim()}`)
    }
  }
  assert.deepEqual(offenders, [])
})

test('a straight-quoted string is caught', () => {
  assert.equal(isPredicate(' test fails with "fn is not defined"'), false)
})

test('a spelled-out count is caught', () => {
  assert.equal(isPredicate(' the four new cases pass'), false)
})
