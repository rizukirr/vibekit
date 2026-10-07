---
title: verify bug hunt
date: 2026-10-07
status: approved
---

# verify bug hunt: Design

## Problem

`verify` grades a change against its spec. A logic bug in the diff that no test covers and no goal's criterion exercises passes as `ready`. A regression in behaviour that existed before the change, and that no test covers, passes the same way. The only place `verify` thinks past the tests is the list of three risks on the `ready` exit at `skills/verify/SKILL.md:133`, which is written after the verdict, capped at three, and never run.

## Goals

1. `verify` hunts for bugs and regressions the change produced and reports the result in the verdict. Observable: the new eval scenario `verify-reports-the-hunt` passes at a rate of 0.8 or higher, where passing means the final message contains a `Bugs:` line.
2. A demonstrated bug whose reference is a spec goal or constraint is fixed without asking the user. Observable: the new eval scenario `verify-fixes-a-settled-bug` passes at 0.8 or higher, where passing means a dispatch prompt carries the reproduction.
3. A demonstrated regression against `BASE` is fixed without asking the user. Observable: the new eval scenario `verify-fixes-a-regression` passes at 0.8 or higher, where passing means a dispatch prompt carries the behaviour that held at `BASE`.
4. A demonstrated bug with no settled reference gates the verdict and reaches the user without a fix being dispatched. Observable: the new eval scenario `verify-asks-on-an-undecided-bug` passes at 0.5 or higher, where passing means the final message contains `Verdict: not ready`. A wrongful fix that closes the bug turns the verdict to `ready` and fails the scenario, so the verdict alone carries the check. The 0.5 threshold is recorded in `evals/thresholds.json`.
5. The hunt does not invent blockers, and the existing behaviour of `verify` holds. Observable: the five existing scenarios `verify-fires`, `verify-refuses-without-spec`, `verify-claims-nothing-unearned`, `verify-nit-does-not-gate` and `verify-dispatches-the-fix` each still pass at 0.8 or higher.
6. An eval scenario can seed files into the base commit. Observable: `node --test tests/eval-session.test.mjs` exits 0 and includes a case that asserts a `baseFiles` entry is committed in the base commit, so that `git show HEAD~1:<path>` prints its content.
7. Generated files match their sources and the test suite is green. Observable: `npm run check` exits 0 and `npm test` exits 0.

## Non-goals

- A separate hunting subagent.
- Sending a bug through `debug` and `exec` without the user asking for it.
- Fixing or gating on a bug that reproduces identically at `BASE`.
- A second unattended fix round.
- A new severity level.
- New scoring keys in `evals/score.mjs`.
- The change to the `brainstorm` pushback turn. It has its own spec.

## Constraints

- `verify` never edits. Every fix is dispatched.
- A reproduction writes nothing into the working tree. `git status --porcelain` stays empty through the hunt.
- The rule "only a blocker produces `not ready`" stands as written.
- The fix loop keeps its shape: one subagent, one brief, confined to files already in the diff, one round.
- Edit `skills/verify/SKILL.md` only, then run `npm run generate`. No generated file is edited by hand.
- No shipped file names a project under `external/`.
- All text follows the `plain` rules.

## Approach

The user chose the smaller framing at the pushback turn: rework the existing risks list instead of adding a separate hunting pass with its own subagent. They then chose approach A below.

### Step order

Preconditions, sweep, goals walk, lazy read, bug hunt (new, step 5), fix loop (renumbered 6), verdict, ending, integration (renumbered 7).

### The hunt

Scope is the diff `BASE..HEAD` plus the callers of every function, export or command the diff changed. A bug that reproduces identically at `BASE` was not produced by this change. `verify` names it in `Open` as pre-existing and it never gates.

`verify` works in three moves:

1. List suspects. Each is one falsifiable claim with `file:line`: this input, this result, and what the result should be.
2. Name the reference for the expected result. Three references count as settled: the behaviour at `BASE`, a goal or constraint in the spec, or a crash on input the code plainly accepts. Anything else is recorded as having no settled reference. A difference from `BASE` that the spec asks for is not a suspect.
3. Try to reproduce each suspect with one command and keep its output. A regression runs the same input at `BASE` and at `HEAD`.

A reproduction runs as an inline command or from a temporary directory outside the repository. The `BASE` side runs in a temporary `git worktree` that `verify` removes afterwards.

| Reproduction | Result |
|---|---|
| Ran and shows the wrong behaviour | `demonstrated`, a `blocker` |
| Ran and shows correct behaviour | dropped, and counted in the verdict |
| Could not be run | `suspected`, a `warn`, with the reason it could not run |

### Severity and fixability

`blocker` gains one entry: a demonstrated bug. A suspected bug is a `warn`.

