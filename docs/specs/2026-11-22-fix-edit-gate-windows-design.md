---
title: fix edit-gate windows
date: 2026-11-22
status: approved
---

# fix edit-gate windows: Design

## Problem
Failure:  npm run check:hook on windows-latest, PR #69, run 44932478949, job 136931906571, exit 1.
          "✖ edit-gate blocks an edit when no working skill has run ... actual: 0, expected: 2", and the same for "does not count a modifier skill" and "does not count a prose mention of a command". ubuntu-latest passes.
Repro:    2 of 2 Windows CI runs (44932478949, and diagnostic run 44932882405 at 9b22e98). The diagnostic run shows bash receiving stdin, reading the path, printing the block message and reaching exit 2, while the test sees status 0. Not reproducible on this Linux machine.
Isolated: conditions, the batch half of hooks/run-hook.cmd, which only cmd.exe runs. Diagnostic lines: "DIAG argc=2 arg1=[brainstorm]" and "No vibekit gate has run in this session..." with "status":0.

## Goals
1. The guard test named in the report fails at BASE and passes at HEAD.
2. The failing command from Failure exits 0 at HEAD.
3. The full test suite passes at HEAD.

## Non-goals
No behaviour change other than the one the cause names.

## Constraints
No interface change.

## Approach
Cause:    1. hooks/run-hook.cmd:14, 18 and 23 run `exit /b %ERRORLEVEL%` inside a parenthesised block. cmd.exe expands %ERRORLEVEL% when it parses the block, before bash.exe runs, so the wrapper always exits 0 and every non-zero hook status is lost on Windows.
          2. Observed, not inferred: cmd.exe treats the comma in the argument "brainstorm,quick" as a separator, so the script's $1 is only "brainstorm". Once cause 1 is fixed, only the first skill in the list would unlock edits on Windows.
Refuted:  survives. The refuter confirmed edit-gate:45-46 is the only place that prints the block message, followed by exit 2. Nothing in the test helper changes the status, nothing runs after bash in the batch block, and there is no delayed expansion in the file.

## Alternatives considered
N/A: a diagnosis, not a design. The refuter's result is under Approach.

## Testing
Guard:    the three failing edit-gate tests on windows-latest guard cause 1. They fail today. For cause 2, "edit-gate allows an edit after a Skill call to a working skill" with GATE_LIST "brainstorm,quick" and a record holding quick: it passes today only because cause 1 turns everything into 0, and it fails once cause 1 is fixed unless the list survives cmd.exe.

## Open questions
N/A: the report was approved as written.
