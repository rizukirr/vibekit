---
name: debug
description: "Use when a check fails: a red test, a broken build, a failed clause, or a bug you can point at. Finds a root cause and gets it refuted before anything is fixed. Diagnosis is the product. This skill never edits."
trigger: "A check failed: verify returned not ready on a failed check, an exec clause failed, or a failure was reported"
gate: hard
---

# debug

Something broke. Find the cause and try to kill it before anyone fixes anything.

`verify` and `exec` both halt on a failed check and name no cause. This is where the cause is found, and the finding is the whole product. No fix is written here.

## HARD-GATE

Do NOT edit code, revert a commit, or route a fix until a root cause is stated and has survived an attempt to refute it.

A confident explanation is not a cause. The gate exists because the cheapest moment to be wrong is now, and the most expensive is after a fix has shipped against the wrong line.

## Two rules

**Preserve before you touch.** The failure as it first appeared is evidence, and the first edit destroys it. Capture the command, its output and its exit status verbatim, before anything else.

**A cause you cannot state a test for is a symptom.** If nothing would prove the claim wrong, it is a description of what you saw, not an explanation of it.

## 1. Stop and preserve

No fixes, no speculative edits, no "while I'm here". Record, verbatim:

- The command that failed and its exit status.
- Its output: the whole relevant span, not a summary.
- What was running: branch, HEAD, and whether the tree was clean.

Never paraphrase an error. The exact string is what matches a line of source. A summary of it matches nothing.

## 2. Reproduce

Run it yourself and make it fail on demand. Say how many times you ran it.

If you cannot make it fail, that is `unreproducible`, and it is a terminal outcome: name the conditions you tried and stop. Nothing routes. A fix aimed at a failure you cannot trigger cannot be shown to have worked, so shipping one trades a known problem for an unknown one.

An intermittent failure is not unreproducible until you have tried to widen the window: run it repeatedly, under load, or with timing exposed.

## 3. Isolate

Narrow to the smallest thing that carries the failure. Search the history, not the source:

- `git log --oneline` and `git bisect` to the first bad commit.
- `git diff <last-good>..<first-bad>` to the hunk.

Reading the code until something looks wrong is not isolation. It finds what you already suspected. If nothing changed, the cause is environmental or timing, and the widening from step 2 is the isolation.

Say which of the two you did.

## 4. Hypothesise

One falsifiable claim, in a sentence, with its evidence as `file:line`.

Falsifiable means you can say what would prove it wrong. "The parser is broken" cannot be wrong. "`parse()` drops the last field when the input has no trailing newline, at `parse.mjs:31`" can be, and the thing that would prove it is the test you are about to ask for.

## 5. Refute

Dispatch **one** fresh subagent, read-only, and tell it to refute the cause.

Its brief carries the verbatim failure, the claim, and the evidence, and instructs it to look for the reason the claim is wrong. **Default to refuted when the evidence is not conclusive**, so silence counts against the hypothesis rather than for it.

Read-only is a tool restriction, not a request. An agent that can edit will fix what it finds, and then the thing you were testing no longer exists.

Not a review, and not a second opinion asked politely. A reviewer looks for whether the claim holds. A refuter looks for the case where it does not, and only the second one can end a story you wrote.

You may not do this yourself. You formed the hypothesis, so re-reading confirms it, for the same reason `exec` never lets a plan's author implement it.

**The bound: one re-hypothesis.** Refuted once, form a new cause and dispatch again. Refuted twice, stop and hand over everything ruled out. Two dispatches per failure, and escalation is an honest outcome, not a failure to try harder.

## 6. Route

Diagnosis is the product. Someone else fixes it.

Where the failure came from decides where the fix goes. A `not ready` verdict from `verify` or a failed `exec` clause is inside a run: a plan is in flight to take the fix. A failure the user reported is standalone: nothing is in flight, and `exec` and `plan` both refuse to start without an approved spec.

| Route | Inside a run | Standalone |
|---|---|---|
| Local: one function or file, no interface change | `exec` as a new task | the fix spec below, then `plan` |
| Structural: crosses a boundary, changes an interface, needs design | `plan`, as the problem statement for a new plan | `brainstorm`, with the report as its problem statement |
| `unreproducible` | routes nothing, the user decides | routes nothing, the user decides |
| Refuted twice | routes nothing, the user decides | routes nothing, the user decides |

Every routed fix carries a **guard test that fails before the fix and passes after**. Without the pre-fix failure it is not a guard, it is a test that happens to be green, and a check that cannot fail is not a check.

Name the guard test in the route. Do not write it.

## The report

Report in the conversation. Write nothing and commit nothing, with one exception: the fix spec on a standalone local route.

```
Failure:  the command, its exit status, and its output verbatim
Repro:    how you made it fail, and how many times, or why you could not
Isolated: the commit, the hunk, or the conditions
Cause:    one falsifiable claim, with file:line
Refuted:  what the refuter returned, both times if there were two
Guard:    the test the fix must add, and what makes it fail today
Class:    none | the class of mistake, and the cheap check that would have caught it
Route:    exec | plan | brainstorm | fix spec | user
```

Fill `Class:` when the cause belongs to a class of mistakes rather than being a one-off. Any of four signs makes it one: the cause is mechanical and could recur elsewhere, an expensive instrument caught what a cheap one could have, the same cause appeared twice in this session, or the tooling was at fault rather than the code. With none of them, write `none`. The field is input for `retro`, so the fix spec does not copy it.

## The fix spec

Only on a standalone local route, and only after the user approves the report. Approving the report as printed is approving the spec, so the spec is written with `status: approved` and gets no draft commit.

Write it to `docs/specs/YYYY-MM-DD-fix-<topic>-design.md` and commit that file alone, on the current branch. Copy every field the template names from the report verbatim. A paraphrased cause is a second cause nobody refuted.

```
---
title: fix <topic>
date: YYYY-MM-DD
status: approved
---

# fix <topic>: Design

## Problem
<the report's Failure, Repro and Isolated lines>

## Goals
1. The guard test named in the report fails at BASE and passes at HEAD.
2. The failing command from Failure exits 0 at HEAD.
3. The full test suite passes at HEAD.

## Non-goals
No behaviour change other than the one the cause names.

## Constraints
No interface change.

## Approach
<the report's Cause and Refuted lines>

## Alternatives considered
N/A: a diagnosis, not a design. The refuter's result is under Approach.

## Testing
<the report's Guard line>

## Open questions
N/A: the report was approved as written.
```

If writing it shows the constraint cannot hold, the route was wrong: it is structural, and goes to `brainstorm` instead.

The spec is the only file this skill ever writes. It holds no fix and no test. Once it is committed, invoke `plan` with its path, as Handoff says.

## Repair nothing yourself

Not the fix, not the "obvious" one-liner, not the revert. Fixing what you diagnosed makes you the author of the change nobody gated, and the guard test never gets written because the bug is already gone.

## Handoff

One of your own: on a standalone local route, once the fix spec is committed, invoke `plan` with its path. Do not stop to ask: the user approved the report, and `plan`'s own review gate stands between the spec and any code. Every other route has none of your own. `exec`, `plan` or `brainstorm` takes it, and `verify` runs again from the top on whatever they produce, on a change it has not seen.
