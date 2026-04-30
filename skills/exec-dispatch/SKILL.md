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
1a. **Verify-clause gate.** The selected task header MUST end with `→ verify: <criterion>`. If absent, vague ("works", "looks right"), or non-checkable, **REJECT the task**: stop the loop, surface the gap to the user, and route back to `plan-write` to repair the plan. Do not dispatch tasks lacking a verify clause.
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
  - Edit ONLY files named in the task's "Files" section. No adjacent edits, no drive-by refactors.
  - Match existing code style; do not "improve" formatting or comments unrelated to the task.
  - Do not delete pre-existing dead code; if you notice some, mention it in OUTPUT.unexpected.
  - Do not install new dependencies or modify package manifests unless the task explicitly says so.
  - The task header's `→ verify:` clause is the success criterion; the task is not done until that criterion is observably met.
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

- [ ] The task's `→ verify:` criterion is observably met (cite the evidence — passing test name, command output, etc.).
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

## Parallelism (parallel-group dispatch)

Default is strictly sequential. Parallelism is **opt-in per group**, signaled by HTML-comment markers in the plan file. Tasks outside any group remain sequential.

### Plan grammar

```markdown
<!-- parallel-group: <name>
     rationale: <one-line justification — why these tasks are independent> -->
### Task K: ... → verify: ...
### Task K+1: ... → verify: ...
### Task K+M: ... → verify: ...
<!-- /parallel-group -->
```

`<name>` is kebab-case. The opening marker carries a `rationale:` line — plan authors must justify why the wrapped tasks are actually independent. `plan-write` is the source of truth for the grammar; `exec-dispatch` parses the markers.

### Parallel-group invariants (enforced before dispatch)

For every parallel group, before fanning out:

1. **Files-disjoint.** Union the "Files" sections of every task in the group. Any file appearing in two tasks' Files lists → REJECT the group, surface to user, halt the loop. Independence is a property of file ownership, not of phrasing.
2. **Verify-clauses present.** Every task in the group has its `→ verify:` clause (already mandatory globally — re-check here).
3. **No ordering dependencies.** Each task's CONTEXT must not reference the output of another task in the same group. If Task B says "after Task A produces X, do Y", they are not parallel.
4. **No shared dependency installs.** No task in the group may modify package manifests (already a per-task constraint; reaffirm here because parallel installs corrupt lockfiles).

If any invariant fails, do not "best-effort" the group. Halt and surface the specific violation; user re-plans.

### Capability-gate (per `_authoring/quad-adapter.md`)

This skill's parallel mode requires: parallel subagent dispatch + per-subagent tool allowlist.

| Runtime | Parallel dispatch | Per-agent allowlist | Behavior on parallel-group |
|---|---|---|---|
| Claude Code | yes (`Task` fan-out) | yes | Native parallel; each task gets its own subagent. |
| Codex | yes (worker panes) | partial | Native parallel; allowlist enforced via brief CONSTRAINTS where per-agent tooling is unavailable. |
| Gemini CLI | **no** | no | **Sequential fallback** in declared task order, with verbatim degradation warning emitted before dispatch (see below). |
| opencode | provider-dependent | yes | Detect at dispatch time; sequential fallback if provider lacks parallel agents, with the same warning. |
| Pi | **no** | no | **Sequential fallback** in declared task order, with verbatim degradation warning emitted before dispatch. |

When the runtime cannot dispatch in parallel, emit this warning **verbatim** before running the group:

> **Capability degraded.** Running on `<runtime>` which lacks parallel subagent dispatch. Parallel-group `<name>` will execute sequentially in declared task order. Result is functionally equivalent; wall-clock will be longer. To opt out of this group entirely on this runtime, remove the `parallel-group` markers in the plan and re-run.

This warning joins the never-compress list. Never paraphrase, trim, or hide it.

### Parallel dispatch procedure (capable runtimes)

For every task in the group, in parallel:

1. **Compile a brief.** Same RTCO template as sequential dispatch. Two additions to CONSTRAINTS:
   - "Tasks running in parallel-group `<name>`: <list of other task numbers in the group>. The files those tasks own are forbidden to this brief."
   - "Do not modify package manifests, lockfiles, or shared global config."
2. **Dispatch a fresh subagent** per task. Each in isolation; no shared scratch space; no awareness of siblings beyond the forbidden-files list.
3. **Receive returns concurrently.** Apply `report-filter` to each return independently. A REJECT on one task does not block the others — they continue.
4. **Two-stage review per task.** Self-review (Gate 1) + plan-compliance review (Gate 2) run independently per task. No batching.
5. **Commit per task.** One task → one or more commits named by the plan. Parallel does NOT compress to one commit — the history stays linear-readable, ordered by completion time.
6. **Group fail-closed.** If any task in the group fails its gates, the whole group is treated as failed. Surface every failed task verbatim to the user; user decides per task: retry, abandon, re-plan. Never silently accept partial group success.
7. **Plan checkbox update.** Mark each task's checkboxes as it lands (independently, as it completes). After all tasks land, commit the plan update with message `chore: complete parallel-group <name>`.

### Sequential fallback procedure (incapable runtimes)

If the capability gate selected sequential fallback:

1. Emit the verbatim degradation warning.
2. Iterate the group's tasks in declared order, each through the standard sequential dispatch loop above (steps 1-7 of the main "Dispatch loop").
3. The "files-disjoint" invariant still holds (and is still checked) — a sequential run of a parallel-group is still semantically the same group; only the wall-clock changes.
4. After the last task lands, commit the plan update with message `chore: complete parallel-group <name> (sequential fallback)`.

### Anti-patterns specific to parallel-group

- Marking tasks as parallel because they "feel independent" without checking Files-disjoint.
- Including a setup/teardown task in a parallel-group. Setup runs *before* the group; teardown runs *after*.
- Letting one task's failure auto-trigger retries on others. Each task's retry is a user decision.
- Hiding the degradation warning to "keep the output clean" on Gemini. The warning is the contract.
- Mixing files in two tasks' "Files" sections and resolving the conflict by editing the brief's CONSTRAINTS to allow it. The plan is wrong; fix the plan.

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
