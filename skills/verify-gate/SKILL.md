---
name: verify-gate
description: Use before claiming a feature is done, before merging, and before running any finishing / release skill. Verifies the implementation against the spec using evidence-based checks and three independent self-consistency passes on the question "does this satisfy the spec?". Evidence (test output, diffs, error messages) is quoted verbatim. Silent passes are not allowed — every check must produce evidence or it does not count.
---

# verify-gate

## Overview

Prove the feature is done. Not guess, not assume — prove.

This skill produces a verification report that: (a) lists every spec requirement, (b) names the evidence that each one is satisfied, (c) quotes that evidence verbatim, and (d) reaches a verdict through three independent self-consistency passes. No requirement is marked satisfied without evidence. No evidence is summarized or paraphrased.

## When to invoke

- Immediately after `exec-dispatch` reports all tasks complete.
- Before `finish-branch`, merge, tag, release, or any outward-facing action.
- After a user manually makes changes and asks "is this done?".

## Prerequisites

- An approved spec exists at `docs/specs/YYYY-MM-DD-<topic>-design.md` or a path the user specifies.
- An approved plan exists at `docs/plans/YYYY-MM-DD-<feature>.md`.
- The repo is at the commit the user wants verified. No uncommitted changes unless the user explicitly says otherwise.

If any prerequisite fails, stop and surface what is missing.

## Core principle: evidence before assertion

Every claim in the verification report takes the form:

```
REQUIREMENT: <quoted from spec, exact>
STATUS: satisfied | not satisfied | partial | untestable
EVIDENCE:
  <verbatim quote from test output, git log, file contents, or command output,
   with the source cited as file:line or command-and-date>
```

If the EVIDENCE field cannot be filled with a real, quotable artifact, STATUS is not `satisfied`. No exceptions for "obvious" requirements.

## Never-compress list (verify-gate)

Everything in the verification report that qualifies as evidence is verbatim:

- Test runner output.
- Compiler / linter / type-checker output.
- Error messages and stack traces.
- Diff hunks and file contents.
- Command invocations and their exit codes.
- Commit SHAs and subjects.
- Spec requirement sentences (quoted from the spec file).

Headers, section labels, and meta-narration *can* be terse. Evidence never is.

## Procedure

### Step 1 — enumerate requirements

Read the spec. Extract every testable requirement. Put them in a checklist, each quoted verbatim from the spec. Also include:

- Every explicit non-goal (spec §Non-goals) as a negative requirement: "this must NOT happen".
- Every constraint from the spec §Constraints section.
- Every success criterion from the spec.

If a spec section contains a requirement that is not directly testable (e.g., "the UI should feel responsive"), mark it `untestable` and propose a proxy metric (e.g., "first paint under 200ms on a reference device") that the user can confirm.

### Step 2 — gather evidence

For each requirement, identify and collect:

- Automated tests that exercise it. Run them and capture output verbatim.
- Types / signatures that implement it. Quote the relevant lines.
- Commits that introduced it. List `sha — subject`.
- Commands (build, lint, type-check, integration run) that would fail if the requirement were broken. Run them, capture output.
- For non-goals (negative requirements), evidence that the forbidden behavior is absent — typically a test that asserts absence, or a diff showing no new code touches the forbidden area.

Use the report-filter mindset: drop pleasantries, keep evidence byte-for-byte.

### Step 3 — three self-consistency passes (dispatched)

For each requirement, perform the verdict check **three times**, independently. Independence is enforced by dispatching each pass as a **separate fresh subagent**. In-session reasoning rounds are not a substitute — context leaks between rounds and the first answer anchors the rest.

Dispatch brief per pass:

```
ROLE: Verification pass N of 3 for requirement R-k.
TASK: Decide whether the supplied evidence satisfies the supplied requirement.
CONSTRAINTS:
  - Read-only. No edits, no commits, no external tool calls beyond reading the cited artifacts.
  - Base the decision on the evidence as quoted. Do not consult other requirements, other passes, or external knowledge.
  - If the evidence is insufficient to answer, return `partial` with a one-line reason.
CONTEXT:
  Requirement (verbatim from spec): <quoted sentence>
  Evidence:
    - <artifact ref + verbatim quote>
    - <artifact ref + verbatim quote>
OUTPUT:
  {
    "pass": N,
    "verdict": "yes | no | partial",
    "reason": "<one line; required if verdict is no or partial>"
  }
```

The three passes are dispatched with no shared context, no awareness of each other's verdicts. On each return, collect the three `verdict` values and apply the verdict rule below.

**Cost control for large specs.** Three passes per requirement means 3×N subagent dispatches. At N ≥ ~15 requirements this becomes expensive. Offer the user a *critical-requirements-only* option before dispatching: ask them to tag each requirement as `critical | normal`, run three-pass verification only on `critical` requirements, and run a single-pass verdict on the rest. Non-critical requirements with a single-pass `no` or `partial` still block the overall verdict. Single-pass is weaker evidence, and the report must mark those requirements as such so the user sees the trade.

**Verdict rule:**
- 3 agree `yes` → `satisfied`.
- 3 agree `no` → `not satisfied`.
- 3 agree `partial` → `partial`.
- Any disagreement → `disagreement: escalate`. Do NOT pick the majority. Do NOT hide the disagreement.

Disagreement means the evidence is ambiguous or the requirement is under-specified. Both are user-actionable problems.

