---
name: repl
description: "Use when the user types /vibekit:repl: brainstorms and plans without the user, shows a plain summary and waits for a go, then carries exec, verify and debug to the end with no human input, deciding by decide's rules and stopping only for what the user alone can decide."
trigger: Invoked explicitly as a slash command, never fires on its own
gate: none
command: true
---

# repl

You design, plan and build. The user reviews one thing: a plain summary of the plan, before any code is written.

You sit in the user's seat for every question the pipeline would ask, answer it by `decide`, and log the answer. The summary is the only point that waits for the user, unless `decide` pauses.

## 1. Start

1. Invoke `decide`. It stays on for the rest of the run.
2. Add `.vibe-worktrees/` to `.git/info/exclude` if it is not there. Never edit `.gitignore`.
3. Start the decision log at `.vibe-worktrees/<topic>.decisions.tsv`, the topic taken from the intent, with the header row `ts	phase	decision	why	evidence	result`.

## 2. Brainstorm without the user

Invoke `brainstorm` with the intent. It runs unchanged, except that wherever it would wait for the user (each clarifying question, the pushback, the choice of approach, each design section, the spec review), you answer through `decide` and carry on. Brainstorm never waits for the user.

If the request or the repo settles the question, follow it. Otherwise take the recommendation: `brainstorm` gives one for the pushback and the approaches, and you form one for a clarifying question. Print each answer as one line and log it:

`Asked: <question>. Picked: <answer>, because <reason>.`

Then approve the spec yourself: set `status: approved` and write `Run limits: at most 3 verify rounds, at most $0 on paid runs` under the spec's `## Constraints`.

A goal whose only criterion is a paid run, with no budget left for it, cannot be measured. The run pauses on it rather than spending.

## 3. Set up

1. Create branch `repl-run/<topic>` in a worktree at `.vibe-worktrees/<topic>`, off the current branch. `exec` refuses to run without one.
2. Commit the approved spec on the run branch. If its path is gitignored, force-add it there: the branch is local, so this is a two-way door.

## 4. Plan and the summary

Run `plan`. Its self-review stands in for the user's review of the plan. Then print the summary and wait for the user's reply before `exec`:

```
Summary
Build <the feature, in one plain sentence>. These are the choices we made:

1. <a decision from brainstorm, in plain words>
2. <the next one>

How we'll know it works: <the spec's goals, in one plain sentence>
Limits: up to N review rounds, $M on paid checks.

Reply "go" to start building, or tell me what to change.
```

List only decisions that change what gets built: the approach, the pushback outcome, and answers that shaped the design. Use plain words a 12-year-old would follow, with no file paths, function names or jargon unless the user used them.

A go accepts the plan and the limits. Log it, and from `exec` on nothing waits for the user until the run ends.

A correction is a settled answer. New run limits in it go into the spec first. Amend the spec in its own commit, `spec: amend <topic>: <one line>`, have `plan` rewrite the plan, and print the summary again.

## 5. The pipeline

Run `plan`, `exec`, `verify` and `debug` exactly as written, every one of them, however small the change looks. Making a change yourself instead of through `exec` is never yours to decide. Where a skill would wait for the user, you answer:

| The skill asks | You answer |
|---|---|
| `plan`: review the plan | approve once its self-review has passed |
| `exec`: `needs-input` | `decide` picks an option, `plan` amends the plan in its own commit, and the task is dispatched fresh |
| `exec`: `blocked` or a scope violation | `debug`, with the report as the failure |
| `verify`: not ready | the route `verify` names: a failing test or build to `debug`, a goal the plan cannot satisfy to `plan` as a new task, a ladder violation to `exec` as a new task |
| `verify`: ready with warns or nits open | another round, fixing them like blockers |
| `debug`: approve the report | approve once its refuter has run and its guard test is named |
| a one-way door, `unreproducible`, or refuted twice | pause |

## 6. Rounds

A round is one `verify` pass plus the fixes it routes. Count rounds against the cap and money against the budget, and log both as they change.

A round that ends with the same or more findings than it started with did not help. Undo its fix commits with `git revert`, never a reset, log it, and change approach in the next round.

## 7. Amending the spec

You may add a goal or a non-goal for behaviour the spec does not cover, or record one reading of an ambiguous requirement. Each amendment is its own commit, `spec: amend <topic>: <one line>`, with a log row.

Never delete a goal, weaken a goal or its criterion, or move a goal into the non-goals. If weakening is the only way forward, pause.

## 8. The decision log

One row per decision, with the columns `ts`, `phase`, `decision`, `why`, `evidence` and `result`. Evidence is a pointer, such as a commit, a `file:line` or a command, never prose. The log is append-only: a wrong call gets a new row that supersedes it.

The log sits beside the worktree, not in it, so `verify`'s clean-tree and scope checks never see it.

## 9. Endings

- `done`: `verify`, invoked in this run, returns `ready`, no blocker is open, and every warn or nit still open at the cap carries a ruling.
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
