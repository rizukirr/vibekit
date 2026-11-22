---
title: retro checks
date: 2026-11-22
status: approved
---

# retro checks: Design

## Problem

PR #69 went red on windows-latest three times. The batch half of `hooks/run-hook.cmd` exited from inside parenthesised `if (...)` blocks, and Windows CI run 44934455053 measured that a batch file exiting from inside such a block returns 0 under cmd /c, with either bare `exit /b` or `exit /b %ERRORLEVEL%`. The first fix changed the exit form but kept it inside the block, and only a third CI run showed it. Nothing in the repo flags an `exit /b` inside a block before a push.

## Goals

1. A test in `tests/hook.test.mjs` scans the batch half of `hooks/run-hook.cmd` (the lines before the `CMDBLOCK` terminator) and fails when any `exit /b` line sits between a line ending in `(` and its closing `)`. Observable: the test fails on a fixture copy of the wrapper as it was at commit 3c66c5d, and passes on `hooks/run-hook.cmd` at HEAD.
2. `npm test` exits 0 at HEAD. This needs the missing-script-name branch at `hooks/run-hook.cmd:6-9`, which also exits inside an `if (...)` block, to exit outside one, the same way the bash calls do.

## Non-goals

- Checking any other batch construct.
- Running batch on Linux.

## Constraints

- No new dependency.
- Every edited string obeys `plain`'s rules.
- The missing-script-name branch keeps its message and its exit status of 1.

## Approach

A plain text scan in node: split the file at the `CMDBLOCK` line, track block depth by lines ending in `(` and lines that are only `)`, and report every `exit /b` line found at depth above zero. The fixture is the wrapper's batch half at 3c66c5d, inlined in the test as a string.

## Alternatives considered

N/A: chosen by the user from a retro list. The check type and its target come from the session's debug report Class line.

## Testing

The new test itself, run against the 3c66c5d fixture (must fail) and against HEAD (must pass), then `npm test` and the windows-latest `hook` CI job.

## Open questions

N/A: no question was left open by the pick.
