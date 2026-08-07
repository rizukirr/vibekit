---
name: verify
description: Use before claiming a change is done, fixed or passing — checks the whole change against its spec, runs the checks no single task could, and returns ready or not ready. Evidence or it did not happen.
trigger: Implementation complete, before any claim that work is done
gate: hard
---

# verify

Does this change satisfy its spec? Answer with evidence, or do not answer.

`exec` ran every task's clause, so per-task mechanics are already covered. This
is the whole-change gate. Seeing one task at a time is what makes `exec` safe,
and it is also why nothing there can notice Task 2 undoing Task 1.

## HARD-GATE

Do NOT claim work is done, fixed, complete or passing, and do not invoke
`finish` or any outward-facing skill, until this returns `ready` and the user
has signed off.

## Three rules

**Evidence or it did not happen.** A check with no output to show is not a
check. Every verdict below names what you ran or read.

**Unmeasured is not satisfied.** A goal whose criterion is a run that never ran
is `not satisfied`. Reading the code is not a substitute for running it, and no
amount of re-reading turns unmeasured into satisfied.

**Report what you could not observe.** A verdict that hides its gaps reads as
evidence while proving nothing — the instrument is wrong at least as often as
the change is. Say what you could not check, every time, inside the verdict.

## 1. Preconditions

- An approved spec with a `## Goals` section.
- A plan whose tasks are all ticked.
- A clean working tree.

Any of them missing: stop and name it. Do not partially verify an unfinished
run.

| Input | Source |
|---|---|
| spec | `exec`'s handoff, else the newest approved spec under `docs/specs/` |
| plan | the spec's matching plan |
| `BASE` | `git merge-base` of this branch and the base branch |
| diff | `git diff BASE..HEAD` |

If the handoff did not carry the paths, derive them and say which you derived. A
verdict against the wrong spec is worse than no verdict.

## 2. Repo-level sweep

The checks no single task could make:

- The full test suite.
- The project's build or check command, if it has one.
- `git status --porcelain` is empty.
- Every file in the diff appears in some task's `Files` block, except this run's
  own spec and plan.

The last one is the cross-task check with no other home. A changed file that no
task claimed is either scope creep or one task quietly editing another's work.

The exemption is not a loophole. `exec` ticks checkboxes and commits the plan as
it goes, so the plan is changed by every run and claimed by no task. Without the
exemption this check fires every time, and a check that always fires is ignored
exactly like one that never fires.

A command that errors rather than fails — a missing script, a binary that is not
installed — is unobserved, not passed. Say so.

## 3. Goals walk

Every goal in the spec, one at a time, with the evidence behind it.

- **`satisfied`** — you observed the criterion hold.
- **`not satisfied`** — you observed it fail, or its criterion never ran.
- **`partial`** — the criterion has parts, some observed, the rest named.

`partial` is for a criterion that genuinely splits, never a hedge on one you
skipped. That one is `not satisfied`.

A goal with no observable criterion is `not satisfied`, reason: no observable
criterion. Do not invent one. A criterion written at verify time grades the
change against a spec nobody approved.

Non-goals get the same walk inverted: anything the spec ruled out and the diff
built is a blocker.

## 4. The lazy read

Walk `lazy`'s ladder against the diff. The rungs, as questions:

- Does anything added already exist in this codebase?
- Was a dependency added where a few lines would do?
- Is there an interface with one implementation, or a factory for one product?
- Is there scaffolding for a need that has not arrived?
- Does every deliberate shortcut carry a `vibekit:` comment naming its ceiling?

Report each violation as `file:line` and the rung it breaks. This is a judgement,
and it is not self-grading: `exec` dispatched the implementer, so the code you
are reading is not code you wrote.

## Severity

Every finding carries one. Severity is about consequence, and it is not the same
question as a goal's verdict, which is about evidence.

- **`blocker`** — a failed sweep check, a goal observed to fail, an unmeasured
  goal, a non-goal the diff built. **Only a blocker produces `not ready`.**
- **`warn`** — a ladder violation whose fix would change behaviour, or a
  `partial` goal.
- **`nit`** — a ladder violation whose fix cannot change behaviour.

A `warn` or a `nit` never gates. Treating one as a blocker halts a pipeline over
a name, and a gate that fires on everything is ignored exactly like one that
fires on nothing.

**Fixability is a second, independent question: a finding is auto-fixable only
if fixing it cannot change behaviour.** A `nit` whose fix would alter behaviour
still reaches the user, and a `blocker` that is a pure rename does not.

## 5. The bounded fix loop

If any finding is auto-fixable, dispatch **one** fresh subagent carrying all of
them in a single brief. Never one dispatch per finding — two implementers on one
diff conflict.

Confine the fix agent to files already in the diff. A fix reaching outside it is
a `blocker`, not a fix: the fix belongs to no task's `Files` block, so without
the confinement it trips the sweep's scope check on the next round.

Then run the sweep and the ladder again from the top. **The re-run is the gate on
the fix.** A fix that breaks a test comes back as a failed check, which is a
`blocker` — no special handling, and no way for a repair to slip past unchecked.

Stop at the first of these: a round produced no new findings, or one round
completed. Anything still open is carried to the ending as information, never
retried. A ladder finding has no exit status to converge on, so the bound is what
makes stopping a property rather than a hope.

If the fix agent returns anything but success, the loop ends and its findings
stay open. Do not answer its question yourself.

## Verdict

Report in the conversation. Write nothing, commit nothing.

```
Sweep:   one line per check, with what it returned
Goals:   one line per goal — verdict, then the evidence
Fixed:   what the loop fixed, or none
Open:    remaining warns and nits, each with its severity
Unseen:  what you could not observe, and why
Verdict: ready | not ready
```

`not ready` requires a blocker. There is no `ready with caveats` — a caveat is a
blocker looking for a waiver.

## The ending

Both exits end with the user. Present, then wait.

**On `ready`** — the `git diff --stat` summary, the open warns and nits, and
three ways this change could be wrong that the tests would not catch. Then:
approve, fix, or abort. Approval is always available. Only the user blocks: the
risk list is judgement with nothing behind it, and letting an unevidenced guess
veto the person whose code it is inverts who decides.

**On `not ready`** — every blocker with its evidence, then the routing choice. A
failing test or build belongs to `debug`. A goal this plan cannot satisfy belongs
to `plan`. A ladder violation belongs to `exec` as a new task. The user picks,
and may override with the gap named and on the record.

## Repair nothing yourself

The loop dispatches; you do not edit. Fixing what you find makes you the author
of the change you are gating, and then there is no gate.

## Handoff

On approval, the next skill is `finish`. Otherwise nothing downstream runs until
every blocker is closed and `verify` runs again from the top.
