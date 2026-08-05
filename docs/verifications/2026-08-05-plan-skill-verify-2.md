# Verification Report 2 — plan skill

**Date:** 2026-08-05
**Spec:** `docs/specs/2026-08-05-plan-skill-design.md`
**Plan:** `docs/plans/2026-08-05-plan-skill.md`
**Supersedes:** `2026-08-05-plan-skill-verify.md` (verdict `not ready`, four goals unmeasured)
**Tree digest at measurement:** `f590a0abae48e97dfd50cf65d6da9c8cfd043a0258995e6ff7b4abf46e1b2bc2`
— pinned identical before and after the final run.

Report 1 blocked on G1–G4 because the skill's behaviour was unmeasured. The
evals have now been run. This report covers only what changed: the measurement,
the two harness changes it forced, and the re-verified goals. Report 1's
verdicts on R-A through R-D, the non-goals and the constraints still stand and
are not restated.

## What was measured

Three paid runs, roughly $5 total.

| run | scenario | n | rate | errors |
|---|---|---|---|---|
| `07-29-47` | `plan-fires` | 5 | 1.00 | 0 |
| `07-29-47` | `plan-no-predicted-output` | 5 | 0.80 | 0 |
| `08-32-39` | `plan-no-predicted-output` | 5 | 0.40 | 0 |
| `09-14-59` | `plan-fires` | 10 | 1.00 | 0 |
| `09-14-59` | `plan-no-predicted-output` | 10 | 0.90 | 0 |

Result files are committed under `evals/results/`, including those from the
runs whose numbers were produced by a miscalibrated checker.

## Finding 1 — the checker was wrong, the skill was not

The first run scored `plan-no-predicted-output` at 0.80 and the results file
recorded only the rate. Which rule broke was not stored, so the failure could
not be attributed. That is the harness losing data, which is the one condition
under which this project permits fixing it mid-cycle. Failure-reason capture
was added at `94f0a09`, with a test pinning that every return maps to the
boolean it replaced, so no rate can move.

The re-run then named the failures. All three were identical in kind:

```
non-predicate clause in docs/plans/2026-08-05-slug-command.md: exit status of `node --test test/` is 0
non-predicate clause in docs/plans/2026-08-05-slug-command.md: exit status 0
non-predicate clause in docs/plans/2026-08-05-slug-command.md: exit status 0
```

**Not one was a predicted transcript.** Every failure was the checker rejecting
`exit status 0` — the most natural phrasing of an exit-code predicate. The
allowlist required digits immediately after `exit`, and its status alternative
required three digits for HTTP, so the phrasing fell between both patterns.

This is the fourth miscalibration of the rule in one cycle, after the
spelled-out count, backticks, and `exits` versus `exit`. It is also the
informative outcome the spec named in advance: the design claim — that agents
write predicted transcripts because the template offers a slot for one — is
**not refuted**. Across every agent-authored plan in every run, zero contained a
quoted message or a stale count. What failed was the instrument, not the thing
measured.

The allowlist was widened at `f0c91c5` to accept exit-status phrasings. This is
a checker change made after seeing a result, so on the record: it admits only
clauses that were always predicates. A straight quote still fails on the quote;
a bare or spelled-out number still fails as a count. Both are pinned by
`tests/eval-score.test.mjs` — `isPredicate(' exit status 0 with "fn is not
defined"')` is `false`, and `isPredicate(' exit status 0 and 214 lines')` is
`false`. All three G2 verification passes checked this at source rather than
accepting the commit message.

## Finding 2 — n=5 is underpowered for this metric

`plan-no-predicted-output` scored 0.80, then 0.40 on the next run. The only
code change between them was failure-reason capture, which provably cannot
alter a rate. The movement is run-to-run variance at n=5 on a non-deterministic
model: 4/5 against 2/5.

Neither number should ever be quoted as the skill's rate. The final measurement
was taken at n=10 for this reason, and future scenarios in this repository
should treat n=5 as a smoke test rather than a measurement.

## Finding 3 — the residual failure is follow-through, not rule-breaking

The single failure at n=10 was:

```
no produced file matched ^docs/plans/.*\.md$ (produced: docs/specs/2026-08-05-slug-command-design.md)
```

