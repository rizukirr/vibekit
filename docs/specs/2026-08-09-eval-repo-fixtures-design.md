---
title: eval repo fixtures
date: 2026-08-09
status: approved
---

# eval repo fixtures — Design

## Problem

Two of the five `verify` scenarios measured on 2026-08-09 are unsatisfiable as
fixtured. `verify-nit-does-not-gate` scored 0.30 and `verify-dispatches-the-fix`
scored 0.00, recorded in `evals/results/2026-08-09T15-09-00-976Z-HEAD.json`.

The cause is the fixture, not the skill. `runSession` seeds files into a bare
temp directory that is not a git repository, and spawns the session with
`--disallowedTools Bash` (`evals/session.mjs:70`). `verify`'s repo-level sweep
requires `git rev-parse HEAD`, `git status --porcelain` and `git diff BASE..HEAD`.
None of them can run, so every sweep check is unobserved, unobserved is a blocker,
and a blocker is `not ready`.

That is the correct behaviour under `verify`'s severity model. Nine of the ten
failing `verify-dispatches-the-fix` sessions named the missing repository in
their final text, one verbatim:

> "There is no git repository here at all (no `.git` directory, and the
> environment confirms 'Is a git repository: false')."

So `verify-nit-does-not-gate`, which asserts the final text omits `not ready`,
asks the skill to do the wrong thing; and `verify-dispatches-the-fix` never
reaches the fix loop it measures. Neither can be scored until the fixture can
support a sweep.

This is instrument defect eleven and twelve against zero implementation defects.

## Goals

- A scenario may declare `repo: true` and receive a seeded git repository plus a
  bounded command allowlist. Observable: `npm test` passes a new test asserting
  the spawned argv contains `--allowedTools` and does not contain
  `--disallowedTools` when the key is set.
- A scenario without the key spawns exactly as it does today. Observable: `npm
  test` passes a test asserting the argv for a keyless scenario still contains
  `--disallowedTools Bash` and no `--allowedTools`.
- An opted-in session can observe the repo. Observable: the recorded rate for
  `verify-nit-does-not-gate` on a run at n=1 is at or above 0.8. Amended
  2026-08-09 during verification: this criterion originally named the session's
  final text, which the harness stores only for failing sessions, so a passing
  run can never produce the artefact it asked for. The rate is the observable
  the run actually yields.
- The two failing scenarios are re-measured at n=10 and the result recorded.
  Observable: a results file under `evals/results/` naming both scenario ids.
  The rate is evidence, not a requirement — a remaining failure is diagnosed as
  fixture or skill on its own terms, never cleared by editing the expectation.
- No recorded result becomes non-comparable. Observable: `git diff` on the merged
  change touches no scenario that lacks the `repo` key, and no existing
  expectation.

## Non-goals

- A separate commands-without-a-repo key. Nothing asks for one; it can be split
  out when something does.
- A `package.json` or test runner in the fixture. The two failing fixtures'
  criteria are `src/greet.js` exports `greet`, not a test run.
- A sandbox. An allowlist bounds which commands run, not what they can reach.
  See Open questions.
- Re-running the three stale `plan` scenarios. Separate cycle.
- Any change to `verify`'s own text. The skill behaved correctly; nothing about
  it is under repair here.

## Constraints

- Dependency free. Bare Node plus `git`, which the harness already assumes.
- Additive only. No existing scenario, expectation, or recorded rate may move.
- `evals/` never ships — absent from `package.json` `files[]`.
- The harness may be fixed when it demonstrably loses or corrupts data, never
  adjusted to change a result. This change qualifies under the first clause: the
  fixture cannot represent the state the scenario prompt asserts.
- Pin `git ls-files -s skills evals | sha256sum` before and after every paid run.

## Approach

One top-level scenario key, `"repo": true`, alongside `files` and `model`.

Chosen over two independent keys (`allowBash` and `repo`), which would cost a
second code path and a second test for a combination nothing needs; and over
seeding every scenario unconditionally, which is the smallest diff but changes
the environment of all twenty existing scenarios and makes every recorded rate
non-comparable.

The user's pushback response, recorded: the original request was for `allowBash`.
Challenged on the grounds that neither failing scenario wants a shell — both want
a repository with a runnable check, and Bash alone leaves both still failing. The
smaller framing was taken.

### Seeding

In `runSession`, after `seedFiles` and before the spawn, when `scenario.repo` is
set, five `git` invocations in the temp cwd, each spawned directly rather than
through a shell:

```
git init -b main
git commit --allow-empty -m base
git switch -c work
git add -A
git commit -m work
```

Each carries `-c user.name=vibekit-eval -c user.email=eval@vibekit.invalid`, so
the harness does not depend on the machine's global git config.

Two commits, not one. `verify` derives `BASE` from a merge-base, and a
single-commit repository has no parent to diff against. The empty root commit on
`main` makes the whole seeded state the diff, which is what the scenario prompts
already assert — "complete and committed".

A failing `git` invocation is a harness failure, not a scenario failure: throw
with the command and its stderr rather than spawning a session into a
half-built repository.

### Permissions

When `repo` is set, `--disallowedTools Bash` is replaced by `--allowedTools`
naming `Bash(git:*)`, `Bash(node:*)`, `Bash(ls:*)`, `Bash(cat:*)`, plus `Read`,
`Write`, `Edit`, `Glob`, `Grep`, `Task` and `Skill`. Write and Edit stay
available because attempting them is part of the behaviour under measurement.

When `repo` is absent, the argv is byte-identical to today's.

### Scenarios

`verify-nit-does-not-gate` and `verify-dispatches-the-fix` each gain `"repo":
true`. No other scenario changes, and no expectation changes.

## Alternatives considered

- **Two keys, `allowBash` and `repo`.** Rejected: speculative generality.
- **Always seed, always allow.** Rejected: moves the environment of every
  existing recorded result.
- **Weaken the two expectations instead.** Rejected outright — editing the
  check to clear the obstacle in front of it is the failure the standing rule
  names, and the sessions' own output shows the skill was right.
- **Drop the two scenarios.** Rejected: the fix loop and the nit-does-not-gate
  rule are the two least-tested claims `verify` makes.

## Testing

Unit, against a fake `spawn` capturing argv, in `tests/eval-session.test.mjs`:

- Keyless scenario: argv contains `--disallowedTools`, `Bash`; contains no
  `--allowedTools`.
- `repo: true`: argv contains `--allowedTools`; contains no `--disallowedTools`.
- `repo: true`: the allowlist string contains `Bash(git:*)`.

Each assertion is shown failing before the change is written.

Integration, paid, in order:

1. `verify-nit-does-not-gate` at n=1. Read the final text. It must not report a
   missing git repository.
2. Both scenarios at n=10, digest pinned either side, result committed.

## Open questions

- A command allowlist is not a sandbox. `Bash(git:*)` permits `git push`, and
  although the temp cwd has no remote, the session inherits the machine's
  credentials. The four scoped patterns are narrower than today's
  `bypassPermissions`-minus-Bash posture in every respect except this one. Named
  rather than silently widened; tightening it further is its own cycle.
- Whether `verify`'s sweep should exempt run-produced artefacts remains
  deferred, unchanged by this cycle.
