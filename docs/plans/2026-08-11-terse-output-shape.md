# terse output shape — Implementation Plan

**Spec:** docs/specs/2026-08-11-terse-output-shape-design.md
**Goal:** Give `terse` a shaping section — lead with the action, restate position, one next action, a list cap, a deletion pass, and four detectable tells — subordinate to the never-compress list it already carries.
**Architecture:** One section appended to `skills/terse/SKILL.md`, guarded by prose tests in a new `tests/terse.test.mjs`, and measured by two text-only eval scenarios run A/B against `v2`. No emitter, harness or other skill changes.

## Global constraints
- Dependency free.
- No shipped file under `skills/`, and none of the generated context files, may name a project vibekit borrows from.
- The never-compress list is not weakened. Every rule added here is subordinate to it.
- Rates are quoted at n=10 or not at all.
- Pin `git ls-files -s skills evals | sha256sum` before and after every paid run.
- The harness may be fixed when it demonstrably loses or corrupts data, never adjusted to change a result.

### Task 1: the shaping section → verify: `npm test` exits 0

**Files:**
- Create: `tests/terse.test.mjs`
- Modify: `skills/terse/SKILL.md:57`

- [x] Step 1: Write `tests/terse.test.mjs`, and observe both tests failing
      before Step 3 is written:

```js
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
```

- [x] Step 2: Run `npm test` and record both failures with their messages. A
      test that passes before the section is written is not a check.
- [x] Step 3: In `skills/terse/SKILL.md`, insert this section between the end of
      `### Auto-clarity override` and the `## What does not save tokens`
      heading. Change no existing line:

```markdown
## Shaping

Compression decides what survives. This decides the order it arrives in.

1. **Lead with the action.** If the answer is a command, a path or a snippet, it
   is the first line. Prose comes after, if at all.
2. **Restate position every turn.** In a multi-step run, say where you are:
   `Task 3 of 8 done: opencode emitter. Next: probe it.` The reader is not
   holding the plan in their head, and a run that reports results without
   position makes them count.
3. **One concrete next action** whenever something is left open, small enough to
   start immediately. "Open the file" counts.
4. **Cap narration lists at five.** Past five, split into now and later, or must
   and nice to have. Five ranked beats ten unranked.
5. **Pre-send deletion pass.** Delete the first sentence if it announces what you
   are about to do, the last if it recaps or asks whether anything else is
   needed, any sidebar, and any hedging adverb carrying no real uncertainty. Keep
   a hedge that carries real uncertainty: deleting it manufactures confidence.

### Tells

Four constructions that read as machine-written at any length. Each is
detectable by looking, which is why these four and not a phrase list:

- No em dash.
- No throat-clearing opener: "Here's what", "Let me", "Great question", "Sure".
- No "not X, it's Y" contrast where stating Y alone would do.
- No adverb doing emphasis work.

### The exemption

Rule 4 and rule 5 govern **narration only**. Neither touches anything on the
never-compress list: a findings list, a blocker enumeration, a goals walk, a
question to the user, quoted evidence, a destructive-operation warning.

A cap that can truncate findings is a licence to drop the sixth blocker. The
rules above shorten what you say about the work; they never shorten the work's
own output.
```

- [x] Step 4: Run `npm test`
- [x] Step 5: Run `npm run check` and confirm it exits 0, then run `git diff
      --name-only` and confirm no file under `skills/` other than
      `skills/terse/SKILL.md` appears. `terse`'s frontmatter is unchanged, so no
      generated file should move either.
- [x] Step 6: Commit

### Task 2: the two measurement scenarios → verify: `node -e "const s=require('./evals/scenarios.json'); process.exit(s.filter(x => x.id.startsWith('terse-omits')).length >= 2 ? 0 : 1)"` exits 0

**Files:**
- Modify: `evals/scenarios.json`

- [x] Step 1: Append two scenario objects to the array, after
      `debug-dispatches-the-refutation`. Change no existing scenario:

```json
  {
    "id": "terse-omits-em-dash",
    "prompt": "Invoke the vibekit:terse skill using the Skill tool, then follow it exactly while you answer: in three or four paragraphs, explain to a new contributor why a code review that finds nothing is not evidence that the code is correct.",
    "expect": {
      "skill": "vibekit:terse",
      "finalTextOmits": "—"
    },
    "n": 10,
    "model": "sonnet"
  },
  {
    "id": "terse-omits-throat-clearing",
    "prompt": "Invoke the vibekit:terse skill using the Skill tool, then follow it exactly while you answer: in three or four paragraphs, explain to a new contributor why a code review that finds nothing is not evidence that the code is correct.",
    "expect": {
      "skill": "vibekit:terse",
      "finalTextOmits": "^(Great question|Let me |Here's what|Sure[,!])"
    },
    "n": 10,
    "model": "sonnet"
  }
```

- [x] Step 2: Run `npm test`
- [x] Step 3: Run `npm run eval -- --dry-run --scenarios terse-omits-em-dash,terse-omits-throat-clearing`
      and record the printed plan and cost estimate. Spawn nothing.
- [x] Step 4: Run `git diff evals/scenarios.json` and confirm the diff adds two
      objects and changes no existing `"id"` line.
- [x] Step 5: Commit

### Task 3: measure A/B at n=10 → verify: a results file naming `terse-omits-em-dash` exists under `evals/results/`

**Files:**
- Create: `evals/results/<timestamp>-v2-HEAD.json`

This task spends money. Before Step 2, stop and confirm with the user, quoting
the estimate recorded in Task 2 Step 3.

- [x] Step 1: Run `git ls-files -s skills evals | sha256sum` and record the digest.
- [x] Step 2: Run `npm run eval -- --baseline v2 --candidate HEAD --scenarios terse-omits-em-dash,terse-omits-throat-clearing -n 10`
- [x] Step 3: Run `git ls-files -s skills evals | sha256sum` and confirm it
      equals the digest from Step 1.
- [x] Step 4: Record the baseline and candidate rate for each scenario. A
      candidate rate at or below its baseline is the finding, reported as it
      stands. Do not change the expectation, the prompt, or the skill in
      response to it.
- [x] Step 5: Commit the results file.

_Amended 2026-08-11 after Task 3: the A/B showed no behaviour change, so Task 1's
section and its test were reverted under `verify`'s routing, with the user's
decision recorded. Tasks 2 and 3 stand — the scenarios and the recorded result
are the durable output of this cycle. See the spec's Outcome section._

