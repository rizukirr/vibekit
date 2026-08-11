import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const terse = readFileSync('skills/terse/SKILL.md', 'utf8')

test('states the shaping rules and the tells', () => {
  assert.match(terse, /No em dash/i)
  assert.match(terse, /Lead with the action/i)
  assert.match(terse, /never[- ]compress/i)
})

// Position is the variable under test, so position is what the test pins. Round
// 1 put this same block at line 58 of 120 and measured 0.00 against a 0.00
// baseline.
test('states them before the persistence section', () => {
  assert.ok(terse.search(/##\s+Shaping/i) < terse.search(/##\s+Persistence/i),
    'the shaping section must appear before ## Persistence')
})