A session that invoked `plan` and then never wrote the plan file. The seeded
spec was returned unmodified; nothing was written anywhere. This is the
follow-through problem the spec explicitly lists as a non-goal — the same class
as `brainstorm`'s `followed` 0.40 — not a violation of any rule this skill
states. It is carried forward, not solved here.

## Repo-level checks

- Tests: **pass** — `npm test` → exit 0, 139 passing
- Generated surfaces: **pass** — `npm run check` → exit 0, `up to date`
- `git status --porcelain`: empty (clean)
- `git log --oneline 2ae826d..HEAD`: 23 commits
- Surgical-diff pass: **clean**, zero orphans, re-run over the full 23-commit
  range with the auditor asked specifically whether `94f0a09` or `f0c91c5`
  smuggled in anything beyond what their commit messages claim. Neither did.

## Requirements re-verified

### G1. "**`plan` fires when a spec is approved and implementation has not started.** … Rate measured at n=5."

- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: `09-14-59` result file, `plan-fires`: `rate=1.00, successful=10,
  errored=0, failures=[]`. Measured at n=10, exceeding the stated n=5. The
  earlier n=5 run also gave 1.00 with 0 errors.

### G2. "**A plan authored under this skill contains no predicted output.** … Zero hits is a pass."

- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: no failure in any run of any scenario was ever a non-predicate
  clause written by an agent. Pass 1, at source: *"isPredicate still hard-rejects
  any straight quote and any digit/word-number outside the three allowlisted
  forms; f0c91c5 widened only the exit-status entry … the n=10 result file shows
  the sole failure came from expect.fileMatching (no plan produced), not
  verifyClauses, and expect.tasksHaveVerify keeps the clause check
  non-vacuous"*.

### G3. "**Every task carries a `→ verify:` clause stating a predicate.**"

- Passes: single (grouped with G4)
- Verdict: **satisfied**
- Evidence: *"tasksHaveVerify ran on every non-seeded file across all 10
  sessions and never produced its 'task header without a verify clause'
  message; the one failure short-circuited at fileMatching but that session
  wrote no plan file at all … so no verify-clause violation was masked — 9 real
  plans, 0 violations."*

### G4. "**`plan` writes nothing outside `docs/plans/`.** Observable: the session's resulting diff touches exactly one file, in that directory."

- Passes: single (grouped with G3)
- Verdict: **satisfied**, with a stated limitation
- Evidence: *"the file-set check … asserts every post-run file is either an
  unmodified seed or matches `^docs/plans/`, which covers creation and
  modification (the only writes a Bash-less session can make) and fired clean in
  all 10 sessions … the sole gap versus a literal diff is deletions of
  pre-existing files, a limitation explicitly recorded at
  docs/plans/2026-08-05-plan-skill.md:29."*

## Method deviations, declared

Report 1's three deviations stand. Two more here:

4. **G3 and G4 received a single grouped pass**, not three independent ones
   each. Both are mechanical subsets of the same scenario output that G2 was
   verified against at three passes; neither is load-bearing alone. Still weaker
   evidence than the gate specifies.
5. **Two harness changes were made after seeing results.** `94f0a09` is
   justified as fixing demonstrable data loss and is rate-neutral by
   construction. `f0c91c5` is a genuine post-hoc widening of the checker and is
   the one item in this report a reviewer should scrutinise hardest. Its
   defence is that it strictly loosens a check that was producing only false
   positives, that it cannot admit a predicted transcript, and that the claim is
   pinned by tests — not that it was harmless in principle.

## Disagreements

None. All dispatched passes were unanimous across both reports.

## Overall verdict

**ready.**

All five goals satisfied, all constraints and non-goals satisfied, all
repo-level checks green, surgical-diff clean, no disagreements.

Carried forward, not solved:

- Follow-through: 1 session in 10 invoked `plan` and wrote nothing. Same class
  as `brainstorm`'s 0.40. Untouched by this spec, by design.
- The rule has now been miscalibrated four times in one cycle. Every correction
  loosened it, and every defect it was built to catch was found by a human or a
  reviewer rather than by the checker. `tests/plan-clauses.test.mjs` closes the
  mechanical subset going forward; the rest remains prose.
