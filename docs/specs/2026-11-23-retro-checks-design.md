---
title: retro checks
date: 2026-11-23
status: approved
---

# retro checks: Design

## Problem

CI runs the unit tests only on ubuntu-latest (the `validate` job). The `hook (windows-latest)` job runs `npm run check:hook`, which is `tests/hook.test.mjs` alone. Two Windows-only failures reached `main` that way and were found by hand in the 2026-11-23 Windows test run:

1. With Git for Windows' default `core.autocrlf=true`, `lib/frontmatter.mjs` did not parse CRLF skill files: `npm test` failed 32 of 309 tests and `npm run check` failed with `brainstorm: missing frontmatter block`.
2. `tests/no-external-references.test.mjs:24` built paths with `path.join`, which gives backslashes on win32, so the assertion at line 51 failed with `a known skill must be covered`. It fails the same way at 3f800da.

Both are fixed on `repl-run/windows-start-skills`. Nothing in CI would catch the next one.

## Goals

1. The `hook (windows-latest)` CI job runs every unit test file except `tests/submission.test.mjs`. Observable: the job's log for a CI run shows `node --test` reporting the test files from `tests/` other than `tests/submission.test.mjs`, and the job concludes `success` at HEAD.
2. The new step fails on the session's mistake. Observable: the exact command the step runs, executed on this Windows machine in a temporary worktree at 3f800da, exits non-zero and reports `a known skill must be covered`.
3. The new step passes on the repo at HEAD. Observable: the same command exits 0 on this Windows machine at HEAD.

## Non-goals

- Running `tests/submission.test.mjs` on Windows. It needs `zip` and `unzip`, which the Windows runner and this machine lack, and it runs on ubuntu in `validate`.
- Changing any test's assertions.

## Constraints

- Run limits: at most 3 verify rounds, at most $0 on paid runs
- No new dependency, in the package or on the CI runner.
- The step lives in the existing `hook` job's matrix, on the Windows leg only, so the ubuntu leg and `validate` are unchanged.
- The command is one any contributor can run on Windows from the repo root.

## Approach

Add one step to the `hook` job in `.github/workflows/ci.yml`, guarded by `if: runner.os == 'Windows'`, that runs `node --test` over every `tests/*.test.mjs` file except `tests/submission.test.mjs`. The step uses the runner's default Windows shell, and the plan writes the exact command and observes it locally before CI.

This came from `retro` after the run whose `debug` report carried `Class: platform path separators in a test. The cheap check that would have caught it is running npm test in the existing windows-latest CI job, not only tests/hook.test.mjs.`

## Alternatives considered

- Run the full `npm test` on Windows and install `zip` on the runner. Rejected by the no-new-dependency constraint.
- Make the submission tests skip themselves when `zip` is missing. It changes a test's behaviour, and on a machine with a broken `zip` it would hide a failure.

## Testing

Goals 2 and 3 are measured on this Windows machine before the push: the step's command at 3f800da (a temporary worktree, removed afterwards) and at HEAD. Goal 1 is measured on the CI run for the branch's pull request.

## Open questions

N/A: the user picked this check, and the approach has no open choice.
