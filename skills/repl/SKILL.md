---
name: repl
description: "Use when the user types /vibekit:repl: runs brainstorm with the user, then carries plan, exec, verify and debug to the end with no human input, deciding by decide's rules and stopping only for what the user alone can decide."
trigger: Invoked explicitly as a slash command, never fires on its own
gate: none
command: true
---

# repl

The user designs. You run the rest.

After the spec is approved, nothing waits for the user until the run ends. You sit in the user's seat for every question the pipeline would ask, answer it by `decide`, and log the answer.

## 1. Brainstorm with the user

Invoke `brainstorm` with the intent. It runs exactly as it always does: questions, pushback, approaches, design sections, the spec, and the user's approval. Nothing is automated here.

## 2. Run limits

Right after the user approves the spec, ask once:

> Run limits: at most 3 verify rounds, at most $0 on paid runs. Reply with other numbers, or accept these.

Write the answer under the spec's `## Constraints` as `Run limits: at most N verify rounds, at most $M on paid runs`, and commit it with the approval. This is the last point that waits for the user.

A goal whose only criterion is a paid run, with no budget left for it, cannot be measured. The run pauses on it rather than spending.

## 3. Set up

1. Invoke `decide`. It stays on for the rest of the run.
2. Create branch `repl/<topic>` in a worktree at `.vibe-worktrees/<topic>`, off the current branch. `exec` refuses to run without one.
3. Add `.vibe-worktrees/` to `.git/info/exclude` if it is not there. Never edit `.gitignore`.
4. Commit the spec on the run branch. If its path is gitignored, force-add it there: the branch is local, so this is a two-way door.
5. Start the decision log at `.vibe-worktrees/<topic>.decisions.tsv` with the header row `ts	phase	decision	why	evidence	result`.

## 4. The pipeline

Run `plan`, `exec`, `verify` and `debug` exactly as written. Where a skill would wait for the user, you answer:

| The skill asks | You answer |
|---|---|
| `plan`: review the plan | approve once its self-review has passed |
| `exec`: `needs-input` | `decide` picks an option, `plan` amends the plan in its own commit, and the task is dispatched fresh |
| `exec`: `blocked` or a scope violation | `debug`, with the report as the failure |
| `verify`: not ready | the route `verify` names: a failing test or build to `debug`, a goal the plan cannot satisfy to `plan` as a new task, a ladder violation to `exec` as a new task |
| `verify`: ready with warns or nits open | another round, fixing them like blockers |
| `debug`: approve the report | approve once its refuter has run and its guard test is named |
| a one-way door, `unreproducible`, or refuted twice | pause |

## 5. Rounds

A round is one `verify` pass plus the fixes it routes. Count rounds against the cap and money against the budget, and log both as they change.

A round that ends with the same or more findings than it started with did not help. Undo its fix commits with `git revert`, never a reset, log it, and change approach in the next round.

## 6. Amending the spec

You may add a goal or a non-goal for behaviour the spec does not cover, or record one reading of an ambiguous requirement. Each amendment is its own commit, `spec: amend <topic>: <one line>`, with a log row.

Never delete a goal, weaken a goal or its criterion, or move a goal into the non-goals. If weakening is the only way forward, pause.

## 7. The decision log

One row per decision, with the columns `ts`, `phase`, `decision`, `why`, `evidence` and `result`. Evidence is a pointer, such as a commit, a `file:line` or a command, never prose. The log is append-only: a wrong call gets a new row that supersedes it.

The log sits beside the worktree, not in it, so `verify`'s clean-tree and scope checks never see it.

## 8. Endings

- `done`: `verify` returns `ready`, no blocker is open, and every warn or nit still open at the cap carries a ruling.
- `paused`: the run reached something only the user can decide.
- `capped`: the round cap was reached with a blocker still open.

On every ending, commit the work on the run branch. For `paused` and `capped`, write a resume note to `.vibe-worktrees/<topic>.resume.md` with the intent, what is verified, the current state and the first action on resume. Check that every evidence commit in the log exists with `git cat-file -e`, and that every row matches something that happened in this session. Then report.

Never push, open a pull request, or merge. Integration belongs to the user, after they read the report.

## The report

```
Ending:     done | paused | capped, and HEAD
Verdict:    verify's last verdict, each goal with its evidence
Amended:    every spec amendment, or none
Set aside:  every finding set aside, with its ruling, or none
Rulings:    how many, and the log path
Spent:      money spent on paid runs, against the budget
Paused on:  the door or dead end and the resume note path, for paused or capped
```

## Handoff

None of your own. `retro` fires after the report when a `debug` report in the run carried a `Class:` other than `none`. Otherwise the user takes it from the report.
