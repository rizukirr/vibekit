# Review — vibekit eval harness

**Date:** 2026-08-03
**Spec:** docs/specs/2026-08-03-vibekit-eval-harness-design.md
**Plan:** docs/plans/2026-08-03-vibekit-eval-harness.md
**Verify report:** docs/verifications/2026-08-03-vibekit-eval-harness-verify.md (verdict `ready`)
**Commits under review:** 65b0894..18e7b04 on `vibekit-eval-harness`
**Fixes applied:** 914ce1b, 86de128, 12bb884 — see §Resolution

## Diff summary

- Files changed: 25
- Lines added: 1266, removed: 64
- Commits: 24
- Harness source: **368 lines** across 5 modules; tests: 242 lines across 4 files

## Findings

### Block

**B1. `evals/run.mjs:113-119,163-169` — a run that plans zero sessions reports `PASS` and exits 0.**

`planRuns` can legitimately return an empty array, and nothing downstream treats
that as a problem. `compare({}, ...)` iterates no entries, accumulates no
failures, and returns `{pass: true}`.

Two ordinary typos reach it. Verified live:

```
$ npm run eval -- --scenarios nosuchscenario
0 sessions — est. $0.00-$0.00
candidate: HEAD

results: evals/results/2026-08-04T04-32-54-720Z-HEAD.json
PASS
EXIT=0
```

```
$ npm run eval -- -n abc --dry-run
0 sessions — est. $0.00-$0.00
```

`-n abc` yields `Number('abc')` → `NaN`, and `for (let i = 0; i < NaN; i++)`
never iterates, so every scenario contributes zero runs.

Why this blocks rather than warns: this harness exists to answer "did the skill
fire?", and it answered "PASS" having asked nothing. A green result with no
measurement behind it is the single worst failure mode for a measurement tool —
worse than a crash, because it is silent and it looks like success. It also
**wrote a results file recording that PASS**, so a meaningless result would enter
the committed trend history that spec 3's compression decisions are meant to rest
on.

The verification suite could not catch it: every unit test constructs a non-empty
`runs` array, and the live acceptance run used the real scenario list. The plan's
own premortem worried about the inverse case — a dry run that silently did
nothing — and tightened Task 7's clause to assert the session count is printed.
It is printed. It says `0`. Nobody asserted it must be non-zero.

Fix is small: fail when `runs.length === 0`, and reject a non-numeric `-n` and an
unknown scenario id, in `parseArgs`/`main` rather than letting them degrade to an
empty plan.

### Warn

**W2. `evals/run.mjs:129` — `--judge` spends money and discards the answer.**

```js
if (opts.judge && result.ok) result.judge = judgeTranscript(run.scenario, result.raw, spawnSync)
```

The verdict is attached to the in-memory run object, but `scoreScenario` never
reads it (`grep -n "judge" evals/score.mjs` → no matches), and the results file
persists only `{opts, candidate, baseline, verdict}` where `candidate` is the
scored summary. So a judged run doubles the session count and the cost, and the
grading it paid for reaches neither the console nor the results file.

The spec's goal — "Optionally judge whether a skill was *followed*, not merely
invoked" — is satisfied in the sense that judging happens, which is why
verification passed it. But nobody can read the judgment, which makes the feature
inert in practice. Not a block because it costs money rather than corrupting
results, and because `--judge` is off by default.

**W3. `evals/run.mjs:111-112,152` and `evals/worktree.mjs:6` — the runner only works from the repo root.**

`readFileSync('evals/scenarios.json')`, `mkdirSync('evals/results')` and
`resolve('.eval-worktrees')` are all cwd-relative. Run from a subdirectory, the
harness fails on a missing-file error that does not name the real cause. Every
other entry point in this repo (`bin/generate.mjs`) resolves paths from
`import.meta.url` instead. Undocumented constraint, inconsistent with the
codebase's own pattern.

**W4. `evals/run.mjs:9-12` — `parseArgs` reads the next argv element blindly.**

```js
const value = flag => {
  const i = argv.indexOf(flag)
  return i === -1 ? null : argv[i + 1]
}
```

`--scenarios --judge` silently takes `--judge` as a scenario id; `--candidate`
with no value yields `undefined` → falls back to `HEAD` without complaint. Minor
on its own, but it is the same permissiveness that produces B1.

**W5. `evals/thresholds.json` keys are never validated against `evals/scenarios.json`.**

`compare()` looks up `thresholds.scenarios?.[id]` and falls back to defaults, so a
typo'd threshold key silently applies the default gate instead of the intended
one. A scenario the author believed was pinned at `minFiringRate: 1` would quietly
run at `0.8`.

### Nit

**N1. `evals/run.mjs:95` — `judgeTranscript` re-reads `evals/judge.md` on every call.** Nine judge calls means nine identical file reads. Hoist it.

**N2. `evals/run.mjs:77-79` — `formatPlan` spreads the accumulator inside a reduce**, which is O(n²) in run count. Irrelevant at 9-18 runs, but it is a known anti-pattern sitting in a file that is otherwise clean.

**N3. `evals/worktree.mjs:26` — the deletion guard uses `resolve(path).startsWith(ROOT)`**, so a sibling directory named `.eval-worktrees-old` would pass the prefix test. Unreachable today because `remove()`'s only caller passes paths built by `materialise()`. Carried forward from the previous review; originates in the plan.

## Pass 4 — simplicity

