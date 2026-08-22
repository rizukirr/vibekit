// tests/plain.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const plain = readFileSync('skills/plain/SKILL.md', 'utf8')

test('states every typography rule', () => {
  for (const phrase of [
    'No em dash',
    'No semicolon',
    'No hard wrapping inside a paragraph',
  ]) {
    assert.match(plain, new RegExp(phrase, 'i'), `${phrase} missing`)
  }
})

// description and trigger are what the runtime shows the model before it decides
// to invoke a skill, and trigger feeds three generated tables. Changing either
// changes firing, which four scenarios measure. Pinned by value rather than by
// diff against HEAD: a diff against HEAD passes trivially once committed.
test('pins the frontmatter that drives firing', () => {
  assert.match(plain, /^trigger: Before the first text of the session is written, whether prose or a file, invoke once, then it stays on$/m)
  assert.match(plain, /^gate: none$/m)
  assert.match(plain, /^description: Use before writing any text, in chat or into a file\. Three typography rules that hold in every string you emit, including code comments, commit messages, PR bodies and docs\. No em dash, no semicolon, no hard wrapping inside a paragraph\. Stays on after\.$/m)
})
