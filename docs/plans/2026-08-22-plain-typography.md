# plain: Implementation Plan

Heading omits the em dash in plan's `# <topic> — Implementation Plan` template for the same reason the spec does. Nothing parses it.

**Spec:** docs/specs/2026-08-22-plain-typography-design.md
**Goal:** Ship a third always-on skill `plain` carrying three typography rules, with the repo cleaned to obey them first and the cleanup measured separately from the skill.
**Architecture:** `skills/plain/SKILL.md` is a new modifier beside `terse` and `lazy`, generated into the trigger tables by `npm run generate`. A new `producedFilesOmit` expectation in `evals/score.mjs` lets scenarios assert on the content of files a session wrote, which is what makes an artifact-level typography rule measurable at all. Two eval gates sit between the cleanup and the skill so their effects are attributable separately.

## Global constraints

- Generated files are never hand-edited. `.vibekit-manifest` lists them.
- `evals/scenarios.json:243` holds the string `"finalTextOmits": "—"`. That em dash is the probe and stays.
- `evals/scenarios.json` line 239 holds scenario `terse-omits-em-dash`. Its `expect` block is not modified by any task.
- Every new scenario uses `"n": 10`.
- No new entry is added to `evals/thresholds.json`. New scenarios inherit `"minFiringRate": 0.8`.
- Semicolons in `.mjs` source are syntax and are not touched. Only prose semicolons in `.md` files are in scope.
- `.gitignore:4` ignores `/docs` and `.gitignore:5` ignores `/evals/results`, so neither this plan, the spec, nor any results file can be committed.
- Baseline ref for M1 is `fb7d43c`.

## Task 1: producedFilesOmit expectation → verify: `npm test` exits 0

**Files:**
- Modify: `evals/score.mjs:75-82`
- Modify: `evals/score.mjs:220`
- Modify: `tests/eval-score.test.mjs:454`

- [x] Step 1: In `evals/score.mjs`, add the key to the set at lines 75 to 82. The line currently reading

```js
  'fileMatching', 'onlyNewFilesMatching',
```

becomes

```js
  'fileMatching', 'onlyNewFilesMatching', 'producedFilesOmit',
```

- [x] Step 2: In `evals/score.mjs`, immediately after the `const written` binding at line 220, add the check. It mirrors `finalTextOmits` at lines 141 to 145 and walks the same `written` list the clauses below it use.

```js
  // Mirrors finalTextOmits over files the session wrote. finalTextOmits sees
  // only the last assistant message, so a rule that must hold in artifacts —
  // code comments, commit messages, PR bodies — has nothing to assert against
  // without this. Seeded fixtures are excluded: they are the input, not the work.
  if (expect.producedFilesOmit !== undefined) {
    const patterns = [expect.producedFilesOmit].flat()
    for (const pattern of patterns) {
      const re = new RegExp(pattern)
      for (const [path, contents] of written) {
        if (re.test(contents)) return `${path} contained /${pattern}/`
      }
    }
  }
```

- [x] Step 3: In `tests/eval-score.test.mjs`, append four tests after line 454, following the shape of the `skillAbsent` tests that begin at line 434.

```js
test('producedFilesOmit is satisfied when no written file matches', () => {
  const s = { id: 's', expect: { producedFilesOmit: '—' } }
  assert.equal(satisfied(s, ok({ produced: { 'a.md': 'clean prose' } })), true)
})

test('producedFilesOmit is unsatisfied when a written file matches', () => {
  const s = { id: 's', expect: { producedFilesOmit: '—' } }
  assert.equal(satisfied(s, ok({ produced: { 'a.md': 'dirty — prose' } })), false)
})

test('producedFilesOmit accepts an array and is unsatisfied by any member matching', () => {
  const s = { id: 's', expect: { producedFilesOmit: ['—', ';'] } }
  assert.equal(satisfied(s, ok({ produced: { 'a.md': 'has a; semicolon' } })), false)
})

test('producedFilesOmit ignores seeded fixtures', () => {
  const s = { id: 's', expect: { producedFilesOmit: '—' } }
  const run = ok({ seeded: { 'seed.md': 'seeded — prose' }, produced: { 'seed.md': 'seeded — prose' } })
  assert.equal(satisfied(s, run), true)
})
```

- [x] Step 4: Read the existing `ok()` helper in `tests/eval-score.test.mjs` and adjust the four tests above to its actual signature before running anything. The helper's shape is what the tests must match, not the sketch above.
- [x] Step 5: Run `npm test`
- [x] Step 6: Commit

