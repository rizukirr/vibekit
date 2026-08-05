# Review — plan skill

**Date:** 2026-08-05
**Spec:** `docs/specs/2026-08-05-plan-skill-design.md`
**Plan:** `docs/plans/2026-08-05-plan-skill.md`
**Verify report:** `docs/verifications/2026-08-05-plan-skill-verify-2.md` (verdict `ready`)
**Commits under review:** `2ae826d..042c3fb` on `plan-skill`

## Diff summary

- Files changed: 17
- Lines added: 1322, removed: 55
- Of which code (`evals`, `skills`, `tests`): 10 files, +655 / -11
- Commits: 23

## Findings

### Block

None.

### Warn

- **W1 — the checker was widened after seeing a result.** `f0c91c5` relaxed
  `ALLOWED_NUMERIC` following three measured false positives. Declared in the
  verify report as the item to scrutinise hardest, and repeated here so it is
  not buried: the defence is that it strictly loosens a check that was producing
  only false positives, cannot admit a predicted transcript, and is pinned by
  `tests/eval-score.test.mjs` — not that post-hoc changes are acceptable in
  general. A reviewer who disagrees should reject on this point.

- **W2 — spec-shape diversity is n=1.** Both scenarios seed the same fixture,
  `docs/specs/2026-08-05-slug-command-design.md` (`evals/scenarios.json`), a
  small single-function spec. The measured 1.00 / 0.90 say nothing about how
  `plan` behaves on a spec that decomposes into subsystems, or one with a
  requirement that has no possible verify clause — both of which the skill has
  explicit refusal paths for (`skills/plan/SKILL.md:33-42`). Those paths are
  entirely unexercised.

- **W3 — `collectFiles` caps per-file size but not aggregate.**
  `evals/session.mjs:25-43` skips `node_modules`, `.git`, and any file over
  256 KB, then reads everything else into one object. A session writing many
  medium files stays under every guard and still exhausts memory. Low
  likelihood — Bash is disallowed, so only Write/Edit can produce files — but
  the mitigation named in the plan's Premortem is per-file, and the risk is
  aggregate.

### Nit

- **N1 — three exports have no external consumer.** `seedFiles` and
  `collectFiles` (`evals/session.mjs:11,25`) and `unsatisfiedReason`
  (`evals/score.mjs:67`) are exported but referenced only within their own
  module; the tests exercise them through `runSession` and `scoreScenario`.
  `yagni:` drop the `export` keyword, or import them directly in tests to make
  the seam real. Not `block` — each has an internal caller and test coverage
  through its wrapper.

- **N2 — `RULE_FROM` is a filename date.** `tests/plan-clauses.test.mjs` scopes
  the guard with `f.slice(0, 10) >= RULE_FROM`. A plan whose filename is
  backdated is silently skipped rather than flagged. Acceptable for a
  convention-driven directory; worth knowing it is a convention and not an
  enforcement.

## Pass 4 — simplicity

Largest new construct: `unsatisfiedReason`, 72 lines (`evals/score.mjs:67-138`).
It replaced a 65-line `satisfied` predicate, so the net growth is roughly seven
lines for the failure messages — and those messages are what turned an
unattributable 0.80 into a named false positive that changed the design. The
body is a flat sequence of independent expectation checks with no shared state;
collapsing it into a table-driven loop would trade seven lines for indirection
over eight heterogeneous checks.

`shrink:` candidates considered and rejected: none change the line count
materially without obscuring which expectation produced which message.

`net: -3 lines possible.` (N1: three `export` keywords.) Otherwise lean.

## Pass 5 — surgical diff

Clean. Independently audited twice by a dispatched read-only auditor over the
full 23-commit range, the second time with an explicit instruction to check
whether `94f0a09` or `f0c91c5` smuggled in anything beyond their commit
messages. Verdict `clean`, zero orphans, both times.

One orphan was found and fixed during the run: `794bbc0` flipped three `- [ ]`
lines to `- [x]` inside the fenced SKILL.md template embedded in the plan.
Fixed at `f88b73c`; the embedded copy is byte-identical to
`skills/plan/SKILL.md`.

## Self-critique (three risks)

1. **The fence tracker mis-parses an exotic fence and silently skips real
   clauses.** `verifyClauses` (`evals/score.mjs:35-49`) recognises only
   backtick fences of three or more, tracking depth. A `~~~` fence, or an
   unbalanced fence, leaves `depth` in the wrong state and the checker reports
   clean on a file it never scanned. No test covers tilde fences or an unclosed
   fence. — *Follow-up test:* assert `verifyClauses` on a document with a `~~~`
   block and on one with an unclosed fence, pinning the intended behaviour
   either way.