The fixability rule gains a second case. A finding is auto-fixable if fixing it cannot change behaviour, or if it is a demonstrated bug whose reference is settled. A demonstrated bug with no settled reference is a `blocker` that is never auto-fixed, because choosing its correct behaviour belongs to the user.

### The fix loop

For each bug, the brief adds the reproduction command, its output verbatim, the reference, and the expected result.

The fix agent adds the reproduction as a test when a test file is already in the diff. With no test file in the diff it adds no test, and `verify` says so in `Unseen`, because a new test file would trip the sweep's scope check.

The rerun adds every reproduction command to the sweep. A reproduction that still shows the wrong behaviour stays a `blocker`.

A fix that needs a file outside the diff is not attempted. The bug stays a `blocker`.

After the one round, `verify` hunts once more over the fix commit only. Anything that hunt demonstrates is a `blocker` carried to the user and never auto-fixed.

A bug reaches the user when it has no settled reference, when the fix round did not close it, when the fix needs a file outside the diff, or when it is only suspected.

### Verdict block

One new line between `Goals` and `Fixed`:

```
Bugs:    one line per suspect: demonstrated or suspected, the claim with file:line,
         the reference, then the command and what it returned, or why it could not run.
         Then the count of suspects dropped because their reproduction passed.
```

`Fixed` also lists each bug the loop closed, with the reproduction's result before and after. With no suspects, `Bugs` says so and names what `verify` read and ran.

### The ending

On `ready`, the suspected bugs replace the list of three ways the change could be wrong. The list has as many items as `verify` found, including none. The choices stay approve, fix, or abort.

On `not ready`, each demonstrated bug is shown with its evidence, then three choices per bug:

| Choice | What happens |
|---|---|
| Fix | Routes to `debug`, as a failed check does |
| Amend the spec | Routes to `brainstorm`, which owns the spec. The behaviour becomes a goal or a non-goal, and `verify` runs again from the top afterwards |
| Keep as is | The existing override: the gap is named and on the record, and integration becomes reachable |

### Failure cases

A reproduction command that errors instead of running proves nothing. The suspect stays `suspected`, with the error quoted.

A reproduction that shows the wrong behaviour on some runs only is `demonstrated`. `verify` reports how many runs out of how many.

A temporary worktree that `verify` cannot remove is reported in `Unseen` with its path.

A fix agent that returns anything but success ends the loop. Its bugs stay `blocker`s and reach the user.

### Description

The `verify` frontmatter description gains the hunt, so the generated trigger table and skill list change with it.

### Eval harness

`seedRepo` in `evals/session.mjs` gains an optional `baseFiles` scenario key. Its entries are written and committed in the base commit, before the scenario's `files` are committed as the work commit. A scenario without the key behaves as it does today.

## Alternatives considered

### B. Route every demonstrated bug through `debug` then `exec`

A demonstrated bug with a settled reference is handed to `debug` without asking the user. `debug` finds a cause, has a read-only subagent try to refute it, names a guard test, and routes to `exec`. This gives each fix a refuted cause and a guard test, and it is the route the pipeline already declares for a failed check. It costs at least three dispatches per bug against one dispatch for all bugs. `debug` also ends with the user on `unreproducible` or on two refutations, so the fix is unattended less often. It changes `verify`'s handoff and so touches two skills. Approach A keeps this route available: a bug the single fix round does not close goes to the user, and choosing fix there routes to `debug`.

### C. A separate hunting subagent

A fresh read-only subagent hunts with no knowledge of the goals walk, then `verify` reruns its reproductions. This removes the lean toward what the spec mentions. It adds a brief format, a second dispatch on every run including clean ones, and a summary `verify` must re-check. The user set this aside at the pushback turn. If the evals show `verify` missing planted bugs, this is the follow-up.

## Testing

Run `npm run generate`, then `npm run check` and `npm test`.

Four new entries in `evals/scenarios.json`, each with `repo: true`, `n: 10` and `model: sonnet`, scored with existing keys:

| Scenario | Fixture | Expectation |
|---|---|---|
| `verify-reports-the-hunt` | A clean change | `finalTextMatches` on the `Bugs:` line |
| `verify-fixes-a-settled-bug` | The spec's constraints say `greet` never throws on a string. The code throws on `''`. The goal's test covers `'ada'` only | `anyDispatchMatches` on the empty-string reproduction |
| `verify-fixes-a-regression` | `baseFiles` holds a `greet` that trims its input. The change rewrites `greet` for another goal and drops the trim. No test covers it | `anyDispatchMatches` on the trim behaviour |
| `verify-asks-on-an-undecided-bug` | The change returns a surprising result on input the spec never mentions, with nothing at `BASE` to compare | `finalTextMatches` on `Verdict: not ready` |

One new case in `tests/eval-session.test.mjs` for `baseFiles`.

The evals show that `verify` reports, reproduces, fixes and escalates on bugs with a known shape. They cannot show whether it finds bugs nobody planted.

## Open questions

None.
