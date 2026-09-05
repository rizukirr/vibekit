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
    'No curly quotes',
    'No decorative emoji',
    'Sentence case in headings',
    'No bold label lists',
    'No heading echo',
    'No fragment runs',
    'No padded triads',
    'No rejected straw options',
    'No unraised objections',
    'No writing about the previous version',
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
  assert.match(plain, /^description: Use before writing any text, in chat or into a file\. Thirteen rules that hold in every string you emit, including code comments, commit messages, PR bodies and docs\. No em dash, no semicolon, no hard wrapping inside a paragraph, no curly quotes, no decorative emoji, no title case in headings, no bold label lists, no heading echo, no fragment runs, no padded triads, no rejected straw options, no unraised objections, no writing about the previous version\. Stays on after\.$/m)
})
