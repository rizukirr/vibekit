---
name: ralph-loop
description: Use to drive a vibe run autonomously across multiple iterations until verify-gate returns `ready` — bounded by iteration / wallclock / commit budgets, halted on thrashing or genuine ambiguity. Same verification gates as a single vibe run; never bypasses review-pack sign-off. Cross-runtime portable with degraded fallback on runtimes lacking native loops.
---

# ralph-loop

A bounded persistence wrapper around `vibe`. Keeps re-invoking the pipeline on `not ready` verdicts, classifying each blocker into retry / re-plan / escalate, until either `verify-gate` returns `ready` or a budget / halt condition is hit.

ralph-loop adds **zero new shortcuts**. The same `verify-gate` evidence-based check, the same surgical-diff pass, the same three self-consistency passes per requirement, the same `review-pack` sign-off gate. ralph-loop does not lower the bar; it removes the manual click between iterations.

## When to invoke

- The user wants to walk away from a long verify-fix cycle ("don't bother me unless it's actually stuck").
- The feature has a clear spec, a clean plan, and the failure modes are likely mechanical (test diffs, missing edge cases, predicted-output mismatches).
- Wall-clock matters more than tokens for this run.
- CI-style runs that should attempt full closure before paging a human.

Do NOT invoke for:
- Trivial changes — wrapping a 5-minute task in a loop is overhead with no benefit.
- Genuinely novel design work — most iterations would classify as `escalate`. Use `/vibe` directly.
- Runs where the user wants to read each gate failure and decide manually. ralph-loop is the *autonomous* path; that's a different intent.

## Prerequisites

- A `vibe` run is set up or about to start. ralph-loop wraps `vibe`; it does not replace its prerequisites.
- Spec exists and is approved (or the loop will start with `brainstorm-lean` like a fresh `/vibe`).
- The repo is in a clean state or the user has authorized the pending changes.

## Runtime capability gate

Required capabilities: native loop primitive + background tasks. Per `_authoring/quad-adapter.md`:

| Runtime | Native loop | Background tasks | Behavior |
|---|---|---|---|
| Claude Code | yes (`/loop` skill) | yes (`run_in_background`) | Native autonomous loop. |
| Codex | yes (`ralph` via OMC-codex) | yes | Native autonomous loop. |
| Gemini CLI | **no** | **no** | **Degraded checkpoint mode**: at every iteration boundary the skill prints a verbatim resume prompt and halts. User runs `/ralph-loop --resume <run-id>` to continue. State persists; only the autonomy degrades. |
| opencode | **no** | varies | Same degraded checkpoint mode as Gemini. |
| Pi | **no** | **no** | Same degraded checkpoint mode as Gemini. |

When degraded, emit this warning **verbatim** before the first iteration:

> **Capability degraded.** Running on `<runtime>` which lacks native autonomous loops. ralph-loop will execute one iteration, then halt at the boundary and print a resume prompt. Run `/ralph-loop --resume <run-id>` to continue. State is preserved between resumes; nothing is lost — only the autonomy. To opt out, halt this loop and use `/vibe` directly.

This warning joins the never-compress list.

## State file

Per run, one JSON document at `.vibekit/ralph/<run-id>.json`. The loop reads/writes this file at every iteration boundary so a crashed loop can resume rather than restart.

```json
{
  "run_id": "<timestamp-slug>",
  "intent": "<verbatim user intent>",
  "started_at": "<ISO 8601>",
  "spec_path": "<path or null>",
  "plan_path": "<path or null>",
  "branch": "<branch or worktree>",
  "budgets": {
    "max_iterations": 5,
    "max_wallclock_seconds": 3600,
    "max_commits": 30
  },
  "iterations": [
    {
      "n": 1,
      "started_at": "<ISO>",
      "ended_at": "<ISO>",
      "verify_verdict": "ready | not_ready",
      "verify_report": "<path>",
      "blockers": [
        {
          "verbatim": "<from verify-gate>",
          "classification": "retry-task | re-plan | escalate",
          "reason": "<one line>",
          "routed_to": "exec-dispatch | plan-write | user"
        }
      ],
      "commits_added": ["<sha>", ...],
      "critic_verdict": "progressing | thrashing | indeterminate",
      "critic_evidence": "<one line>"
    }
  ],
  "halt": null | {
    "kind": "ready | budget_exceeded | thrashing | block_finding | escalate | user_cancel",
    "detail": "<verbatim>",
    "halted_at": "<ISO>"
  }
}
```

The state file is **append-only** within a run — new iterations push onto `iterations[]`, never overwrite. Hand-editing is OK as a recovery path; `audit` will detect drift on the next run.

## Operations

### `start --intent <T> [--max-iterations N] [--max-wallclock S] [--max-commits C] [--critic-mode N]`

Begin a new ralph-loop run. Defaults: iterations=5, wallclock=3600s (1h), commits=30, critic-mode=consecutive (see below).

If `<intent>` is a fresh idea, ralph-loop invokes `/vibe <intent>` for iteration 1, which runs the full pipeline including `brainstorm-lean`. If the intent points to an existing approved spec or in-flight plan, ralph-loop resumes from the appropriate stage.

