# Verification Report 3 — plan skill

**Date:** 2026-08-05
**Spec:** `docs/specs/2026-08-05-plan-skill-design.md`
**Plan:** `docs/plans/2026-08-05-plan-skill.md`
**Supersedes:** `2026-08-05-plan-skill-verify-2.md`
**Digest at final measurement:** `69bba206f3d0adcc54ed742a20d1c1e4526397c11b5d721e19d9d4efc7e22fd2`
— identical before and after every run below.

Report 2 reached `ready` on numbers produced by a checker that has since been
corrected three more times, and on a second fixture that turned out to be
invalid. This report replaces those numbers. Verdicts on R-A through R-D, the
non-goals and the constraints are unchanged from Report 1 and not restated.

## Final measurement

| scenario | n | rate | errors |
|---|---|---|---|
| `plan-fires` | 10 | 1.00 | 0 |
| `plan-no-predicted-output` | 5 | 1.00 | 0 |
| `plan-second-spec-shape` | 5 | 1.00 | 0 |

`plan-fires` asserts skill invocation only, so no checker change can affect its
1.00. `plan-second-spec-shape` was 1.00 before the final narrowing, which can
only remove failures. `plan-no-predicted-output` was re-measured under the final
code and returned 1.00 with zero failures.

## What changed since Report 2, and why

Seven defects were found after Report 2. **All seven were in the measuring
apparatus. None was in the skill.**

**Two invalid fixtures.**

- `plan-second-spec-shape` originally seeded a spec whose Approach said rotation
  is "called from the existing write path" into a directory containing only that
  spec. Five of five sessions refused to write a plan and asked a question
  instead. Verbatim, from one of them: *"The spec's Approach says the `rotate`
  function should be 'called from the existing write path,' but this repository
  is empty … I don't want to silently invent a write-path module the spec didn't
  describe."* That is the skill obeying its own rule — a defect in an approved
  spec goes back to the user as a question, never a silent edit. Scored 0.00.
  With the fixture repaired the same scenario scores 1.00.
- The same fixture named no runtime or test runner, the second ambiguity every
  session raised.

**Five checker miscalibrations**, each a false positive on a legitimate clause:

1. Spelled-out counts were invisible (`four` where three existed).
2. Backticks were treated as quotes.
3. `exit` did not match `exits`.
4. Quotes *inside* a backticked command were counted as quoted output —
   `` `node -e "…strictEqual(pkg.type,'module')"` `` was rejected for quotes
   belonging to the command. Fixed by stripping code spans before judging: a
   code span is what you run, prose is what you claim.
5. Prose *about* the rule was read as a clause. A plan documented its own
   compliance — *"one of the three permitted predicate forms"* — and the word
   "three" was scored as a stale count. Fixed by extracting clauses only from
   task headers, which is what the skill's template already specifies.

**One vacuous check.** `tasksHaveVerify` matched `^###\s+Task\s+\d+` while a
real agent-written plan used `## Task 1:`. It found no headers and passed by
`every()` over an empty list. **Report 2's G3 verdict therefore rested on a
check that never ran**, and is corrected here: the matcher now accepts `##`
through `####`, and re-scoring the stored plan finds 3 task headers, 0 missing
clauses.

## Evidence for the goals

- **G1 — fires.** 1.00 at n=10 and again at n=5. Satisfied.
- **G2 — no predicted output.** 1.00 at n=5 under the final checker, zero
  failures. Across every run in this cycle, **no agent-authored plan ever
  contained a predicted transcript**. Every recorded failure was a false
  positive or a missing artefact. Satisfied.
- **G3 — every task carries a clause.** Now measured by a check that can fail:
  the matcher accepts the heading levels agents use, and the stored plan
  re-scores with 3 headers and 0 missing clauses. Satisfied, on stronger
  evidence than Report 2 had.
- **G4 — writes nothing outside `docs/plans/`.** No run ever produced the
  `wrote outside` or `seeded file modified` message. Satisfied, with the
  deletion-blindness limitation from Report 2 unchanged.
- **G5 — smaller than both predecessors.** 135 lines. Unchanged.

## The finding that matters most

Across this cycle the score is **seven defects in the instrument, zero confirmed
defects in the skill**. Every agent-written plan obeyed the rule the skill
states. Every failure the harness reported was the harness being wrong.

Two consequences worth carrying forward:

1. **When a skill eval fails, suspect the probe before the skill.** This
   repository has now been burned by an invalid probe three times — a prompt
   that collided with an unrelated host skill, a spec referencing code that did
   not exist, and a checker flagging its own documentation.
2. **A check that cannot fail is not a check.** `tasksHaveVerify` passed for a
   full cycle without ever running. Any new assertion should be shown failing on
   a deliberately bad input before its passing result is believed.

## Repo-level checks

- `npm test` → exit 0, 150 passing
- `npm run check` → exit 0, `up to date`
- `node --test tests/plan-clauses.test.mjs` → exit 0
- `git status --porcelain`: empty

## Overall verdict

**ready.**

Carried forward, not solved: the follow-through problem (a session that fires
and produces nothing) is no longer observed on either fixture, but the sample is
two spec shapes at n=5–10, not a general claim. The refusal paths are now known
to work — that is what the invalid fixture accidentally demonstrated — but they
are still not asserted by any scenario, because "the spec is ambiguous" is a
judgement, not a predicate.