## Task 2: remove em dashes and prose semicolons from sources → verify: `npm test` exits 0 and `npm run check` exits 0

**Files:**
- Modify: `skills/brainstorm/SKILL.md`, `skills/debug/SKILL.md`, `skills/exec/SKILL.md`, `skills/lazy/SKILL.md`, `skills/plan/SKILL.md`, `skills/quick/SKILL.md`, `skills/terse/SKILL.md`, `skills/using-vibekit/SKILL.md`, `skills/verify/SKILL.md`, `skills/vibe/SKILL.md`
- Modify: `evals/scenarios.json` at lines 48, 58, 73, 90, 101, 116, 129, 157, 172, 187
- Modify: `evals/judge.md`, `evals/score.mjs`, `evals/run.mjs`, `evals/parse.mjs`, `evals/session.mjs`, `evals/worktree.mjs`
- Modify: `lib/build.mjs`, `lib/frontmatter.mjs`, `lib/markers.mjs`, `lib/model.mjs`, `lib/table.mjs`, `runtimes/core.mjs`
- Modify: `tests/eval-score.test.mjs`, `tests/model.test.mjs`, `tests/no-external-references.test.mjs`, `tests/table.test.mjs`
- Modify: `tests/terse.test.mjs:42-44`
- Regenerate, never hand-edit: every file listed in `.vibekit-manifest`. Any task step that runs `npm run generate` rewrites these, so they are authorised output rather than a scope violation.

- [x] Step 1: Replace every em dash outside the exceptions with a comma, a colon, or a sentence break. The exception list is exactly: the probe string at `evals/scenarios.json:243`, and nothing else. Work file by file. A tree-wide find and replace is forbidden by the spec, because a template quoted inside a skill and a template quoted inside an eval fixture need different decisions.
- [x] Step 2: Rewrite `skills/brainstorm/SKILL.md:84`, the pushback template, so the text a session must reproduce word for word carries no em dash. The line currently reads

```
> **Pushback:** Before I sketch approaches, one challenge — `<one-sentence simpler framing or hidden assumption>`. Is the smaller version what you want, or do you need the larger framing? (If the larger framing is correct, say so and I'll proceed.)
```

and becomes

```
> **Pushback:** Before I sketch approaches, one challenge. `<one-sentence simpler framing or hidden assumption>`. Is the smaller version what you want, or do you need the larger framing? (If the larger framing is correct, say so and I'll proceed.)
```

- [x] Step 3: Rewrite `skills/brainstorm/SKILL.md:130`, the spec heading template. The line currently reads

```
# <topic> — Design
```

and becomes

```
# <topic>: Design
```

- [x] Step 4: Rewrite `skills/terse/SKILL.md:3` and `skills/terse/SKILL.md:4`. These drive firing and are the highest-risk edit in the cleanup. They become

```
description: Use at the start of every session. Compress narration, never artifacts. Questions, evidence, specs, plans and warnings stay verbatim. Stays on after.
trigger: First response of the session, invoke once, then it stays on
```

- [x] Step 5: Update the pins in `tests/terse.test.mjs:42-44` to match Step 4 exactly. They become

```js
  assert.match(terse, /^trigger: First response of the session, invoke once, then it stays on$/m)
  assert.match(terse, /^gate: none$/m)
  assert.match(terse, /^description: Use at the start of every session\. Compress narration, never artifacts\./m)
```

- [x] Step 6: Replace every prose semicolon in `skills/*/SKILL.md` and `evals/judge.md` with a sentence break. Semicolons inside fenced code blocks and inside `.mjs` files are untouched.
- [x] Step 7: Run `npm run generate`
- [x] Step 8: Run `npm test`
- [x] Step 9: Run `npm run check`
- [x] Step 10: Confirm the only tracked file still containing an em dash is `evals/scenarios.json`, by running `git ls-files -z | xargs -0 grep -l '—'`
- [x] Step 11: Commit

## Task 3: unwrap hard-wrapped paragraphs in skills → verify: `npm run check` exits 0 and `npm test` exits 0

**Files:**
- Modify: `skills/brainstorm/SKILL.md`, `skills/debug/SKILL.md`, `skills/exec/SKILL.md`, `skills/lazy/SKILL.md`, `skills/plan/SKILL.md`, `skills/quick/SKILL.md`, `skills/terse/SKILL.md`, `skills/using-vibekit/SKILL.md`, `skills/verify/SKILL.md`, `skills/vibe/SKILL.md`
- Regenerate, never hand-edit: every file listed in `.vibekit-manifest`. Any task step that runs `npm run generate` rewrites these, so they are authorised output rather than a scope violation.