### `resume --run-id <id>`

Continue an existing run. Reads the state file, replays the budget check, dispatches the next iteration. On a degraded runtime this is the user-facing way to advance the loop one step at a time.

### `status [--run-id <id>]`

Read the state file and surface a one-screen summary verbatim:

```yaml
run_id: <id>
intent: "<verbatim>"
iterations_done: <n>
last_verdict: <ready | not_ready | none>
budgets_remaining:
  iterations: <n>
  wallclock_seconds: <n>
  commits: <n>
last_critic: <progressing | thrashing | indeterminate>
halt: <null or halt block>
```

### `cancel --run-id <id> --reason <R>`

User-initiated halt. Writes a `halt: {kind: user_cancel, detail: <R>}` block to state. Does NOT roll back commits — the user decides cleanup separately.

## Loop algorithm

```
load state (or create from `start` arguments)

loop:
  if budget_exceeded(state) → halt(kind=budget_exceeded) and exit
  if state.halt is not null → exit (already halted)

  iteration_n = next_iteration_number(state)
  emit "[ralph-loop] iteration <n>/<max_iterations>"

  invoke vibe-or-resume:
    - if no spec yet → /vibe <intent>
    - if spec approved but no plan → invoke plan-write(spec_path)
    - if plan exists with unchecked tasks → invoke exec-dispatch(plan_path) for the unchecked subset
    - if all tasks checked → invoke verify-gate

  collect verify_report and verdict

  if verdict = ready:
    invoke review-pack
    if review-pack returns yes → halt(kind=ready) and exit success
    if review-pack returns fix → record fix items as blockers, classify as retry-task, route, continue
    if review-pack returns abort → halt(kind=user_cancel) and exit
    if review-pack returns yes-blocked-by-block-finding → halt(kind=block_finding) and exit

  if verdict = not_ready:
    blockers = parse(verify_report)
    for each blocker:
      classification = classify(blocker)   # see §Classifier
      if classification = escalate → halt(kind=escalate, detail=blocker) and exit

    route the routable blockers:
      - retry-task: re-dispatch the failed tasks via exec-dispatch with blockers as added CONSTRAINTS
      - re-plan: route back to plan-write with blockers as new requirements; new plan; new exec; next verify

  dispatch critic (read-only subagent, see §Thrashing critic)
  if critic verdict = thrashing → halt(kind=thrashing) and exit

  append iteration record to state, write state file
  if degraded_runtime → print resume prompt verbatim and exit (user resumes)
  else → continue loop
```

## Classifier

A read-only subagent dispatched per blocker. Brief:

```
ROLE: Blocker classifier, read-only.
TASK: Decide how to route a verify-gate blocker.
CONSTRAINTS:
  - Read-only. No edits.
  - One of three outputs: retry-task | re-plan | escalate.
  - retry-task = the implementation diverged from the plan; a fresh subagent should re-attempt the named task with this blocker as added CONSTRAINTS.
  - re-plan = the architecture or spec is wrong; the plan needs new tasks. Route back to plan-write.
  - escalate = the blocker is genuinely ambiguous (spec under-specified; verify-gate's three passes disagreed; intent missing). Halt and surface to user.
  - When in doubt, prefer escalate. False retries are cheap; false escalations are also cheap; false re-plans are expensive.
CONTEXT:
  Blocker (verbatim from verify-gate): <quoted>
  Plan path: <path>
  Spec path: <path>
OUTPUT:
  {
    "classification": "retry-task | re-plan | escalate",
    "reason": "<one line>",
    "routed_to": "exec-dispatch | plan-write | user"
  }
```

The classifier is itself bound by the same Karpathy discipline as the rest of vibekit — surgical, evidence-based, refuses to guess. "When in doubt, escalate" is the safety hatch that keeps the loop honest.

## Thrashing critic

After every iteration, a separate read-only subagent reads the iteration history and answers one question: is the loop closing blockers, or are the same blockers reappearing?

```
ROLE: Thrashing critic, read-only.
TASK: Decide whether the loop is making forward progress.
CONSTRAINTS:
  - Read-only.
  - Compare the most recent N iterations' blocker lists. Two blockers "match" if their verbatim text overlaps ≥80% OR they cite the same file:line OR they cite the same requirement R-k.
  - progressing = each iteration's blocker set is meaningfully different from the previous; net count trending down or shifting domains.
  - thrashing = the same blockers (or near-duplicates) reappear across N iterations; net count flat or rising.
  - indeterminate = fewer than N iterations exist OR the evidence is genuinely mixed.
CONTEXT:
  N = 3 (configurable via --critic-mode)
  Iteration history: <iterations[].blockers JSON>
OUTPUT:
  {
    "verdict": "progressing | thrashing | indeterminate",
    "evidence": "<one line — name the matched blockers or the trend>"
  }
```

`thrashing` halts the loop. `indeterminate` does not (loops still under N iterations are not thrashing yet). `progressing` continues.

## Halt conditions (loop refuses to continue)

