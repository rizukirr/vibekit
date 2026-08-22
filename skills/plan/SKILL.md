---
name: plan
description: Use when a spec is approved and implementation has not started: turns it into a task-by-task plan with exact paths and checkable verification. No code here.
trigger: Spec approved, implementation not yet started
gate: hard
---

# plan

Turn an approved spec into an implementation plan. No code is written here.

## HARD-GATE

Do NOT implement anything until a plan file exists and the user has approved it.

The gate has one precondition, and it is checkable rather than asserted: a spec
file exists carrying `status: approved` in its frontmatter. If there is none,
stop and invoke `brainstorm`. A plan built on a draft is a plan built on
something the user may still change.

## The spec is settled

Read it, do not re-litigate it. Questions it already answered are not asked
again. A defect found in it goes back to the user as a question: never a silent
edit, because the approved artefact is what the user signed.

## Refusals

- **Spec spans independent subsystems.** Say so before writing any task. One
  plan per subsystem, each producing working software on its own.
- **A requirement has no possible verify clause.** Not a licence to write a weak
  one. Either the task boundary is wrong and splits, or the requirement is
  unobservable and goes back to the user as a question.

## Plan document

Write to `docs/plans/YYYY-MM-DD-<topic>.md`, then commit: that file alone.

```
# <topic>: Implementation Plan

**Spec:** docs/specs/<file>.md
**Goal:** one sentence
**Architecture:** two or three sentences

## Global constraints
- <one line each, values copied verbatim from the spec>
```

Global constraints are the spec's project-wide requirements: version floors,
dependency limits, naming rules. Stated once, they are implicitly part of every
task, so no task restates them and no task author has to remember them.

## Task shape

```
### Task N: <name> → verify: <predicate>

**Files:**
- Create: `exact/path`
- Modify: `exact/path:12-40`

- [ ] Step 1: <one action>
- [ ] Step 2: Run `<command>`
- [ ] Step N: Commit

```

A task is the smallest unit worth a fresh reviewer's gate. Fold setup, config
and documentation into the task whose deliverable needs them. Split only where a
reviewer could reject one task while approving its neighbour. Each task ends
with an independently testable deliverable and one commit.

Steps that change code carry the actual code. A step that runs a command names
the command and stops there.

## You may not write a value you have not observed

Every value this plan states, a number, a path, a count, a cross-reference,
must be one you observed. You read it, you ran it, or you chose it as a
threshold. A value you recalled is a guess, and a guess in a plan is a defect a
fresh implementer pays for: they follow the plan exactly, hit a contradiction,
and stop.

Two ways to satisfy it. Derive the value before writing it, usually one command
and a few seconds. Or state the property instead of the value: "every new case
passes" rather than "three cases pass".

**A clause is the strictest case.** A `→ verify:` clause states a predicate:
something checkable by a reader of the plan, before anything runs. Not a
transcript.

**Predicates:** exit status, pass or fail, a file exists, a match count at or
above a threshold, an HTTP status.

**Not predicates:** a quoted message, a specific count, a diff, a sample of
output. Each is a claim about a future you have not seen. When one is wrong, the
executing agent cannot tell whether the code failed or the plan lied, and it
will assume the code.

A number is not itself the tell. Three forms carry one legitimately: an exit
status, an HTTP status, and a threshold in either direction (at least 1 match,
under 120 lines). Any other number in a clause is a predicted value. A threshold
is derivable because you chose it. A predicted value is not, because the runtime
chooses it.

Spelling a number out does not launder it. "The four cases pass" is a count, and
the first plan written under this rule got that count wrong.

Naming your command in a code span is not quoting. Backticks delimit what to
run. Straight quotes are how a predicted transcript gets in.

If a specific value is genuinely load-bearing, the task's first step **observes
it**, and the clause refers to the observation instead of a guess.

A clause must be satisfiable by the task it belongs to. If you cannot say what
would make it true, the task boundary is wrong, not the clause.

**Outside a clause the rule still holds, and there is no allowlist.** A line
count in a task title, a path in a Files block, a version in Global constraints,
a reference to another task by number: each is a value, so each was read, run,
or chosen. None may be recalled.

## No placeholders

`TBD`, `TODO`, "add error handling", "similar to Task N", and any reference to a
function no task defines are plan failures, not shorthand. Repeat the code:
tasks get read out of order.

## Self-review

1. **Spec coverage.** Every requirement maps to a task. Add any that is missing.
2. **Placeholders.** Scan for the patterns above. Fix them.
3. **Clauses.** Scan every `→ verify:` for a quoted string, or a number outside
   the three permitted forms. Both are predicted output. Fix them.
4. **Provenance.** For every number, path, count and cross-reference in the
   plan, name where it came from. "I ran it" and "I read it" pass. "I knew it"
   is a guess: derive it, or state a property instead.

Fix inline. No re-review.

## User review gate

Send exactly this, verbatim:

> Plan written and committed to `<path>`. Please review it and let me know if you want to make any changes before we start implementing.

Wait. On requested changes, make them and re-run self-review.

## Handoff

The only next skill is `exec`, which does not exist yet. Say so plainly: the
plan is written, committed and approved, and execution waits for the skill that
consumes it. Never invoke an implementation skill from here.
