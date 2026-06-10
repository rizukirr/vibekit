---
name: debug-recovery
description: Use when a verification or test fails and you need a disciplined response instead of guessing — fires as vibekit's pipeline failure branch (verify-gate not-satisfied, exec-dispatch test/build failure) and standalone when the user reports a bug, failing test, or broken build. Finds and proves a root cause with verbatim evidence, then routes the fix through exec-dispatch or plan-write. Never edits code itself.
---

# debug-recovery

Follows: PEG (root-cause triage) + Karpathy (Think Before Coding, Goal-Driven) + Quad-Adapter (capabilities: fresh-context subagent dispatch).

## Overview

The vibe pipeline models the happy path. This skill is what runs when something **fails**. It stops the line, preserves evidence, finds and *proves* a root cause, then hands the fix to the existing gates. It never edits code — diagnosis is the product.

A confident guess is not a root cause. Every diagnosis here is backed by verbatim evidence, exactly as `verify-gate` demands of verifications.

## When to invoke

- **Pipeline failure branch:** `verify-gate` returns a `not satisfied` or `partial` requirement, OR an `exec-dispatch` subagent report contains a failing test (`result: fail`) or a broken build.
- **Standalone:** the user says "debug this", "why is this failing", or names a failing test, error, stack trace, or broken build outside a vibe run.

**Precedence:** debug-recovery fires *after* `verify-gate` or `exec-dispatch` has already produced a failure — it consumes that failure, it does not compete with those skills and never pre-empts a passing `verify-gate`. A passing gate routes onward (review-pack); only a failing one routes here.

Do NOT invoke for:
- A feature that is working but slow or ugly — that is not a failure.
- Applying a fix you already understand with certainty under a normal plan — route straight to `exec-dispatch`/`plan-write`.
- Diagnosing a runtime/host bug rather than the code under test.

## Core principle: evidence before diagnosis

No requirement, hypothesis, or root cause is asserted without a real, quotable artifact. If you cannot quote the error, the failing test output, or the offending line, you do not yet have a diagnosis — you have a guess. Guesses do not get routed.

## Stop-the-line procedure

```
1. STOP        — no new features, no speculative edits
2. PRESERVE    — capture error/log/repro VERBATIM (never-compress)
3. REPRODUCE   — make the failure happen reliably; if not, document conditions
4. ISOLATE     — binary-search the diff/change history to the smallest culprit
5. HYPOTHESIZE — name the root cause as a falsifiable claim + supporting evidence
6. CONFIRM     — dispatch ONE fresh read-only subagent to refute the root cause
7. ROUTE       — small fix → exec-dispatch brief; structural → plan-write
8. GUARD       — the routed fix MUST include a regression test that fails pre-fix
```

Steps 1–5 run in this session — debugging is a stateful narrowing search, where each step depends on what the last one ruled out. Step 6 is the single dispatched confirmation. Step 7 hands off; this skill writes no code. Step 8 is a constraint carried into the routed brief or plan.

**Re-hypothesis bound:** if step 6 refutes the root cause, return to step 5. After 3 refuted cycles on the same failure, stop and escalate to the user with everything ruled out so far. Do not loop indefinitely.

### Step 4 — isolate, in practice

When the failure followed a change, binary-search the history rather than reading every line:

```
git bisect / git log --oneline  — find the first bad commit
git diff <last-good>..<first-bad> — narrow to the offending hunk
```

When there is no obvious change (intermittent / environmental), widen the race window: add timestamped logging around the suspected area, run under load, or run repeatedly to raise collision probability. Document the conditions if it stays non-reproducible — a `status: unreproducible` report is a valid outcome.

## Confirmation dispatch

Step 6 dispatches exactly one fresh, read-only subagent. Compile it through `brief-compiler`; process its return through `report-filter`. The brief:

```
ROLE: Root-cause confirmation reviewer, read-only.
TASK: Try to REFUTE that <root_cause> is the cause of <failure>.
CONSTRAINTS:
  - Read-only. No edits, no commits.
  - Default to refuted=true if the evidence is not conclusive.
  - Base judgment on repo state + the cited evidence, not the diagnosis narrative.
CONTEXT:
  Failure: <verbatim error/test output>
  Claimed root cause: <falsifiable claim>
  Evidence: <file:line refs, diff hunks, repro steps>
OUTPUT:
  { "refuted": true|false, "reason": "<string>", "evidence": "<file:line or output>" }
```

`refuted: true` → return to step 5 (within the 3-cycle bound). `refuted: false` → proceed to route.

## Diagnosis report schema

The product of this skill. Returned through `report-filter` when fired inside the pipeline; surfaced to the user when standalone.

```json
{
  "status": "diagnosed | unreproducible | escalate",
  "failure": "<verbatim error/symptom>",
  "reproduction": "<exact steps/command, or why not reproducible>",
  "root_cause": "<falsifiable claim>",
  "evidence": ["<file:line or verbatim output>"],
  "confirmation": {"refuted": false, "reason": "<string>"},
  "fix_route": "exec-dispatch | plan-write",
  "guard_test": "<the regression test the fix must add>"
}
```

## Routing the fix

Once `status: diagnosed` and `confirmation.refuted: false`:

- **Small, local fix** (a single function/file, no interface change) → route to `exec-dispatch`: hand it a one-task brief whose CONSTRAINTS carry the `guard_test` (the regression test that must fail pre-fix and pass post-fix).
- **Structural fix** (crosses a module boundary, changes an interface, needs design) → route back to `plan-write`: the diagnosis becomes the problem statement for a new plan.
- **`status: unreproducible`** → surface conditions to the user; do not route a fix into the dark.
- **`status: escalate`** (3 refuted cycles) → surface everything ruled out and let the user decide.

This skill never edits code, never commits a fix, and never marks a failure resolved on its own — the routed gate does that.

## Never-compress list

Verbatim, always: error messages, stack traces, test runner output, reproduction commands, diff hunks, the confirmation verdict's evidence, and the routing/escalation message to the user.

## Runtime capability gate

This skill needs: one fresh-context subagent dispatch (step 6).

| Runtime | Fresh dispatch | Fallback |
|---|---|---|
| Claude Code | yes | n/a |
| Codex | yes | n/a |
| opencode | yes (provider-dependent) | n/a where present |
| Gemini CLI | no | in-session fresh-prompt self-refutation with a hard separator, flagged degraded |
| Pi | no | same degraded fallback |

On a runtime lacking fresh dispatch, print this warning verbatim before degrading:

> **Capability degraded.** Running on `<detected runtime>` which lacks `fresh-context subagent dispatch`. Falling back to `in-session self-refutation with hard separator`. Output may differ from a fully-supported run; the root-cause confirmation is not independent.

Then continue with the fallback — never silently skip step 6.

## Anti-patterns

- Patching a symptom before isolating the cause. → Wrong. Run the procedure; the cause is what gets routed.
- Routing a fix on an unconfirmed hypothesis. → Wrong. Step 6 must return `refuted: false` first.
- Editing code "while you're in there". → Wrong. This skill diagnoses; the gate fixes.
- Dropping the verbatim error to "summarize the bug". → Wrong. The evidence is the diagnosis.
