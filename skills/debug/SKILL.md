---
name: debug
description: Use when a check fails: a red test, a broken build, a failed clause, or a bug you can point at. Finds a root cause and gets it refuted before anything is fixed. Diagnosis is the product. This skill never edits.
trigger: A check failed: verify returned not ready on a failed check, an exec clause failed, or a failure was reported
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

- **Local**: one function or file, no interface change. Routes to `exec` as a new task.
- **Structural**: crosses a boundary, changes an interface, needs design. Routes to `plan` as the problem statement for a new plan.
- **`unreproducible`**: routes nothing. The user decides.
- **Refuted twice**: routes nothing. The user decides.

Every routed fix carries a **guard test that fails before the fix and passes after**. Without the pre-fix failure it is not a guard, it is a test that happens to be green, and a check that cannot fail is not a check.

Name the guard test in the route. Do not write it.

## The report

Report in the conversation. Write nothing, commit nothing.

```
Failure:  the command, its exit status, and its output verbatim
Repro:    how you made it fail, and how many times, or why you could not
Isolated: the commit, the hunk, or the conditions
Cause:    one falsifiable claim, with file:line
Refuted:  what the refuter returned, both times if there were two
Guard:    the test the fix must add, and what makes it fail today
Route:    exec | plan | user
```

## Repair nothing yourself

Not the fix, not the "obvious" one-liner, not the revert. Fixing what you diagnosed makes you the author of the change nobody gated, and the guard test never gets written because the bug is already gone.

## Handoff

None of your own. `exec` or `plan` takes the route, and `verify` runs again from the top on whatever they produce, on a change it has not seen.
