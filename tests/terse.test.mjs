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

// The tells ship as rules, with nothing beside them explaining that a
// measurement found them inert. That evidence lives in the spec, the two results
// files and the project memory. A skill that undermines its own rule in the same
// breath is worse than one that omits the rule.
test('states the tells as rules, without eval provenance', () => {
  assert.match(terse, /No throat-clearing opener/i)
  assert.doesNotMatch(terse, /No em dash/i)
  assert.doesNotMatch(terse, /did not bind/i)
  assert.doesNotMatch(terse, /evals\/results/)
})

// The em dash rule moved to `plain`. terse keeps a pointer rather than a copy,
// for the same reason its Boundaries line points at `lazy` for code volume.
test('points at plain for typography rather than restating it', () => {
  assert.match(terse, /`plain` covers typography/)
})

// description and trigger are what the runtime shows the model before it decides
// to invoke a skill, and trigger feeds three generated tables. Changing either
// changes firing, which five scenarios measure. Pinned by value rather than by
// diff against HEAD: a diff against HEAD passes trivially once committed.
test('pins the frontmatter that drives firing', () => {
  assert.match(terse, /^trigger: First response of the session, invoke once, then it stays on$/m)
  assert.match(terse, /^gate: none$/m)
  assert.match(terse, /^description: Use at the start of every session\. Compress narration, never artifacts\./m)
})
