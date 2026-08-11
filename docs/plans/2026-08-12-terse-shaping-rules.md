# terse shaping rules — Implementation Plan

**Spec:** docs/specs/2026-08-12-terse-shaping-rules-design.md
**Goal:** Give `terse` the five shaping rules and their exemption, recovered verbatim from commit `603b487`, without the tells that measured inert twice.
**Architecture:** One insertion into `skills/terse/SKILL.md` between the auto-clarity override and the token section, guarded by four prose tests. Frontmatter is untouched, so firing cannot move. No emitter, harness or scenario changes, and no paid run.

## Global constraints
- Dependency free.
- No shipped file under `skills/`, and none of the generated context files, may name a project vibekit borrows from.
- The never-compress list is not weakened.
- `terse`'s frontmatter is byte-identical after this change.
- The tells stay out. They measured inert at n=10 twice.
- No paid eval run.

### Task 1: the shaping rules → verify: `npm test` exits 0

**Files:**
- Create: `tests/terse.test.mjs`
- Modify: `skills/terse/SKILL.md:57`

- [x] Step 1: Recover the text rather than retyping it. Run
      `git show 603b487:skills/terse/SKILL.md` and take the block that begins
      with the line `## Shaping` and ends with the line immediately before
      `### Tells`. That block is rules 1 to 5. Then take the block that begins
      `### The exemption` and ends with the line before
      `## What does not save tokens`. Those two blocks, concatenated in that
      order, are the text to insert. The `### Tells` subsection between them is
      dropped and must not appear.

- [x] Step 2: Write `tests/terse.test.mjs`, and observe every test failing
      before Step 4:

```js
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
```

- [x] Step 3: Run `npm test` and record which tests fail and with what messages.
      A test that passes before the section is written is not a check. The
      frontmatter test is expected to pass from the start, since it pins values
      that already hold; say so rather than claiming it as evidence.
- [x] Step 4: Insert the recovered text into `skills/terse/SKILL.md` between the
      line `Resume afterwards.` and the `## What does not save tokens` heading.
      Change no existing line, and add nothing that was not in the two recovered
      blocks.
- [x] Step 5: Run `npm test`
- [x] Step 6: Run `npm run check` and confirm it exits 0. Then run
      `git diff skills/terse/SKILL.md` and confirm no line above `# terse`
      appears in the diff, and `git diff --name-only` and confirm the only paths
      are `skills/terse/SKILL.md` and `tests/terse.test.mjs`.
- [x] Step 7: Run `grep -c '—' skills/terse/SKILL.md` and record the count. The
      recovered text contains em dashes and that is expected: the tells are what
      this cycle drops, not the punctuation of the prose carrying the rules.
- [x] Step 8: Commit