- [x] Step 1: In each file, join the lines of every prose paragraph into one line. A blank line still separates paragraphs. Headings, list items, table rows, fenced code blocks and blockquotes keep their own line breaks, since those breaks are structural rather than column wrapping.
- [x] Step 2: Confirm the rendered text is unchanged apart from the line joins. This task is reviewed by comparing rendered output, not by reading the diff, because it changes nearly every line in all ten files.
- [x] Step 3: Run `npm run generate`
- [x] Step 4: Run `npm test`
- [x] Step 5: Run `npm run check`
- [x] Step 6: Scan for remaining column wrapping. No two consecutive non-empty prose lines may both fall in the 60 to 85 character band. Exclude headings, list items, table rows, fenced code and blockquotes from the scan.
- [x] Step 7: Commit

## Task 4: measure M1 → verify: the results file the run writes exists

**Files:**
- Create: one file under `evals/results/`, named by the harness

- [x] Step 1: Run `node evals/run.mjs --baseline fb7d43c --candidate HEAD --scenarios terse-omits-em-dash,terse-omits-throat-clearing,brainstorm-precedes-code,lazy-reachable,terse-reachable`
  Scoped to 5 scenarios, 35 sessions per arm, on the user's decision. The two em dash scenarios keep their declared `n` of 10 so M1 is measured at full power. The other three are firing guards. The full 27-scenario sweep moves to the verify stage, where it runs once against the finished branch instead of twice mid-run.
- [x] Step 2: Read the rate the run recorded for `terse-omits-em-dash` in both arms, and the rates for `brainstorm-precedes-code` and every `*-reachable` scenario.
- [x] Step 3: Record those rates in the verification report. `.gitignore:5` ignores `/evals/results`, so the file cannot be committed and its contents must be quoted rather than linked.
- [x] Step 4: If any scenario fell below its threshold in `evals/thresholds.json`, stop and report. The frontmatter edit in Task 2 Step 4 is the suspect, and Task 2 reverts on its own without touching Tasks 1 or 3.
- [x] Step 5: No commit. This task produces a measurement, not a change.

## Task 5: add the plain skill and its scenarios → verify: `npm test` exits 0 and `npm run check` exits 0

**Files:**
- Create: `skills/plain/SKILL.md`
- Create: `tests/plain.test.mjs`
- Modify: `evals/scenarios.json`
- Regenerate, never hand-edit: every file listed in `.vibekit-manifest`. Any task step that runs `npm run generate` rewrites these, so they are authorised output rather than a scope violation.

- [x] Step 1: Create `skills/plain/SKILL.md` with exactly this content.

````markdown
---
name: plain
description: Use at the start of every session. Three typography rules that hold in every string you emit, including code comments, commit messages, PR bodies and docs. No em dash, no semicolon, no hard wrapping inside a paragraph. Stays on after.
trigger: First response of the session, invoke once, then it stays on
gate: none
---

# plain

Three rules about how text is typed. They hold everywhere, with no exception for artifacts.

## Persistence

Invoke once, then active every response. No drift back after many turns. Still active if unsure. Off only on "stop plain" or "normal mode".

## The rules

1. **No em dash.** Not in prose, not in a table cell, not in a heading, not in a frontmatter description. Use a comma, a colon, or a full stop. If the sentence needs the pause an em dash gives it, it is two sentences.

2. **No semicolon.** Split into two sentences. A list whose items contain commas is the one place a semicolon earns its keep, and even there a bulleted list is better.

3. **No hard wrapping inside a paragraph.** One paragraph is one line, however long. Wrap at the paragraph, never at a column. In code comments, follow the project linter instead, because a formatter that reflows comments will fight this rule and the formatter wins.

## Where this applies

Every string that leaves the session. Prose to the user, code comments, docstrings, commit messages, PR bodies, markdown docs, specs and plans.

The one exception is text a skill requires reproduced verbatim. When an instruction says to output something word for word, output it word for word, banned characters included, and the rule yields.

## Boundaries

How text is typed, not how much of it there is. `terse` covers volume, `lazy` covers code.
````

- [x] Step 2: Run `npm run generate`
- [x] Step 3: Create `tests/plain.test.mjs`, pinning the `description` and `trigger` frontmatter by value, following the shape of the pins in `tests/terse.test.mjs:42-44`. Those two strings drive firing, which is what the new scenarios measure.
- [x] Step 4: Add four scenarios to `evals/scenarios.json`, each with `"n": 10` and `"model": "sonnet"`.