### Step 3b — surgical-diff pass (Karpathy principle 3)

After the three per-requirement passes, run **one** additional self-consistency pass on blast radius. Dispatch a separate fresh subagent with this brief:

```
ROLE: Surgical-diff auditor, read-only.
TASK: For every changed file and hunk between <base sha> and HEAD, verify that the change traces to a specific plan task or spec requirement.
CONSTRAINTS:
  - Read-only. No edits.
  - For each changed file, name the plan task whose "Files" section lists it, OR the spec requirement that authorizes it.
  - For each hunk with no traceable origin, report it as an orphan with file:line range.
  - Pre-existing dead code that was deleted without explicit user request is an orphan.
  - Formatting / comment changes unrelated to a task are orphans.
CONTEXT:
  Plan path: <path>
  Spec path: <path>
  Diff command: git diff <base sha>..HEAD
  Files changed: <list from git diff --name-only>
OUTPUT:
  {
    "verdict": "clean | orphans-found",
    "orphans": [
      {"file": "<path>", "lines": "<range>", "reason": "<why no plan/spec match>"}
    ]
  }
```

**Verdict rule:**
- `clean` and zero orphans → recorded as repo-level pass.
- `orphans-found` → hard fail. The overall verdict cannot be `ready`. Orphans are listed in the report's Blockers section verbatim.

This pass is non-optional and is **not** subject to the critical-requirements cost-control opt-out.

### Step 4 — run the repo-level checks

Independent of per-requirement verification, run and record:

```
- Test suite: <command>  →  <exit code>  +  <last 20 lines verbatim>
- Type checker: <command>  →  <exit code>  +  <output tail>
- Linter: <command>  →  <exit code>  +  <output tail>
- Build: <command>  →  <exit code>  +  <output tail>
- git status:  <output verbatim>
- git log --oneline <base>..HEAD:  <output verbatim>
```

Any non-zero exit code is a hard fail. The verdict cannot be `ready` if any repo-level check failed, regardless of per-requirement verdicts.

### Step 5 — write the report

Save to `docs/verifications/YYYY-MM-DD-<feature>-verify.md`. Structure:

```markdown
# Verification Report — <feature>

**Date:** YYYY-MM-DD
**Spec:** <path>
**Plan:** <path>
**Commit verified:** <sha>

## Repo-level checks

- Tests: <pass|fail> — `<command>` → exit <code>
  ```
  <verbatim output tail>
  ```
- Types: ...
- Linter: ...
- Build: ...
- `git status`:
  ```
  <verbatim>
  ```
- Surgical-diff pass: <clean | orphans-found>
  <if orphans-found, list each orphan verbatim>
  - `<file>:<line range>` — <reason>

## Requirements

### R1. <requirement quoted verbatim>
- Passes: yes / yes / yes
- Verdict: satisfied
- Evidence:
  - Test: `tests/...:42` — passed in run above.
  - Commit: `abc1234 — feat: ...`
  - Output:
    ```
    <verbatim>
    ```

### R2. ...

## Disagreements (if any)

For each requirement where the three passes disagreed:

- Requirement: <quote>
- Pass 1: yes — <brief reason>
- Pass 2: no — <brief reason>
- Pass 3: partial — <brief reason>
- Action required: <what the user needs to decide>

## Overall verdict

- **ready** — all requirements satisfied, all repo-level checks pass, no disagreements, surgical-diff pass returned `clean`.
- **not ready** — one or more `not satisfied`, `partial`, `disagreement`, or any orphan from the surgical-diff pass. See list below.

If not ready, list the exact blockers.
```

### Step 6 — surface the verdict

Send the user a short message:

```
Verification report: <path>. Verdict: <ready|not ready>.
<If not ready:>
  Blockers:
  - <one line per blocker>
  Suggested next step: <re-plan | re-run specific task | amend spec>
```

Do not claim `ready` if any repo-level check failed, any requirement is `not satisfied` or `partial`, any disagreement exists, or the surgical-diff pass returned `orphans-found`.

## Anti-patterns

- Claiming a requirement is satisfied with "I checked" as the evidence. "I checked" is not an artifact.
- Paraphrasing test output for brevity. Verbatim or drop; there is no middle.
- Running the three passes back-to-back in the same reasoning thread and letting the first answer anchor the other two. Independent means independent.
- Picking the majority answer on disagreement. Disagreement is a signal, not noise.
- Accepting a non-zero exit code from any repo-level check. No "it's just a lint warning".
- Writing a verdict of `ready` and then adding a caveat. If there is a caveat, it is not ready.

## Failure modes

- **No tests exist for a requirement.** Do not mark it `satisfied`. Either it is `untestable` with a proxy check documented, or it blocks the verdict.
- **A test exists but does not actually test the requirement.** Mark `partial` with evidence that the test's assertions are weak (quote the assertion lines). Escalate.
- **Build broken in an unrelated area.** Still a hard fail for the overall verdict. Surface to user; do not carve out an exception.
- **The spec itself is ambiguous.** Do not resolve ambiguity silently. Record a disagreement and escalate.

## Output of this skill

- A committed verification report at `docs/verifications/YYYY-MM-DD-<feature>-verify.md`.
- A short user-facing verdict message.
- If `ready`: the next skill in the pipeline (review-pack or finish-branch) may proceed.
- If `not ready`: the pipeline halts until the user acts.
