---
name: decide
description: "Loaded by repl: answers every question a skill would put to the user during an unattended run. Settled answers are followed, one-way doors pause, experiments settle what they can, and two-way doors are decided and logged."
trigger: Loaded by repl at the start of its run, never fires on its own
gate: none
command: false
---

# decide

In a `repl` run, nobody is there to ask. Every question a skill would put to the user comes here instead, and gets one of three answers: follow what is settled, pause for the user, or decide and continue.

This skill applies only inside a `repl` run. Outside one, the user decides, as every other skill says.

## 1. Settled

The first of these that answers the question wins:

1. The user's explicit instructions in this session.
2. The approved spec: goals, non-goals, constraints including run limits, and Approach.
3. The plan.
4. The rules file and any ADRs.
5. `verify`'s settled references: the behaviour at BASE, a goal or constraint in the spec, or a crash on input the code plainly accepts.

Follow it, log it as settled, and reopen nothing. A settled answer you dislike is still settled.

## 2. One-way doors

Pause on any of these. They belong to the user, whatever the run limits say:

- An action visible outside the machine: a push, a pull request, a merge, a deploy, or sending data anywhere.
- Deleting a file that is not on the run's branch, rewriting history, or deleting a branch.
- Auth, secrets, permissions, or a trust boundary.
- Spending beyond the run's budget.
- A new runtime dependency, or a change to a public interface or stored data that the spec does not name.
- Weakening a check: editing a test's assertions, special-casing an input, disabling or loosening a check, or weakening a spec goal or its criterion. A check that cannot pass honestly is a finding, never a thing to edit.
- Choosing correct behaviour where no settled reference exists and extending the spec would pick a product direction.
- A dead end, where every path forward is a guess.

Pausing is an honest outcome, not a failure to try harder.

## 3. Experiment

Before calling a question a matter of preference, ask whether a small throwaway run or measurement would settle it. If it would, run it outside the working tree and decide from the result. Log the command and what it returned.

## 4. Two-way doors

Everything else is in the repo, under version control, and inside the task's scope. Decide it:

1. Climb `lazy`'s ladder.
2. Pick what serves the spec's goals most directly.
3. Between options of the same size, take the one correct on edge cases.

Pick one and continue. Do not stall and do not ask: a wrong two-way call costs less than a blocked run, and the log shows the user every one.

## 5. Limits

- Never retry anything unchanged. If it failed, something changes first.
- Three failures on the same thing is a dead end, so pause.
- At the round cap, an open warn or nit may be set aside with a ruling. An open blocker never can.

## The ruling

Every answer, settled or decided, is one row in `repl`'s decision log: what was decided, why, the evidence as a pointer, and the result. A paused question gets a row too, naming the door.