```json
{
  "id": "plain-reachable",
  "prompt": "Let's add pagination to my blog's post list.",
  "expect": { "skill": "vibekit:plain" },
  "n": 10,
  "model": "sonnet"
},
{
  "id": "plain-omits-em-dash-in-artifact",
  "prompt": "Invoke the vibekit:plain skill using the Skill tool, then follow it exactly. Write a file notes.md containing three or four paragraphs explaining to a new contributor why a code review that finds nothing is not evidence that the code is correct.",
  "expect": { "skill": "vibekit:plain", "producedFilesOmit": "—" },
  "n": 10,
  "model": "sonnet"
},
{
  "id": "plain-omits-semicolon",
  "prompt": "Invoke the vibekit:plain skill using the Skill tool, then follow it exactly while you answer in prose only, with no code blocks: in three or four paragraphs, explain to a new contributor why a code review that finds nothing is not evidence that the code is correct.",
  "expect": { "skill": "vibekit:plain", "finalTextOmits": ";" },
  "n": 10,
  "model": "sonnet"
},
{
  "id": "terse-omits-em-dash-short",
  "prompt": "Invoke the vibekit:terse skill using the Skill tool, then follow it exactly while you answer in two sentences: why is a code review that finds nothing not evidence that the code is correct?",
  "expect": { "skill": "vibekit:terse", "finalTextOmits": "—" },
  "n": 10,
  "model": "sonnet"
}
```

- [x] Step 5: Add no entry to `evals/thresholds.json`. All four inherit the 0.8 default.
- [x] Step 6: Run `npm test`
- [x] Step 7: Run `npm run check`
- [x] Step 8: Commit

## Task 6: measure M2 → verify: the results file the run writes exists

**Files:**
- Create: one file under `evals/results/`, named by the harness

- [x] Step 1: Read the commit hash produced by Task 3 Step 7, which is the cleanup commit and the baseline for this run.
- [x] Step 2: Run `node evals/run.mjs --baseline 67ae746 --candidate HEAD --scenarios plain-reachable,plain-omits-em-dash-in-artifact,plain-omits-semicolon,terse-omits-em-dash-short,terse-omits-em-dash,brainstorm-precedes-code,lazy-reachable,terse-reachable`
  Scoped on the same principle the user chose for M1. The four new scenarios have no meaningful baseline, since `plain` did not exist at 67ae746, so their baseline arm doubles as a check that the scenarios detect absence. `terse-reachable` is included because `plain` now shares terse's trigger string.
- [x] Step 3: Read the rates the run recorded for the four scenarios added in Task 5, for `terse-omits-em-dash`, for `brainstorm-precedes-code`, and for every `*-reachable` scenario.
- [x] Step 4: Record those rates in the verification report, quoted rather than linked.
- [x] Step 5: If `plain-reachable` fell below its threshold, report it rather than raising the threshold. Editing the gate to pass the gate is forbidden by the spec.
- [x] Step 6: No commit. This task produces a measurement, not a change.

## Task 7: give plain a distinct trigger and description → verify: `npm test` exits 0 and `npm run check` exits 0

Added 2026-08-22 after verify returned `not ready`. `plain-reachable` measured 0.10 against the 0.8 default floor. `plain` and `terse` carry byte-identical `trigger` strings and descriptions that open with the same sentence, which is the most likely cause. This task differentiates both fields.

**Files:**
- Modify: `skills/plain/SKILL.md:3-4`
- Modify: `tests/plain.test.mjs`
- Regenerate, never hand-edit: every file listed in `.vibekit-manifest`. Any task step that runs `npm run generate` rewrites these, so they are authorised output rather than a scope violation.

- [x] Step 1: In `skills/plain/SKILL.md`, replace lines 3 and 4. They currently read

```
description: Use at the start of every session. Three typography rules that hold in every string you emit, including code comments, commit messages, PR bodies and docs. No em dash, no semicolon, no hard wrapping inside a paragraph. Stays on after.
trigger: First response of the session, invoke once, then it stays on
```

and become

```
description: Use before writing any text, in chat or into a file. Three typography rules that hold in every string you emit, including code comments, commit messages, PR bodies and docs. No em dash, no semicolon, no hard wrapping inside a paragraph. Stays on after.
trigger: Before the first text of the session is written, whether prose or a file, invoke once, then it stays on
```

Neither string may share its opening clause with `skills/terse/SKILL.md:3-4`, which read "Use at the start of every session." and "First response of the session, invoke once, then it stays on". No other line in the file changes.

- [x] Step 2: Update the two pins in `tests/plain.test.mjs` to match Step 1 exactly. They become

