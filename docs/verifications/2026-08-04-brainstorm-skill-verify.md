# Verification Report — brainstorm skill

> **Superseded.** This report's headline conclusion ("extraction is free") is
> wrong; see the correction block under §The headline measurement. The current
> verdict for this feature is in
> `docs/verifications/2026-08-04-brainstorm-skill-verify-4.md`.

**Date:** 2026-08-04
**Spec:** docs/specs/2026-08-04-brainstorm-skill-design.md
**Plan:** docs/plans/2026-08-04-brainstorm-skill.md
**Commit verified:** 90b7ab1 (branch `brainstorm-skill`, base `v2`@6a09641)
**A/B control:** tag `brainstorm-arm-a` at f796649

**Rigor:** critical-requirements-only three-pass, chosen by the user. Seven
requirements received three independent passes; ten received a single pass and
are marked `[single-pass]` — weaker evidence, but a single-pass `no` or `partial`
still blocks the verdict.

## Repo-level checks

- Tests: **pass** — `npm test` → exit 0

  ```
  ℹ tests 108
  ℹ suites 0
  ℹ pass 108
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 197.840278
  ```

- Drift check / build: **pass** — `npm run check` → exit 0

  ```
  up to date
  ```

- Hook smoke test: **pass** — `npm run check:hook` → exit 0

  ```
  ℹ pass 3
  ℹ fail 0
  ```

- Type checker: N/A — no TypeScript in this repo.
- Linter: N/A — none configured (zero dependencies).

- `git status --porcelain`:

  ```
  ```
  (empty)

- Surgical-diff pass: **clean** — zero orphans across all 11 changed files.

### The headline measurement

A live A/B ran 10 real sonnet sessions, 5 per arm:

```
10 sessions — est. $1.00-$4.50
candidate: HEAD
baseline: brainstorm-arm-a
..........
results: evals/results/2026-08-04T13-06-57-173Z-HEAD.json
  brainstorm-precedes-code: rate=1.00 footprint=17962.4 errors=0
PASS
```

| | Arm A (self-contained) | Arm B (extracted) | Δ |
|---|---|---|---|
| firing rate | 1.00 | 1.00 | — |
| input footprint | 18,406 | 17,962 | **−444** |
| output tokens | 713 | 608 | **−105** |
| errors | 0 | 0 | — |
| incomplete | false | false | — |

**Extraction costs no firing rate and saves tokens on both axes.** The modifier
architecture is validated on evidence rather than argument.

> **Correction, 2026-08-04 (commit 6ef25c3).** The sentence above is wrong and
> the table below understates the footprint. A follow-up run measuring whether
> `lazy` itself is ever reached scored **0.00 over 5 sessions on the arm that has
> it**. Cause: `using-vibekit` instructed the agent to "apply them throughout
> rather than invoking them at a moment", so neither modifier was ever invoked
> and neither body ever loaded. The 444-token saving was the cost of not loading
> the extracted content at all.
>
> After the fix, `lazy-reachable` scores 1.00 and the input footprint rises from
> 18,299 to **21,180** — extraction costs roughly 2,900 tokens per session rather
> than saving 444. The modifier architecture still stands, but on
> single-source-of-truth grounds, not on footprint. See
> `evals/results/2026-08-04T15-20-05-729Z-HEAD.json`.

**Measurement integrity:** nothing under `skills/`, `evals/scenarios.json` or
`evals/thresholds.json` changed during or after the paid run. Gate 2 checked that
specifically — a rate of 1.00 obtained by softening a threshold would be
worthless.

## Requirements

### CR1. "Author `brainstorm` into the v2 contract as the pipeline's entry gate, with an observable success criterion: a clean session on 'Let's make a react todo list' invokes it **before** any `Write`, `Edit` or `NotebookEdit`."
- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: `skills/brainstorm/SKILL.md`, 163 lines, `gate: hard` at line 5.
  Scenario `brainstorm-precedes-code` pinned at `minFiringRate: 1`, scored
  `rate=1.00` over 5 live sonnet sessions with `errors=0`.
  The assertion is the strong one — the harness indexes every tool_use block
  monotonically across the stream and fails the run if any tool in `before`
  appears at a lower index than the `Skill` invocation. A skill firing *after* the
  file was written would score 0, not 1.

### CR2. "Author the two modifiers `brainstorm` delegates to — `lazy` and `terse`."
- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: `skills/lazy/SKILL.md` (59 lines) and `skills/terse/SKILL.md` (81
  lines) exist and are registered in the generated trigger table. The delegated
  content is genuinely rehomed, not merely deleted — `Does this need to exist at
  all?` is in `lazy`, `Auto-clarity override` is in `terse`.
  `skills/brainstorm/SKILL.md:13`: ``Apply `lazy` (what you build) and `terse` (how you talk) throughout.``

### CR3. "Reduce its length by **extraction only** — with no behaviour-shaping sentence shortened."
- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: the complete diff from control to HEAD, excluding the two deleted
  blocks, is three lines:

  ```
  +Apply `lazy` (what you build) and `terse` (how you talk) throughout.
  +
  -before proposing anything. The ladder below shortens the solution, never the
  +before proposing anything. The ladder in `lazy` shortens the solution, never the
  ```

  196 → 163 lines, saving 33. Every behaviour-shaping string survives verbatim:
  the HARD-GATE sentence, `Pushback:`, "If something is unclear, stop. Name what
  is confusing. Ask.", "If multiple interpretations exist, present them", "Each
  goal states an observable success criterion", "Spec written and committed to",
  "At least one approach must sit at the laziest rung".

