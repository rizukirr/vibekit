# plain anti-slop patterns: Implementation Plan

**Spec:** docs/specs/2026-09-05-plain-anti-slop-patterns-design.md
**Goal:** Widen `plain` from three typography rules to thirteen anti-slop rules covering both narration and artifacts, and measure the result against the pre-change baseline.
**Architecture:** All thirteen rules live in the single body of `skills/plain/SKILL.md`, because `lib/model.mjs:30` reads exactly one `SKILL.md` per skill directory. `tests/plain.test.mjs` asserts every rule phrase is present and pins the frontmatter description by value, so the skill and its test change together. Measurement reuses `evals/run.mjs`, which takes `--baseline` and `--candidate` git refs and gates on the thresholds in `evals/thresholds.json`.

## Global constraints
- The repository ships no dependencies and targets Node 24. Every check runs on a bare node.
- Generated files are produced by `npm run generate` and are never hand-edited. The skill table in `README.md:33-47` and the trigger table in `CLAUDE.md:7-21` are generated regions.
- `evals/score.mjs:139-152` and `evals/score.mjs:230-235` compile `finalTextOmits` and `producedFilesOmit` with `new RegExp` and pass no flags, ever. A scenario pattern may therefore not rely on the `m` flag, the `u` flag, or an inline `(?m)` group, which JavaScript does not support and which throws at compile time.
- Default eval thresholds are `minFiringRate` 0.8 and `maxRateRegression` 0.2, from `evals/thresholds.json`.
- `git worktree list` must report only the main working tree before any `evals/run.mjs` invocation.
- `terse` is not edited by this work.

## Task 1: Widen plain to thirteen rules → verify: `npm run check` exit status 0 and `npm test` exit status 0

**Files:**
- Modify: `skills/plain/SKILL.md:3` (description)
- Modify: `skills/plain/SKILL.md:10` (opening line)
- Modify: `skills/plain/SKILL.md:16-22` (the rules section)
- Modify: `skills/plain/SKILL.md:30-32` (boundaries)
- Modify: `tests/plain.test.mjs:10-12` (rule phrase list)
- Modify: `tests/plain.test.mjs:24` (pinned description assertion)

- [x] Step 1: Replace the description on `skills/plain/SKILL.md:3` with this single line:

```
description: Use before writing any text, in chat or into a file. Thirteen rules that hold in every string you emit, including code comments, commit messages, PR bodies and docs. No em dash, no semicolon, no hard wrapping inside a paragraph, no curly quotes, no decorative emoji, no title case in headings, no bold label lists, no heading echo, no fragment runs, no padded triads, no rejected straw options, no unraised objections, no writing about the previous version. Stays on after.
```

- [x] Step 2: Replace `skills/plain/SKILL.md:10` with:

```
Thirteen rules about how text is typed and shaped. They hold everywhere, with no exception for artifacts.
```

- [x] Step 3: Replace the whole rules section, `skills/plain/SKILL.md:16-22`, with:

```
## The rules

### Typography

1. **No em dash.** No en dash either, no spaced dash such as ` - ` used as one, no double hyphen. Not in prose, not in a table cell, not in a heading, not in a frontmatter description. Use a comma, a colon, or a full stop. If the sentence needs the pause an em dash gives it, it is two sentences.

2. **No semicolon.** Split into two sentences. A list whose items contain commas is the one place a semicolon earns its keep, and even there a bulleted list is better.

3. **No hard wrapping inside a paragraph.** One paragraph is one line, however long. Wrap at the paragraph, never at a column. In code comments, follow the project linter instead, because a formatter that reflows comments will fight this rule and the formatter wins.

4. **No curly quotes.** Straight quotes only, for both double and single marks, and a straight apostrophe. A curly mark is what a word processor produces, not what a terminal, a diff or a code file wants.

5. **No decorative emoji.** Not at the start of a heading, not at the start of a list item, not as a status marker in prose. An emoji the user asked for is not decoration and stays.

6. **Sentence case in headings.** Capitalise the first word and any proper noun. Not every main word.

### Shape

7. **No bold label lists.** A list where every item opens with a bold phrase and a colon is a table pretending to be prose. Write the prose, or write an actual table.

8. **No heading echo.** The sentence after a heading must not restate the heading. Delete it and start with the content.

9. **No fragment runs.** One short sentence for emphasis is fine. Three or more clipped fragments in a row is a drum roll, and it reads as performance rather than information.

10. **No padded triads.** Use the number of items the meaning has. Two is a fine list. Four is a fine list. Reaching for a third item because three sounds complete is how a real point gets a filler sibling.

### Drafting residue

11. **No rejected straw options.** Do not raise an option nobody proposed in order to dismiss it in the same clause. State the constraint directly.

12. **No unraised objections.** Do not answer a challenge the text never made. "To be clear, this is not about X" belongs in a reply to someone who said X.

13. **No writing about the previous version.** Describe what the code does now. Prior behaviour belongs in a changelog, a migration note, a release note, a root cause, or a commit message.

## Not a tell by itself

Rules 7 through 13 are judgment calls, and each has a legitimate form that must survive.

Three items are fine when there are three things. The tell is padding to reach three.

One short sentence for emphasis is fine. The tell is a run of them.

A heading followed by a definition is fine. The tell is a restatement.

An alternative is fine when it is weighed and its trade-offs are given. The tell is one raised and dropped in the same clause. `brainstorm` requires two or three approaches with trade-offs and an Alternatives considered section, and rule 11 never overrides that.

Prior behaviour is fine in a changelog, a migration note, a release note, a root cause or a commit message. The tell is it appearing in a description of current behaviour. `debug` produces root causes and `exec` writes commit messages, and rule 13 never overrides either.
```