| Halt kind | Trigger | Final action |
|---|---|---|
| `ready` | verify-gate ready + review-pack yes | Exit success; the run is complete and signed off. |
| `budget_exceeded` | iterations/wallclock/commits cap hit | Final commit `chore: ralph-loop budget exceeded`; surface full history; the work is NOT shipped. |
| `thrashing` | critic verdict thrashing | Surface the matched blockers; the user decides whether to re-plan or abandon. |
| `block_finding` | review-pack returns a `block` finding | Surface the block; the user resolves; ralph-loop never bypasses block-severity. |
| `escalate` | classifier returns escalate | Surface the blocker verbatim; the user resolves the ambiguity (spec edit, intent clarification). |
| `user_cancel` | user runs `cancel` | State recorded; commits left alone; user owns cleanup. |

## Discipline rules

These join the never-compress list. Compress narration around them; never the rules themselves.

- **No verification shortcuts.** ralph-loop never lowers verify-gate's bar. Every iteration's verdict comes from the same evidence-based check, same three passes, same surgical-diff pass.
- **review-pack sign-off is non-negotiable.** A `verdict: ready` from verify-gate alone does not exit success. The user's `yes` in review-pack does. ralph-loop does NOT auto-sign-off; it presents review-pack the same way `/vibe` does.
- **block-severity findings always halt.** No retry, no re-plan, no critic override. The user resolves blocks.
- **Bounded by default.** Default budgets exist for a reason; opting out (`--max-iterations 50`) requires a verbatim user confirmation in the same turn.
- **Classifier defaults to escalate when in doubt.** False escalations are cheap; false retries waste iterations; false re-plans waste plans.
- **State file is append-only within a run.** Iterations push, never overwrite. Hand-edit only as a recovery path.
- **Each iteration commits.** History stays auditable; "what did iteration 3 actually do" is answered by `git log` against that iteration's commit list.

## Karpathy alignment

- **Surgical Changes.** ralph-loop wraps `vibe` and routes blockers; it does not modify the pipeline stages themselves. exec-dispatch, plan-write, verify-gate are unchanged.
- **Simplicity First.** Plain JSON state, plain HTTP-style halt enum, no scheduler, no daemon. The loop is a `while`.
- **Goal-Driven.** Every iteration ends with a verdict; the loop's success criterion is `halt.kind = ready`. No "made progress" exit.
- **Think Before Coding.** Classifier prefers escalate. Critic halts on thrashing. Budgets are upper-bounded. The loop refuses to keep running when refusal is the safer answer.

## Compression policy

| Region | Policy |
|---|---|
| Iteration banners ("[ralph-loop] iteration 3/5") | Compress to the minimum |
| State file JSON | Verbatim |
| Blocker text from verify-gate | Verbatim |
| Classifier reasons | One terse line |
| Critic evidence | One terse line |
| Halt detail | Verbatim |
| Degradation warning | Verbatim, never compressed |
| review-pack output | Pass through unchanged |

## Cross-runtime portability

Capability-gate block above documents the five runtimes. State file is universal JSON; resume mechanics are identical across runtimes; only the autonomy axis differs (native loop vs manual `--resume`).

- **Claude Code** — auto-discovers via `.claude-plugin/plugin.json`.
- **Codex** — auto-discovers via `.codex-plugin/plugin.json`.
- **Gemini CLI** — referenced from `GEMINI.md` via `@./skills/ralph-loop/SKILL.md`. Degraded checkpoint mode.
- **opencode** — auto-discovers via `.opencode/plugins/vibekit.js`. Degraded checkpoint mode unless provider supports background loops.
- **Pi** — auto-discovers via `.pi-plugin/plugin.json`. Degraded checkpoint mode.

## Anti-patterns

- Removing budgets to "let it really finish." Removed budgets turn ralph-loop into a token incinerator. If the default budget runs out, the failure is informative.
- Auto-resolving an `escalate` classification by re-running with a guess. Escalate exists because the loop refuses to guess.
- Treating `thrashing` as "needs more iterations." Thrashing means the loop is fighting itself; more iterations make it worse.
- Bypassing review-pack via auto-yes. The user's sign-off is the contract.
- Editing the state file mid-run to skip ahead. The append-only invariant is what makes resume safe.
- Wrapping `/vibe` in a shell `while` loop instead. ralph-loop's value is the classifier, the critic, and the budgets — all of which a shell loop lacks.

## Pipeline integration

ralph-loop is a peer to `vibe`, not a child. It composes:

- **Calls** `vibe` (or sub-stages) per iteration.
- **Reads** `verify-gate` reports and `review-pack` outputs.
- **Routes** blockers to `exec-dispatch` (retry-task) or `plan-write` (re-plan) or the user (escalate).
- **Never bypasses** `verify-gate`, `review-pack`, or `finish-branch`.
- **Logs** to `.vibekit/ralph/<run-id>.json`; may also append a session-log entry to `memory-dual` on halt.

## Output of this skill

For `start` and `resume`: iteration banners during the run; on halt, a verbatim halt summary with the state-file path.
For `status`: the YAML summary above.
For `cancel`: `Cancelled <run-id>. Reason: <verbatim>.`

The skill is loop-driving and user-facing. No structured return value beyond the state file.
