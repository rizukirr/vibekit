// tests/terse.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const terse = readFileSync('skills/terse/SKILL.md', 'utf8')

test('states every shaping rule', () => {
  for (const phrase of [
    'Lead with the action',
    'Restate position',
    'One concrete next action',
    'Cap narration lists',
    'Pre-send deletion pass',
  ]) {
    assert.match(terse, new RegExp(phrase, 'i'), `${phrase} missing`)
  }
})

// Without the exemption the cap becomes a licence to drop the sixth blocker.
test('subordinates the cap and the deletion pass to the never-compress list', () => {
  const section = terse.slice(terse.search(/##\s+Shaping/i))
  assert.match(section, /never[- ]compress/i, 'the exemption must name the never-compress list')
  assert.match(section, /narration/i, 'the exemption must scope the rules to narration')
})

// The tells measured 0.00 against a 0.00 baseline at n=10, in two positions,
// on 2026-08-11. This test is what stops them returning unnoticed.
test('omits the tells that measured inert', () => {
  assert.doesNotMatch(terse, /No em dash/i)
})

// description and trigger are what the runtime shows the model before it decides
// to invoke a skill, and trigger feeds three generated tables. Changing either
// changes firing, which five scenarios measure. Pinned by value rather than by
// diff against HEAD: a diff against HEAD passes trivially once committed.
test('pins the frontmatter that drives firing', () => {
  assert.match(terse, /^trigger: First response of the session — invoke once, then it stays on$/m)
  assert.match(terse, /^gate: none$/m)
  assert.match(terse, /^description: Use at the start of every session — compress narration, never artifacts\./m)
})
