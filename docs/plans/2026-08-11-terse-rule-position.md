# terse rule position — Implementation Plan

**Spec:** docs/specs/2026-08-11-terse-output-shape-design.md (Approach 2)
**Goal:** Test whether the same rule binds when stated first, by moving round 1's section verbatim from the middle of `terse` to the top, holding its words and the file's length constant.
**Architecture:** Round 1's section is recovered from commit `603b487` rather than retyped, so "the same words" is true by construction and position is the only variable. A prose test pins the position; the existing `terse-omits-em-dash` scenario is re-run A/B against `v2`. No harness, emitter or scenario changes.

## Global constraints
- Dependency free.
- No shipped file under `skills/`, and none of the generated context files, may name a project vibekit borrows from.
- The never-compress list is not weakened.
- One variable. The section's text is recovered from `603b487`, not rewritten, and the file's line count must match round 1's candidate.
- Rates are quoted at n=10 or not at all.
- Pin `git ls-files -s skills evals | sha256sum` before and after every paid run.
- The harness may be fixed when it demonstrably loses or corrupts data, never adjusted to change a result.

### Task 1: move the section to the top → verify: `npm test` exits 0

**Files:**
- Create: `tests/terse.test.mjs`
- Modify: `skills/terse/SKILL.md:12`

- [ ] Step 1: Recover round 1's section without retyping it. Run
      `git show 603b487:skills/terse/SKILL.md` and read the block that begins
      with the line `## Shaping` and ends with the line immediately before
      `## What does not save tokens`. That block is the text to move. Do not
      edit a word of it, and do not reformat it.

- [ ] Step 2: Write `tests/terse.test.mjs`, and observe both tests failing:

```js
// tests/terse.test.mjs
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
```

- [ ] Step 3: Run `npm test` and record both failures with their messages.
- [ ] Step 4: Insert the recovered block into `skills/terse/SKILL.md` between the
      line `fluff dies.` and the `## Persistence` heading. Change no existing
      line, and add nothing that was not in the recovered block.
- [ ] Step 5: Run `npm test`
- [ ] Step 6: Run `npm run check` and confirm it exits 0. Then run
      `git show 603b487:skills/terse/SKILL.md | wc -l` and `wc -l
      skills/terse/SKILL.md` and confirm the two counts are equal. Unequal means
      the file's length moved alongside its order and the experiment has two
      variables; stop and say so rather than adjusting either file to match.
- [ ] Step 7: Commit

### Task 2: measure A/B at n=10 → verify: `ls evals/results/ | wc -l` is at least 28

**Files:**
- Create: `evals/results/<timestamp>-HEAD.json`

This task spends money. The harness prints its own estimate before spawning;
measured calibration for a text-only sonnet session is about $0.055. Stop and
confirm with the user before Step 2, quoting the harness's figure rather than
mine.

- [ ] Step 1: Run `git ls-files -s skills evals | sha256sum` and record the digest. `evals/results/` held 27 files when this plan was written, which is where the clause's threshold comes from.
- [ ] Step 2: Run `npm run eval -- --baseline v2 --candidate HEAD --scenarios terse-omits-em-dash -n 10`
- [ ] Step 3: Run `git ls-files -s skills evals | sha256sum` and confirm it
      equals the digest from Step 1.
- [ ] Step 4: Record both arms' rates. A candidate rate at or below its baseline
      is the finding, reported as it stands. Do not change the expectation, the
      prompt, or the skill in response to it. The spec decided in advance what a
      null result means; apply that, do not re-argue it.
- [ ] Step 5: Commit the results file.
