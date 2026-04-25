---
name: vibe
description: Use when the user says "vibe" or gives a short intent like "add X", "build Y", "fix Z". Runs the full disciplined pipeline end-to-end — brainstorm → plan → isolated execution → verification — with minimal user interaction outside the brainstorm phase. The user only has to answer design questions; every other step is autonomous, guardrail-protected, and token-efficient. If the user does not say "vibe" explicitly, do not assume this skill applies.
---

# vibe

## Overview

One entrypoint that takes a short intent from the user and produces a verified, committed feature. The user talks to the model only during brainstorming; after the spec is approved, the rest is automatic.

This skill is an **orchestrator**. It does not do the work itself — it invokes other skills in order, passing file-based artifacts between them, and enforces the gates between stages.

## When to invoke

- The user types `/vibe <intent>` or says "vibe: <intent>".
- The user asks to build a feature in the shortest possible form ("add a dark mode toggle", "scaffold auth") AND has previously opted into vibe mode.

Do not invoke when:
- The request is a pure question or read-only exploration.
- The user has explicitly asked for a different workflow (inline execution, manual planning).
- There is already an uncompleted vibe run in flight — resume the existing run instead.

## The pipeline

```
user intent
  └─ 1. brainstorm-lean       (Socratic, user answers questions)
          └─ spec file: docs/specs/YYYY-MM-DD-<topic>-design.md, user-approved
  └─ 2. plan-write             (no user interaction)
          └─ plan file: docs/plans/YYYY-MM-DD-<feature>.md, self-reviewed
  └─ 3. confirm execution      (user picks mode: subagent-driven | inline)
  └─ 4. isolate (via isolate skill; worktree preferred, branch fallback)
  └─ 5. exec-dispatch          (no user interaction except on REJECTs / gate failures)
          └─ plan file has all checkboxes marked
  └─ 6. verify-gate            (no user interaction)
          └─ verification report, verdict = ready | not ready
  └─ 7. surface result to user (single message, see §Final message)
```

## Gates (hard)

Between each stage, the orchestrator checks a precondition. Any failure stops the pipeline and surfaces to the user. No silent retries.

- **After brainstorm-lean:** spec file exists, frontmatter key `status: approved`, user approval captured in conversation.
- **After plan-write:** plan file exists, self-review checklist passed, no `TODO` / `TBD` strings in the plan, every plan task has a file list and code blocks, every `### Task N` header ends with `→ verify: <criterion>`.
- **Before exec-dispatch:** user has chosen an execution mode; repo is clean or the user has explicitly authorized the pending changes; isolation (worktree / branch) is in place.
- **After exec-dispatch:** every task in the plan is checked off; every commit referenced in reports resolves; no tasks remain with REJECTs.
- **After verify-gate:** verdict = `ready`. Any other verdict → halt, show blockers.

If any gate fails, do not proceed. Show the user what failed and what they can do.

## User interaction budget

The user is expected to interact in exactly these moments, and only these:

1. Brainstorming clarifying questions (one at a time, Socratic).
2. Approving each design section as it is presented.
3. Approving the written spec via the verbatim gate message.
4. Choosing the execution mode (subagent-driven vs inline).
5. (Optional) Responding to gate failures, REJECTs, or verify-gate blockers.

Anywhere else the user hears from this skill, the orchestrator has a bug.

## Compression policy

Orchestrator-level output is compressed: stage announcements, progress lines, handoffs.

Every artifact produced by a sub-skill is handled per that sub-skill's own policy:

- Spec doc: normal prose (from brainstorm-lean).
- Plan doc: normal prose (from plan-write).
- Subagent briefs: RTCO (compressed framing, verbatim constraints/context/output).
- Subagent reports: schema-validated, evidence verbatim.
- Verification report: evidence verbatim, meta terse.

Do not re-compress artifacts after they are produced. Do not re-interpret them. Pass files, not summaries.

## Announcement format

Each stage begins with a one-line announcement:

```
[1/7] brainstorm
[2/7] plan
[3/7] confirm execution mode
[4/7] isolate
[5/7] exec
[6/7] verify
[7/7] result
```

That is the full progress log. No narration beyond these lines unless a gate fails or a sub-skill asks for input.

## Orchestrator algorithm

```
intent = user message
record vibe_run_id = <timestamp>-<slug(intent)>
announce "[1/7] brainstorm"
  invoke brainstorm-lean(intent)
  gate: spec file exists AND user approved
announce "[2/7] plan"
  invoke plan-write(spec_path)
  gate: plan file exists AND no placeholders
announce "[3/7] confirm execution mode"
  ask user: "subagent-driven (recommended) | inline"
  record choice
announce "[4/7] isolate"
  invoke isolate(spec_path, base_branch = current branch)
  gate: isolate returned a record; subsequent stages use record.path as cwd
announce "[5/7] exec"
  invoke exec-dispatch(plan_path, mode)
  gate: all tasks checked off AND no open REJECTs
announce "[6/7] verify"
  invoke verify-gate(spec_path, plan_path, HEAD)
  gate: verdict = ready
announce "[7/7] result"
  send final message (see §Final message)
```

## Resumability

A vibe run can be interrupted at any gate. To resume:

- Check `docs/specs/` for a recent draft or approved spec for the topic. If `approved`, skip stage 1.
- Check `docs/plans/` for a matching plan. If present and complete, skip stage 2.
- Check the plan for unchecked tasks. Resume exec-dispatch from the first unchecked task.
- If a verification report exists with verdict `not ready`, show it to the user and stop; the user decides whether to re-plan or re-run specific tasks.

Resumption is opt-in by the user. Do not silently resume a stale run.

## Final message

When verify-gate returns `ready`, send this message and stop:

```
vibe: ready.
Spec:  <path>
Plan:  <path>
Verify: <path>
Commits: <first sha>..<last sha> on <branch or worktree>

Next, your choice:
  (a) run the review-pack skill (self-review, then present diff for your sign-off)
  (b) run the finish-branch skill (merge or open a PR)
  (c) stop here; the work is committed and verified.
```

Do not auto-merge, auto-push, or auto-PR. Those are outward-facing actions that require explicit user consent.

## Failure surfaces

When a gate fails, send this message shape:

```
vibe: halted at stage <N/7> — <short reason>.
Details: <path to the artifact that failed, e.g., verification report>
Options:
  (1) <specific remedy>
  (2) <specific remedy>
  (3) abort the run
```

Always give the user a specific remedy, not "try again".

## Anti-patterns

- Auto-retrying a failed stage. Escalate to the user; do not guess the fix.
- Skipping the confirmation of execution mode. The user decides.
- Running verify-gate on an incomplete exec-dispatch. Gates are non-optional.
- Writing prose narration between stages. One-line announcements only.
- Merging or pushing at the end. The pipeline is verify, not ship.
- Re-running brainstorm-lean without the user asking, when they make a small spec clarification. Amend the spec file, do not restart the dialogue from scratch.
- Mixing multiple user intents into one vibe run. One feature per run.

## Output of this skill

Side effects:
- Spec, plan, verification report files committed.
- Commits implementing the feature on the configured branch / worktree.

Terminal user-facing output:
- A single `vibe: ready` message (on success) or a single `vibe: halted` message (on any gate failure).

No structured return value.