```js
  assert.match(plain, /^trigger: Before the first text of the session is written, whether prose or a file, invoke once, then it stays on$/m)
  assert.match(plain, /^description: Use before writing any text, in chat or into a file\. Three typography rules that hold in every string you emit, including code comments, commit messages, PR bodies and docs\. No em dash, no semicolon, no hard wrapping inside a paragraph\. Stays on after\.$/m)
```

- [x] Step 3: Run `npm run generate`
- [x] Step 4: Run `npm test`
- [x] Step 5: Run `npm run check`
- [x] Step 6: Commit

## Task 8: re-measure firing after the trigger change → verify: the results file the run writes exists

**Files:**
- Create: one file under `evals/results/`, named by the harness

- [x] Step 1: Read the commit hash produced by Task 7 Step 6.
- [x] Step 2: Run `node evals/run.mjs --baseline d75d6ac --candidate HEAD --scenarios plain-reachable,terse-reachable,lazy-reachable,brainstorm-precedes-code`
  Baseline is the commit that measured `plain-reachable` at 0.10, so the two arms isolate the trigger change. `terse-reachable` and `lazy-reachable` are included because a trigger string that competes less with terse could also change terse's own firing, in either direction.
- [x] Step 3: Read the rates the run recorded for all four scenarios.
- [x] Step 4: Record those rates in the verification report, quoted rather than linked, since `.gitignore:5` ignores `/evals/results`.
- [x] Step 5: If `plain-reachable` is still below its 0.8 floor, report it rather than raising the threshold. Editing the gate to pass the gate is forbidden by the spec.
- [x] Step 6: No commit. This task produces a measurement, not a change.

## Task 9: sponsor plain in brainstorm's procedure → verify: `npm test` exits 0 and `npm run check` exits 0

Added 2026-08-22 after `debug` was refuted twice on why `plain-reachable` measures 0.10. What survived undismissed: autonomous modifier invocation measures roughly 3 of 15 for `lazy` and 3 of 15 for `terse` across three baseline arms, so `plain` at 0.10 is getting the ordinary unsponsored rate. `lazy` and `terse` reach 0.80 and 1.00 because `skills/brainstorm/SKILL.md:26` names them and `brainstorm` is a hard gate. This task gives `plain` the same sponsor and nothing else, so the measurement varies one thing.

**Files:**
- Modify: `skills/brainstorm/SKILL.md:26`
- Regenerate, never hand-edit: every file listed in `.vibekit-manifest`. Any task step that runs `npm run generate` rewrites these, so they are authorised output rather than a scope violation.

- [x] Step 1: Replace `skills/brainstorm/SKILL.md:26` in full. It currently reads

```
1. **Invoke `lazy` and `terse` before anything else.** `lazy` governs what you build, `terse` how you talk. Both stay on for the rest of the session. Their description lines are not their content. You have not read either skill until you have invoked it.
```

and becomes

```
1. **Invoke `lazy`, `terse` and `plain` before anything else.** `lazy` governs what you build, `terse` how you talk, `plain` how text is typed. All three stay on for the rest of the session. Their description lines are not their content. You have not read a skill until you have invoked it.
```

No other line in the file changes. No other skill file gains a mention of `plain`, because a second sponsor added in the same commit would make the measurement unattributable.

- [x] Step 2: Run `npm run generate`
- [x] Step 3: Run `npm test`
- [x] Step 4: Run `npm run check`
- [x] Step 5: Commit

## Task 10: re-measure firing with plain sponsored → verify: the results file the run writes exists

**Files:**
- Create: one file under `evals/results/`, named by the harness

- [x] Step 1: Read the commit hash produced by Task 9 Step 5.
- [x] Step 2: Run `node evals/run.mjs --baseline fadc75a --candidate HEAD --scenarios plain-reachable,terse-reachable,lazy-reachable,brainstorm-precedes-code`
  Baseline is the commit that measured `plain-reachable` at 0.10 with no sponsor, so the two arms isolate the sponsorship and nothing else. `terse-reachable` and `lazy-reachable` are guards: adding a third name to the same sentence could dilute the delegation that currently carries them.
- [x] Step 3: Read the rates the run recorded for all four scenarios.
- [x] Step 4: Record those rates in the verification report, quoted rather than linked, since `.gitignore:5` ignores `/evals/results`.
- [x] Step 5: If `plain-reachable` is still below its 0.8 floor, report it rather than raising the threshold, and note that the surviving account from `debug` is then also wrong.
- [x] Step 6: No commit. This task produces a measurement, not a change.
