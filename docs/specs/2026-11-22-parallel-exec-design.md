---
title: parallel exec
date: 2026-11-22
status: approved
---

# parallel exec: Design

## Problem

`exec` runs plan tasks one at a time, and `skills/exec/SKILL.md` forbids anything else: "Never dispatch two implementers at once. They conflict." A plan whose tasks do not depend on each other still waits for each agent in turn. Plans have no way to say which tasks depend on which, so `exec` cannot tell a chain from a set of independent tasks.

## Goals

1. A plan can say what each task waits for. `skills/plan/SKILL.md` shows a `**Blocked by:**` line in its task shape, says that a task without the line waits for the task before it, and says a task may only wait for tasks numbered before it. Observable: `grep -c 'Blocked by' skills/plan/SKILL.md` prints at least 1, and the file states both rules.
2. `exec` runs independent tasks at the same time. `skills/exec/SKILL.md` runs the plan in waves: every task whose blockers are done joins the wave, unless it shares a file with an earlier task in the wave, up to 3 tasks. Each task in a wave of more than one gets its own `git worktree`, and its commits land on the run branch by cherry-pick in plan order, with its verify clause run again there. Observable: `grep -c 'Never dispatch two implementers at once' skills/exec/SKILL.md` prints 0, and `grep -c 'git worktree add' skills/exec/SKILL.md` prints at least 1.
3. A failure in a wave stops the next wave. Tasks already running finish, the ones that passed land, then `exec` halts and routes as it does today. Observable: `skills/exec/SKILL.md` states this.
4. A runtime that cannot run agents at once still works. `skills/exec/SKILL.md` says to run a wave's tasks one at a time in plan order when the runtime cannot dispatch subagents concurrently. Observable: the file states this.
5. `npm test` and `npm run check` exit 0.
6. A `repl` run does not pause when `exec` cleans up. `skills/decide/SKILL.md` exempts the worktrees and branches `exec` creates and removes within its own run from the branch-deletion door. Observable: `grep -c 'within its own run' skills/decide/SKILL.md` prints at least 1.

## Non-goals

- Running whole plans or features in parallel.
- A merger agent, a tree of planners, or cloud agents.
- Resolving merge conflicts. Disjoint files make them impossible by construction.
- A paid eval of the new behaviour.

## Constraints

- No new dependency.
- Every edited string obeys `plain`'s rules, which `npm test` checks.
- Generated files change only through `npm run generate`.
- A plan with no `Blocked by` lines runs exactly as it does today, one task at a time on the run branch.
- `exec` deletes only worktrees and branches it created in the same run.
- Run limits: at most 3 verify rounds, at most $0 on paid runs

## Approach

The user asked for worktrees, with the lead agent delegating to them and merging back once each task is done, and with dependent tasks waiting for their blockers to merge. Pushback: the speed-up exists only when plans have independent tasks, and this repo's 8 plans are mostly chains. Outcome, decided in a `repl` run: the larger framing, because it is a general feature and a chain costs nothing extra under the "waits for the task before" default.

`plan` gains one line per task, `**Blocked by:** none` or `**Blocked by:** Task 1, Task 3`. A task without it waits for the task before it, and Task 1 without it waits for nothing. A task may name only earlier tasks, so a cycle cannot be written. Self-review checks both rules and flags two tasks that share a file with no path between them.

`exec` runs waves. A wave is the ready tasks in plan order, skipping any that shares a file with an earlier task in the wave, capped at 3. A wave of one runs exactly as today, on the run branch. In a wave of more than one, each task gets `git worktree add` from the run branch tip on its own branch, an agent dispatched in the background into that worktree, and its own BASE. When the wave is done, `exec` runs each task's clause and scope check in its worktree, then in plan order cherry-picks the task's commits onto the run branch, runs the clause again there, ticks the plan and commits the tick. Worktrees and their branches are removed once their commits land. A failure stops the next wave, lands what passed, and halts.

## Alternatives considered

- A rolling frontier, as in `implement-spec`: dispatch each task as soon as its blockers land. It is faster on wide plans but merges in finish order, which varies from run to run. With a cap of 3 and plans of up to 5 tasks, waves lose little.
- A merger agent and a tree of planners, as in `orchestrate`. Far more machinery than vibekit plans need.
- Parallel agents in one working tree, no worktrees. They race on git's index and break the per-task `BASE..HEAD` scope check.
- Treating a shared file as a merge problem. Rejected by the user: a conflict wastes an agent's work and its resolution goes unchecked.

## Testing

`npm test` (which runs `plain`'s checks on every skill) and `npm run check`, plus the greps in the goals. Live parallel dispatch is not exercised: it needs a paid run and the budget is $0, so `verify` lists it as unseen.

## Open questions

N/A: every question was answered by the user or decided in the `repl` run.