- Harness source: **368 lines** across 5 modules (`parse` 60, `run` 177, `score` 63, `session` 37, `worktree` 31).
- Largest construct: `evals/run.mjs`, 177 lines, of which `main()` is ~60 lines of sequential orchestration.
- Could a senior engineer halve it? **No.** The module split is genuine — parse, score, session and worktree are each single-purpose, pure where they can be, and independently tested. `main()` is long because orchestration is inherently sequential, not because it is doing several jobs.
- The only real shrink available is N2's reduce, which is a few lines.
- No abstraction has a speculative second implementation; no export lacks a caller; no config exists that nothing sets. `DEFAULT_RANGE` has one use but earns it as a named fallback.

`net: -0 lines possible.` **Lean already.**

## Pass 5 — surgical diff

Clean. An independent read-only auditor was run twice — once over
`65b0894..5e83e4e` and again over the full range after Task 10 — and returned
`clean` with zero orphans both times. Every changed file traces to a plan task's
"Files" section; the three mid-run document amendments (875c08a security
hardening, 98cb16c retry-claim correction, ebf7bdb Task 10) were each authorised
before the edit.

## Self-critique (three risks)

1. **The harness reports success without measuring anything.** — unmitigated, and
   confirmed live. This is B1. Follow-up: assert `runs.length > 0` before
   scoring, and reject unknown scenario ids and non-numeric `-n` at parse time.
2. **A paid feature produces output nobody can read.** — unmitigated. This is W2:
   `--judge` grades every transcript and the grade is dropped on the floor.
   Follow-up: thread `judge` through `scoreScenario` into the results file, and a
   test asserting a judged run's results file contains judge data.
3. **The `stream-json` event shape changes and the harness silently scores zeros.**
   — **mitigated.** `parse.mjs` returns `{ok: false, error: 'no result event'}`
   when the shape is unrecognisable, `scoreScenario` reports that as `incomplete`
   rather than a zero rate, and `compare()` fails the run on incomplete. A shape
   change therefore fails loudly. Test: `✔ an unparseable transcript is an error,
   never a silent non-firing run`.

Risks 1 and 2 share a root cause worth naming: **every gate in this project
checked that the harness does the right thing on well-formed input, and none
checked what it does on degenerate input.** The unit tests construct valid
models, the acceptance run used the real scenario list, and verification quoted
both back. B1 needed someone to type a wrong flag on purpose.

## Diff

Run: `git diff 65b0894..18e7b04`

Per-file summary is in §Diff summary.

## Sign-off

- [ ] User reviewed findings.
- [ ] User reviewed diff.
- [ ] User approves proceeding to finish-branch.


---

## Resolution

The user chose `fix` on all findings. Applied as Tasks 11-13, appended to the
plan at ebf7bdb/bf7d824 before any code was written.

| ID | Status | What changed |
|---|---|---|
| **B1** | fixed | `validatePlan()` rejects an empty plan, an unknown scenario id, a non-integer `-n`, and a threshold key naming a scenario that does not exist. Called **before** the dry-run early return, so a typo is caught without spending anything. Re-probed: `npm run eval -- --scenarios nosuchscenario` now prints `vibekit-eval: unknown scenario id(s): nosuchscenario`, exits 1, and writes no results file — `ls evals/results` is byte-identical before and after. |
| W2 | fixed | `scoreScenario` now returns a `judge` block (`graded`, `followedRate`, `meanScore`, `errors`), so the verdict reaches both the console summary and the persisted results file. `judge: null` in both the normal and `incomplete` return branches keeps the shape consistent. Judge errors are counted, never averaged into the score as zeros. |
| W3 | fixed | `evals/run.mjs` and `evals/worktree.mjs` resolve paths from `import.meta.url` via an `at()` helper, matching `bin/generate.mjs`. The git helper pins `cwd` to the repo. Verified: `cd /tmp && node <repo>/evals/run.mjs --dry-run` prints the 9-session plan instead of failing on a missing file. |
| W4 | fixed | `parseArgs` throws when a flag's value is missing or begins with `-`, so `--scenarios --judge` is an error rather than a scenario named `--judge`. |
| W5 | fixed | Threshold keys are validated against scenario ids; a typo'd key is now an error instead of silently applying the default gate. |
| N1 | fixed | The rubric is read once into a module-level cache instead of once per judged session. |
| N2 | fixed | `formatPlan` counts with a `Map` instead of spreading an accumulator inside a reduce. |
| N3 | fixed | The deletion guard uses `path.relative` semantics rather than a string prefix. Verified it rejects a sibling (`.eval-worktrees-old/x`), a traversal (`.eval-worktrees/../../etc`) and an unrelated absolute path (`/tmp`). |

### Post-fix state

- **106 tests pass** (was 98), `fail 0`
- `npm run check` → `up to date`
- Happy path unchanged: `npm run eval -- --dry-run` → `9 sessions — est. $0.18-$0.81`, exit 0
- No worktree or temp directory leaked

### One plan error the implementer caught

Task 12's verify clause said `tests/eval-score.test.mjs` should report `pass 11`.
The file had 9 tests and the task adds 3, so the correct figure is 12. The
implementer reported the discrepancy rather than quietly adding or dropping a
test to match — which is the behaviour the `→ verify:` contract is supposed to
produce, working as intended on a plan-authoring mistake rather than an
implementation one.

### What this round says about the gates

B1 and W2 were both **live-input defects that every prior gate missed**, and they
missed them the same way: unit tests construct well-formed models, the acceptance
run used the real scenario list, and verification quoted both back as evidence.
Nothing in the pipeline typed a wrong flag on purpose until review-pack did.
Worth carrying into spec 3 — a gate that only ever sees valid input cannot
distinguish "works" from "works on the happy path".
