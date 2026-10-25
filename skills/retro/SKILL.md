---
name: retro
description: "Use when a run ended and a debug report in it carried a Class: other than none, or when the user types /vibekit:retro: looks back over this session's failures and friction, proposes checks and rules that would catch them next time, and writes only what the user picks."
trigger: "A run ended, and a debug report in it carried a Class: other than none"
gate: none
command: true
---

# retro

Look back over this session and ask what in the repo would have stopped its mistakes. The code is already fixed. This makes the next session start better.

`debug` asks why the code failed and routes a fix with a guard test, which stops that one bug from coming back. `retro` asks why the repo let the mistake happen, and proposes the check or rule that stops the whole class.

This skill fires on its own once a run ends with a `debug` report whose `Class:` is not `none`, and never in the middle of a run. The user can also invoke it at any time.

## Input

This session's conversation is the only input. Do not read earlier transcripts or git history. A `debug` report's `Class:` line is the strongest lead you have.

If the session holds no failure and no friction, say there is nothing to propose and stop. Never invent a suggestion to fill the list.

## Procedure

1. Invoke `lazy`, `terse` and `plain`.
2. Gather every failure: a `not ready` verdict, a failed `exec` clause, a `debug` report with its `Class:` line. Gather every point of friction: turns lost to a command that failed for a predictable reason, or to searching for something the repo could have pointed to. Each item cites the command, the error or the turn.
3. Read the rules file and the project's test and check commands. Drop any item an existing rule or check already covers. A repo with no tests and no rules file gets that as its first suggestion.
4. Turn each item into at most one suggestion, of one type:
   - `check`: a mechanical mistake a script can catch.
   - `rule`: a judgement call, written as one line of prose.
   - `pointer`: where something lives, written as one line of prose.

   An item with nothing to prevent, such as a logic bug its guard test already covers, is dropped. Count the drops.
5. Present at most five suggestions, ranked by the turns or money each would have saved, with the top one marked recommended and the drop count below them. Then wait for the user's pick.

```
1. check    scenarios expecting a committed file must set repo: true
   Seen:    eval run 1 scored 0.00, no session could commit
   Where:   tests/, run by npm test
```

## Writing rules and pointers

The user's pick is the approval. If they pick none, say nothing was written and stop.

Write each accepted rule and pointer as one line under `## Rules` in the rules file the current runtime loads at session start: `CLAUDE.md` on Claude Code, `AGENTS.md` on every other runtime. Never write to the file your runtime does not load. A rule nobody reads is not a rule.

`## Rules` sits outside every `<!-- vibekit:generated -->` region, because the generator overwrites those regions. If the heading exists, append under it. If the file does not exist, create it with the heading and the rules only.

Commit the rules file alone, on the current branch. On the base branch, commit anyway and name the branch in your report.

Never edit or remove a rule you did not write in this run.

## Writing checks

A check is code, and code gets its own author and its own gate. Do not write it.

Write every accepted check into one spec at `docs/specs/YYYY-MM-DD-retro-checks-design.md`, with `status: approved` and the headings `brainstorm` uses. Each check gets a goal: it fails on a fixture that reproduces the session's mistake, and passes on the repo at HEAD. A check that cannot fail is not a check.

The spec's constraints include no new dependency. A check that needs one stays out of the spec, and you note that it wants `brainstorm`.

If `git check-ignore` matches the spec path, say the file is ignored and ask before running `git add -f`. Otherwise commit the spec alone, then invoke `plan` with its path. Do not stop to ask: the pick approved the checks, and `plan`'s own review gate stands before any code.

## Repair nothing

Do not fix the session's code, write a check, or create a branch. The rules file and the check spec are the only files this skill writes.

## Handoff

Hand off to `plan` when the user accepted at least one check. Otherwise there is none.