### CR4. "Ship an eval scenario that exercises the `before` ordering assertion, which spec 2 built and no shipped scenario has used."
- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: before this work the three shipped scenarios used only `{}`,
  `{"transcriptContains": …}` and `{"skill": …}`. This is the first use of
  `before`, and it ran live at `rate=1.00`.

### CR5. "The v2 authoring contract: one directory, `SKILL.md` frontmatter is the complete registration."
- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: three directories, each one `SKILL.md`, `name` matching directory,
  all descriptions single-line (the parser rejects folded YAML).
  `npm run check` → `up to date` proves no generated file was hand-edited.

### CR6. "No shipped file may name a project vibekit only borrows from."
- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: grep across `skills/`, `README.md`, `CLAUDE.md`, `AGENTS.md` returns
  nothing. Enforced permanently by `tests/no-external-references.test.mjs`, which
  was **mutation-proven**: appending `ponytail` to `skills/terse/SKILL.md` made it
  fail with

  ```
  AssertionError [ERR_ASSERTION]: skills/terse/SKILL.md references 'ponytail' — vibekit absorbs, it does not depend
  ```

  after which the file was restored byte-identically.

### CR7. "Zero dependencies."
- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: `deps: {} devDeps: {}`, no `node_modules`, no lockfile. The one code
  file added imports only `node:` builtins.

### G4. "Add the three guards v1 lacks." `[single-pass]`
- Verdict: **satisfied** — understand-before-shortening, name-your-confusion (both
  karpathy rules), and observable success criteria in the spec template, all
  present verbatim.

### G5. "Squeeze the `description:` line, since it is always-on." `[single-pass]`
- Verdict: **satisfied** — 143 characters against roughly 390 for the equivalent
  v1 description. The parser's single-line restriction made this mandatory as well
  as desirable.

### G6. "Establish the A/B ladder that the remaining nine skills will follow." `[single-pass]`
- Verdict: **satisfied** — run 1 executed and committed. Run 2 (squeezed vs
  extraction) is defined and deferred to its own branch.

### N1. "The other nine skills." `[single-pass]`
- Verdict: **satisfied** (correctly not delivered) — three skills added; none of
  plan, exec, verify, review, reconcile, finish, debug or writing-skills created.

### N2. "Squeezing `brainstorm`'s procedure prose." `[single-pass]`
- Verdict: **satisfied** (correctly not done) — no procedure prose was reworded.
  This is what keeps run 1 a single-variable experiment.

### N3. "Deleting v1's `brainstorm-lean`." `[single-pass]`
- Verdict: **satisfied** (correctly not done) — v1 lives in the installed plugin
  cache, outside this repository; nothing in the commit range touches it.

### N4. "Changing the eval harness." `[single-pass]`
- Verdict: **satisfied** (correctly not done) — no `evals/*.mjs` file changed. Only
  two data files and one results file produced by running it.

### C1. "Frontmatter values must not contain marker syntax; pipes escaped at render." `[single-pass]`
- Verdict: **satisfied** — generator accepted all three skills; table rows render
  as well-formed three-column rows.

### C2. "The eval scenario costs real money." `[single-pass]`
- Verdict: **satisfied** — the harness printed `10 sessions — est. $1.00-$4.50`
  before spending anything, and the run completed with zero errors.

### C3. "`brainstorm` is `gate: hard`." `[single-pass]`
- Verdict: **satisfied** — `skills/brainstorm/SKILL.md:5`, and the generated table
  row carries `hard`.

### C4. "Repo-level: check clean, tests green, trigger table shows brainstorm hard." `[single-pass]`
- Verdict: **satisfied** — all three confirmed above.

## Disagreements

None. All seven three-pass requirements returned unanimous `yes`; all ten
single-pass requirements returned `yes`.

This is the first of the three verification runs in this project to produce no
`partial` on any requirement. Worth noting *why*, because it is not luck: the
previous two runs' partials were all cases where a spec sentence promised
something the plan never built. This spec's goals were written as observable
criteria — a consequence of the very guard this work adds to the spec template —
and each one had a task that produced evidence for it.

## Overall verdict

**ready**

All 17 requirements satisfied. All repo-level checks pass. No disagreements. The
surgical-diff pass returned `clean` with zero orphans. Ten live sonnet sessions
ran with zero errors.

**The experiment's answer: extraction is free.** Firing rate held at 1.00 on both
arms while the extracted arm used 444 fewer input tokens and 105 fewer output
tokens per session. The modifier architecture can be applied to the remaining nine
skills on evidence.

Two items carried forward, neither blocking:

- `tests/no-external-references.test.mjs` contains a structurally tautological
  assertion — `assert.equal(covered.length, actual.length)` compares two values
  derived from the same `readdirSync` and filter, so it can never fail. The
  non-vacuity guarantee it was meant to provide rests entirely on the adjacent
  `assert.ok(actual.length > 0)`, which is present and holds. Originates in the
  plan, not the implementation.
- Four inaccuracies in the plan's "Expected" prose surfaced during execution and
  were correctly reported rather than worked around: a `wrote .vibekit-manifest`
  line the generator never emits for a `command: false` skill; `wc -l` reporting
  196/163 where the plan said 197/164 (a trailing-newline counting difference the
  plan anticipated); `tail -5` truncating before the assertion line Step 3 asks
  the reader to match; and Step 4 expecting a clean `git status` while the new
  test file is legitimately untracked until Step 5 adds it. None changed
  behaviour; all are plan-authoring defects worth avoiding in the next nine specs.

Next: review-pack, then user sign-off, then finish-branch.