- [x] Step 4: Replace `skills/plain/SKILL.md:30-32`, the Boundaries section, with:

```
## Boundaries

How text is typed and shaped, not how much of it there is. `terse` covers volume, `lazy` covers code.
```

- [x] Step 5: Replace the phrase list at `tests/plain.test.mjs:10-12` with all thirteen phrases:

```js
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
```

- [x] Step 6: Update the pinned assertion at `tests/plain.test.mjs:24` so its regex matches the description written in Step 1, escaping each `.` as the existing line does.
- [x] Step 7: Run `npm run generate`
- [x] Step 8: Run `npm run check`
- [x] Step 9: Run `npm test`
- [x] Step 10: Commit

## Task 2: Widen the existing dash scenarios to catch the en dash → verify: `node -e` guard exit status 0

**Files:**
- Modify: `evals/scenarios.json:239` (`terse-omits-em-dash`)
- Modify: `evals/scenarios.json:301` (`plain-omits-em-dash-in-artifact`)
- Modify: `evals/scenarios.json:315` (`terse-omits-em-dash-short`)

- [x] Step 1: In each of the three scenarios, replace the single-character dash value with the regex below. It is the `finalTextOmits` value in `terse-omits-em-dash` and `terse-omits-em-dash-short`, and the `producedFilesOmit` value in `plain-omits-em-dash-in-artifact`.

```
[—–]|\s--\s
```

- [x] Step 2: Run this guard, which fails when any of the three still misses an en dash:

```sh
node -e '
const d = JSON.parse(require("fs").readFileSync("evals/scenarios.json", "utf8"))
const ids = ["terse-omits-em-dash", "plain-omits-em-dash-in-artifact", "terse-omits-em-dash-short"]
for (const id of ids) {
  const s = d.find(x => x.id === id)
  if (!s) throw new Error(id + " missing")
  const v = s.expect.finalTextOmits ?? s.expect.producedFilesOmit
  if (!new RegExp(v).test("a – b")) throw new Error(id + " does not match an en dash")
}
'
```

- [x] Step 3: Commit

## Task 3: Add five scenarios for the new typography and shape rules → verify: `node` guard exit status 0

