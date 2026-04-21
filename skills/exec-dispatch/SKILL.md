---
name: exec-dispatch
description: Use when executing an approved implementation plan task-by-task. Dispatches one fresh subagent per task using an RTCO brief, receives the return through the report filter, runs two-stage review (self + plan-compliance), and only then marks the task complete and moves on. Prevents context pollution, drift across tasks, and silent regressions.
---

# exec-dispatch

## Overview

Execute an approved plan one task at a time. Each task runs in a **fresh subagent** with no prior conversation history — only the RTCO brief and the plan excerpt. On return, the output passes through schema validation, self-review, and plan-compliance review before the task is marked complete.

One task per agent. One commit per task. No batching.

## When to invoke

After `plan-write` has saved a plan and the user has chosen the subagent-driven execution option.

Do not invoke if:
- No plan file exists.
- The user chose inline execution (a different skill handles that).
- Tasks in the plan are incomplete or contain placeholders — stop, surface the issue.

## Prerequisites

- Plan at `docs/plans/YYYY-MM-DD-<feature-name>.md`, approved.
- Work happens in a dedicated worktree or branch.
- The repo is in a clean state (no uncommitted work that isn't part of this run).

If any prerequisite fails, stop and report what is missing.

## Dispatch loop

For each task in the plan, in order:

1. **Select the task.** Read the plan file. Take the next unchecked task. Copy its full content (files list + all steps) verbatim. Do not paraphrase.
2. **Compile the brief.** Use the RTCO template (see §RTCO brief template). The TASK line names the specific task number and title. The CONSTRAINTS block preserves all TDD discipline. The CONTEXT block includes the plan excerpt and any file:line references the task names. The OUTPUT block declares the exact schema the agent must return.
3. **Dispatch a fresh subagent.** Pass only the compiled brief. No conversation history. No extra instructions.
4. **Receive the return.** Apply the report filter (see §Return-side filter). If validation fails, REJECT and ask the subagent to re-format (never re-run). Three rejections in a row on the same task → escalate to user.
5. **Two-stage review** (see §Review gates).
6. **Mark task complete in the plan** (check the task's boxes) and commit the plan update.
7. **Loop to the next task.**

## RTCO brief template

Every dispatched brief has exactly these sections:

```
ROLE: <specific implementer identity matching the task domain>
TASK: Implement Task N — <task title> — from <plan path>.
CONSTRAINTS:
  - Implement ONLY Task N. Do not touch any other task's files or tests.
  - Follow every step in the task, in order, without skipping or reordering.
  - TDD: write the failing test first and run it to confirm it fails before any implementation.
  - After each code change, run the test command shown in the task and include the last 20 lines of output in your report.
  - Make exactly one commit per logical change, using the commit message shown in the task.
  - Do not modify files outside the ones the task's "Files" section names.
  - Do not install new dependencies or modify package manifests unless the task explicitly says so.
  - If any step fails or produces output that does not match the task's "Expected" value, stop and report the failure. Do not improvise a fix.
CONTEXT:
  Plan path: <path>
  Plan commit SHA: <sha of HEAD for the plan file at dispatch time>
  Task id: Task N
  Instruction: read the plan file at <path> at commit <sha>, locate the section headed `### Task N:`, and follow every step in order. Do not paraphrase the plan; execute it as written.
  Repo state: <branch, worktree, any user-visible constraints>
OUTPUT (return exactly this JSON schema):
  {
    "task_number": <int>,
    "task_title": "<string>",
    "files_created": ["<path>"],
    "files_modified": ["<path>"],
    "tests_added_or_changed": ["<path>"],
    "test_commands_run": [
      {"command": "<string>", "result": "pass|fail", "output_tail": "<last 20 lines verbatim>"}
    ],
    "commits": [{"sha": "<string>", "subject": "<string>"}],
    "unexpected": "<string — anything that deviated from the plan, empty if none>"
  }
```

Every CONSTRAINT is verbatim. Every CONTEXT file path is verbatim. The OUTPUT schema is byte-identical to what the return-side filter will validate against.

**Tool requirement.** Because the plan is embedded by reference at a specific commit SHA, the dispatched subagent needs read access to the git object database — typically `Read`, `Grep`, `Glob`, and a `Bash` allowlist entry for `git show` and `git log`. If your runtime scopes tools per subagent, include those before dispatch, otherwise the agent cannot resolve the plan at the named commit and the task will fail with a permission error rather than a work error.

## Return-side filter

On receiving the subagent's output:

1. **Parse as JSON.** Malformed JSON → REJECT.
2. **Validate required keys.** All keys present, correct types. Missing/wrong type → REJECT with a per-key delta list.
3. **Validate content.**
   - Every `files_created` and `files_modified` path exists on disk after the run.
   - Every `commits.sha` resolves in the repo and matches the `subject`.
   - Every `test_commands_run.output_tail` is preserved verbatim — do not paraphrase, do not trim.
   - `unexpected` is a string (empty if nothing unexpected). Never null.
4. **On REJECT:** send a rejection message naming the specific deltas. Ask the subagent to re-format. Do NOT ask it to re-run the work. Three rejections in a row on the same task → escalate.
5. **On accept:** pass to the review gates.

## Review gates

Two reviews run after the filter accepts the report. Both must pass before the task is marked complete.

### Gate 1 — self-review (runs in the current session)

Check, by reading the report and the actual repo state:

- [ ] Every step listed in the plan task has been performed.
- [ ] Every file named in the plan task's "Files" section appears in `files_created` or `files_modified`.
- [ ] No files outside the task's "Files" section were modified (run `git diff --name-only` against the pre-task state and cross-check).
- [ ] Every test command in the report has `result: pass` in its final run.
- [ ] `test_commands_run.output_tail` contains genuine test runner output (PASS/FAIL line, timing, counts), not a narrative summary.
- [ ] `commits` list matches `git log` for commits added during this task.
- [ ] `unexpected` is empty OR describes a deviation serious enough to surface to the user.

Any unchecked box → stop. Do not proceed to Gate 2.

### Gate 2 — plan-compliance review (dispatched as a fresh subagent)

**Read-only enforcement.** "Read-only" is expressed in the brief's CONSTRAINTS but cannot be enforced by the brief alone. Where the runtime supports tool-allowlisting per subagent, restrict the dispatched agent to read-only tools (Read, Grep, Glob, and git read commands) and omit Edit, Write, and any shell that can mutate the repo. On runtimes without per-agent allowlists, the brief's CONSTRAINTS are the only guard — note this in the run log so users know the limitation.

Dispatch a small, read-only subagent with this brief:

```
ROLE: Plan-compliance reviewer, read-only.
TASK: Verify that Task N in <plan path> was implemented correctly.
CONSTRAINTS:
  - Read-only. No edits, no commits.
  - Base judgment on the actual repo state and the git history, not on the implementer's report.
  - If any step in the plan was skipped, reordered, or implemented differently, flag it.
CONTEXT:
  Plan path: <path>
  Plan commit SHA: <sha of HEAD for the plan file at dispatch time>
  Task id: Task N
  Instruction: read the plan at <path> at commit <sha>, locate `### Task N:`, and compare against the implementer's commits below.
  Implementer commits: <list of sha — subject>
OUTPUT:
  {
    "verdict": "pass|fail",
    "findings": [{"severity": "block|warn", "description": "<string>", "evidence": "<file:line or commit sha>"}]
  }
```

**Verdict = pass + no `block` findings** → task is accepted. Mark the task's checkboxes in the plan. Commit the plan update with message `chore: complete Task N — <title>`.

**Verdict = fail OR any `block` finding** → task is not accepted. Surface the findings to the user and ask whether to:
1. Dispatch a fresh subagent with the findings as additional constraints and re-run the task.
2. Roll back the task's commits and re-plan.
3. Accept the deviation and annotate the plan.

Do not silently retry. Do not silently accept a failing verdict.

## Parallelism

Dispatch in parallel ONLY when the plan explicitly marks tasks as independent (no shared files, no ordering dependency). Default is strictly sequential.

When parallel is safe:
- Each agent gets its own RTCO brief.
- Each agent's CONSTRAINTS block lists the specific files it is permitted to touch, and the files of the other parallel agents as forbidden.
- Reports are filtered independently.
- Gate 2 runs once per completed task, not batched.

## Commit discipline

- One task → one or more commits named by the plan → one plan-update commit marking the task complete.
- Never skip commits to "save time" — the plan uses commits as checkpoints and the review gates use commits as evidence.
- Never use `--no-verify` or `--amend` unless the user explicitly approves.

## Failure modes and recovery

- **Subagent crashes mid-task.** Roll back any partial commits. Re-dispatch the task with a fresh agent.
- **Tests fail unexpectedly.** Stop. Surface to the user with the test output verbatim. Do not have the agent "try to fix it" without an updated plan.
- **Filter rejects 3 times.** Escalate to user. The likely cause is an ambiguous OUTPUT schema or a confused agent — fix the root cause, do not loop.
- **Gate 2 fails.** Offer the three options above. User decides.
- **Plan file has drifted during execution (external edits).** Stop. Ask the user whether to reload the plan.

## Anti-patterns

- Dispatching the same agent twice without refreshing its context. Fresh agent per task.
- Batching multiple tasks into one brief to "save tokens". The cost of a drifted multi-task run is far higher than the saved brief tokens.
- Paraphrasing the plan task into the brief. The task excerpt is verbatim.
- Summarizing test output in the report. Output is verbatim or dropped — never rewritten.
- Skipping Gate 2 because the agent "seemed to do fine". Gates are non-optional.
- Editing the plan mid-run to retroactively match what the agent did. Plan is the contract; changes require going back to plan-write.

## Output of this skill

- The plan file, with completed tasks' checkboxes marked.
- A commit per task (from the agent) + a commit per task-complete marker (from this skill).
- A final summary message to the user when all tasks are complete:

```
All N tasks complete. Plan: <path>. Commits: <first sha>..<last sha>.
Next: run the verify-gate skill to confirm the feature meets the spec.
```

Do not claim done without that final step.