2. **A clean rate hides that the skill refused rather than complied.** The
   scenario asserts a plan file appears and its clauses are predicates. A
   session that writes a minimal one-task plan to satisfy the shape, while
   ignoring most of the spec, scores identically to a good one. Nothing measures
   plan *quality* against the spec it came from. — *Mitigation:* none in the
   diff. The judged `followed` metric exists in the harness and was not used
   here.

3. **The measured numbers came from one model and one prompt phrasing.** Both
   scenarios run `sonnet` with an identical prompt string. A phrasing that names
   the spec less explicitly, or a different model, could change firing
   materially — this repository has already had one scenario score 0.40 purely
   because its prompt collided with an unrelated host skill. — *Mitigation:*
   partial. The prompt names the artefact and points at an in-project path, per
   the spec's constraint, which is what that earlier failure taught.

## Diff

Run `git diff 2ae826d..042c3fb` to read it in full. Summary above; no hunk in
the range lacks a traceable origin.

## Resolution — 2026-08-05

All three warns and both nits addressed. Suite 144 passing, `npm run check`
exit 0.

- **W1 — fixed by making the claim checkable rather than argued.** The defence
  of `f0c91c5` rested on reasoning, because the eval session directory is
  deleted before anyone can inspect the plan that failed. `scoreScenario` now
  stores `failedArtifacts`: the produced non-seeded files for every failing run,
  each capped at 20,000 characters, seeded fixtures excluded. A disputed false
  positive can now be re-read from the committed results instead of argued
  about. Two tests pin it, including one asserting passing runs and seeded
  fixtures are *not* stored. The post-hoc widening itself stands as recorded —
  this fixes the reviewability of such a change, not its history.

- **W2 — partly fixed, and the remainder is recorded rather than closed.** A
  second scenario, `plan-second-spec-shape`, seeds a differently-shaped spec (a
  log-rotation design with three goals, two non-goals, and a concurrency
  constraint) through the same four expectations. That addresses the literal
  complaint: spec-shape diversity is no longer n=1. It does **not** exercise the
  two refusal paths, and I could not find a mechanical assertion for them — "the
  spec spans subsystems" and "this requirement has no possible verify clause"
  are judgements, not predicates, and asserting them needs the judge. Left open
  deliberately, with the reason stated, rather than closed with a weak
  assertion. The new scenario is committed and **not yet run**.

- **W3 — fixed.** `collectFiles` now tracks an aggregate ceiling
  (`MAX_TOTAL_BYTES`, 8 MB) alongside the per-file cap, stops collecting when it
  is reached, and reports `filesTruncated` on the run. Tested with 40 files of
  250 KB each — every one under the per-file guard, 10 MB together — asserting
  both the flag and the bound.

- **N1 — fixed.** `seedFiles`, `collectFiles` and `unsatisfiedReason` are no
  longer exported; `evals/session.mjs` is down to one export.

- **N2 — fixed.** `tests/plan-clauses.test.mjs` pins the skipped set to exactly
  the three plans that predate the rule. A backdated filename now fails the
  suite instead of silently escaping the guard.

## Post-resolution measurement — 2026-08-05

Running the fixes surfaced seven further defects, **all in the measuring
apparatus, none in the skill**: two invalid fixtures, five checker false
positives, and one check (`tasksHaveVerify`) that had passed vacuously for the
whole cycle because it matched only `###` headings while real plans used `##`.
Full account in `docs/verifications/2026-08-05-plan-skill-verify-3.md`.

Consequences for this review's findings:

- **W2 is now closed**, not partly closed. The second fixture was invalid — it
  referenced code that did not exist — which is why it scored 0.00. Repaired, it
  scores 1.00. Spec-shape diversity is real and both shapes pass.
- **W1's fix proved its worth immediately.** `failedArtifacts` plus the newly
  added `failedFinalText` are what identified the invalid fixture: the stored
  agent replies said in plain words that the spec referenced a write path that
  did not exist.
- **A new finding, recorded rather than fixed:** the refusal paths are now known
  to work — the invalid fixture demonstrated them accidentally, five times out
  of five — but no scenario asserts them, because "the spec is ambiguous" is a
  judgement, not a predicate.

Final measured state, one checker version, digest identical either side:
`plan-fires` 1.00 (n=10), `plan-no-predicted-output` 1.00 (n=5),
`plan-second-spec-shape` 1.00 (n=5).

## Sign-off

- [ ] User reviewed findings.
- [ ] User reviewed diff.
- [ ] User approves proceeding to finish-branch.