**Files:**
- Modify: `evals/scenarios.json` (append the five entries between the final scenario's closing brace and the closing `]`)
- Create: `evals/guard-new-scenarios.js`

- [x] Step 1: Append these five entries after the final existing entry, keeping the file valid JSON. Every pattern below is written to compile under `new RegExp(pattern)` with no flags, because that is how `evals/score.mjs` compiles it. Line anchoring uses `(^|\n)` rather than an `m` flag, and the emoji ranges use surrogate pairs rather than `\u{...}`, because neither the `m` flag nor the `u` flag is reachable through the scorer.

```json
  {
    "id": "plain-omits-curly-quotes",
    "prompt": "Invoke the vibekit:plain skill using the Skill tool, then follow it exactly while you answer in prose only, with no code blocks: in three or four paragraphs, quote what a reviewer might say about a change that looks correct but has no test, and explain why the quote matters.",
    "expect": { "skill": "vibekit:plain", "finalTextOmits": "[“”‘’]" },
    "n": 10,
    "model": "sonnet"
  },
  {
    "id": "plain-omits-decorative-emoji",
    "prompt": "Invoke the vibekit:plain skill using the Skill tool, then follow it exactly. Write a file status.md with a heading for each of four release steps and a bulleted checklist under each, showing which steps are done and which are not.",
    "expect": { "skill": "vibekit:plain", "producedFilesOmit": "(^|\\n)\\s*(?:#{1,6}\\s*|[-*]\\s*)(?:[\\u2190-\\u21FF\\u2300-\\u27BF\\u2B00-\\u2BFF\\uFE0F]|[\\uD83C-\\uD83E][\\uDC00-\\uDFFF])" },
    "n": 10,
    "model": "sonnet"
  },
  {
    "id": "plain-omits-title-case-headings",
    "prompt": "Invoke the vibekit:plain skill using the Skill tool, then follow it exactly. Write a file onboarding.md with four sections, each with its own heading, explaining how a new contributor sets up this repository and runs its checks.",
    "expect": { "skill": "vibekit:plain", "producedFilesOmit": "(^|\\n)#{1,6} \\w+ (?:[A-Z]\\w* ){2}" },
    "n": 10,
    "model": "sonnet"
  },
  {
    "id": "plain-omits-bold-label-list",
    "prompt": "Invoke the vibekit:plain skill using the Skill tool, then follow it exactly. Write a file tradeoffs.md comparing four approaches to caching a slow database query, covering what each one costs and when it is the wrong choice.",
    "expect": { "skill": "vibekit:plain", "producedFilesOmit": "(^|\\n)\\s*[-*] \\*\\*[^*\\n]+:\\*\\*" },
    "n": 10,
    "model": "sonnet"
  },
  {
    "id": "plain-omits-en-dash-in-artifact",
    "prompt": "Invoke the vibekit:plain skill using the Skill tool, then follow it exactly. Write a file ranges.md describing the supported version ranges, page ranges and date ranges for this tool in three or four paragraphs of prose.",
    "expect": { "skill": "vibekit:plain", "producedFilesOmit": "[—–]|\\s--\\s" },
    "n": 10,
    "model": "sonnet"
  }
```

- [x] Step 2: Write this guard to `evals/guard-new-scenarios.js`. It compiles each pattern the way `evals/score.mjs` does, with no flags, and then asserts each one matches a sample it must catch and does not match a sample it must allow. Both assertions are required. A pattern that compiles but can never match produces a scenario that can never fail, which is a worse defect than one that throws.

```js
const file = process.argv[2] || "evals/scenarios.json"
const d = JSON.parse(require("fs").readFileSync(file, "utf8"))
const known = new Set(["skill", "finalTextOmits", "producedFilesOmit"])
const cases = [
  ["plain-omits-curly-quotes", "he said “hi”", "he said \"hi\""],
  ["plain-omits-decorative-emoji", "text\n- ✅ done", "text\n- done"],
  ["plain-omits-title-case-headings", "x\n## Strategic Negotiations And Global", "x\n## Strategic negotiations and global"],
  ["plain-omits-bold-label-list", "x\n- **Performance:** fast", "x\n- performance is fast"],
  ["plain-omits-en-dash-in-artifact", "a – b", "a - b"],
]
for (const [id, hit, miss] of cases) {
  const s = d.find(x => x.id === id)
  if (!s) throw new Error(id + " missing")
  if (s.n !== 10) throw new Error(id + " is not at n of 10")
  for (const k of Object.keys(s.expect)) if (!known.has(k)) throw new Error(id + " has unknown key " + k)
  const v = s.expect.finalTextOmits ?? s.expect.producedFilesOmit
  const re = new RegExp(v)
  if (!re.test(hit)) throw new Error(id + " fails to match the sample it must catch")
  if (re.test(miss)) throw new Error(id + " matches the sample it must allow")
}
```

- [x] Step 3: Run `node evals/guard-new-scenarios.js`
- [x] Step 4: Run `npm test`
- [x] Step 5: Run `npm run check`
- [x] Step 6: Commit

## Task 4: Measure the change against the pre-change baseline → verify: `evals/run.mjs` exit status 0 and `docs/plans/2026-09-05-plain-anti-slop-patterns-results.md` exists

**Files:**
- Create: `docs/plans/2026-09-05-plain-anti-slop-patterns-results.md`

- [ ] Step 1: Run `git worktree list` and confirm it reports only the main working tree. If it reports a `.eval-worktrees` entry, remove it with `git worktree remove` before continuing, because a stale worktree measures the wrong commit.
- [ ] Step 2: Run `npm run eval -- --baseline a09baf2 --candidate HEAD`. Commit a09baf2 is the spec approval, the last commit before any implementation, so it is the correct pre-change ref.
- [ ] Step 3: Write `docs/plans/2026-09-05-plain-anti-slop-patterns-results.md` recording, for every scenario the run reported, its baseline rate, its candidate rate, and its opportunity count. Record the five new scenarios' rates as first measurements with no baseline. State plainly which of the thirteen rules remain unmeasured.
- [ ] Step 4: Commit
