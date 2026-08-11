// tests/terse.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const terse = readFileSync('skills/terse/SKILL.md', 'utf8')

// The five shaping rules, each named by the phrase the skill uses for it. A
// rule the file does not state is a rule nothing follows.
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

// The load-bearing one. Without the exemption the list cap becomes a licence to
// drop the sixth blocker, which is the worst thing this pipeline could ship.
test('subordinates the cap and the deletion pass to the never-compress list', () => {
  const exemption = terse.slice(terse.search(/##\s+Shaping/i))
  assert.match(exemption, /never[- ]compress/i, 'the exemption must name the never-compress list')
  assert.match(exemption, /narration/i, 'the exemption must scope the rules to narration')
})
