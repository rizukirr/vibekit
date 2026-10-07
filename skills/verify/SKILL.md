---
name: verify
description: "Use before claiming a change is done, fixed or passing: checks the whole change against its spec, runs the checks no single task could, hunts for the bugs the change produced, and returns ready or not ready. Evidence or it did not happen."
trigger: Implementation complete, before any claim that work is done
gate: hard
---

# verify

Does this change satisfy its spec? Answer with evidence, or do not answer.

`exec` ran every task's clause, so per-task mechanics are already covered. This is the whole-change gate. Seeing one task at a time is what makes `exec` safe, and it is also why nothing there can notice Task 2 undoing Task 1.

## HARD-GATE

Do NOT claim work is done, fixed, complete or passing, and do not push, merge or open a pull request, until this returns `ready` and the user has signed off.

## Three rules

**Evidence or it did not happen.** A check with no output to show is not a check. Every verdict below names what you ran or read.

**Unmeasured is not satisfied.** A goal whose criterion is a run that never ran is `not satisfied`. Reading the code is not a substitute for running it, and no amount of re-reading turns unmeasured into satisfied.

**Report what you could not observe.** A verdict that hides its gaps reads as evidence while proving nothing. The instrument is wrong at least as often as the change is. Say what you could not check, every time, inside the verdict.

## 1. Preconditions

- An approved spec with a `## Goals` section.
- A plan whose tasks are all ticked.
- A clean working tree.

Any of them missing: stop and name it. Do not partially verify an unfinished run.

| Input | Source |
|---|---|
| spec | `exec`'s handoff, else the newest approved spec under `docs/specs/` |
| plan | the spec's matching plan |
| base branch | the branch this one was cut from, which is not always the repo's default |
| `BASE` | `git merge-base` of this branch and the base branch |
| diff | `git diff BASE..HEAD` |

If the handoff did not carry the paths, derive them and say which you derived. A verdict against the wrong spec is worse than no verdict.

## 2. Repo-level sweep

Record `git rev-parse HEAD` first and report it. Everything below measures that commit, and the integration step refuses to ship against any other.

The checks no single task could make:

- The full test suite.
- The project's build or check command, if it has one.
- `git status --porcelain` is empty.
- Every file in the diff appears in some task's `Files` block, except this run's own spec and plan.

The last one is the cross-task check with no other home. A changed file that no task claimed is either scope creep or one task quietly editing another's work.

The exemption is not a loophole. `exec` ticks checkboxes and commits the plan as it goes, so the plan is changed by every run and claimed by no task. Without the exemption this check fires every time, and a check that always fires is ignored exactly like one that never fires.

A command that errors rather than fails, a missing script, a binary that is not installed, is unobserved, not passed. Say so.

## 3. Goals walk

Every goal in the spec, one at a time, with the evidence behind it.

- **`satisfied`**: you observed the criterion hold.
- **`not satisfied`**: you observed it fail, or its criterion never ran.
- **`partial`**: the criterion has parts, some observed, the rest named.

`partial` is for a criterion that genuinely splits, never a hedge on one you skipped. That one is `not satisfied`.

A goal with no observable criterion is `not satisfied`, reason: no observable criterion. Do not invent one. A criterion written at verify time grades the change against a spec nobody approved.

Non-goals get the same walk inverted: anything the spec ruled out and the diff built is a blocker.

## 4. The lazy read

Walk `lazy`'s ladder against the diff. The rungs, as questions:

- Does anything added already exist in this codebase?
- Was a dependency added where a few lines would do?
- Is there an interface with one implementation, or a factory for one product?
- Is there scaffolding for a need that has not arrived?
- Does every deliberate shortcut carry a `vibekit:` comment naming its ceiling?

Report each violation as `file:line` and the rung it breaks. This is a judgement, and it is not self-grading: `exec` dispatched the implementer, so the code you are reading is not code you wrote.

## 5. The bug hunt

The spec says what the change must do. It does not say what the change must not break, and the goals walk cannot see behaviour no goal mentions. Hunt for it.

Scope is the diff, plus the callers of every function, export or command the diff changed. A bug that reproduces identically at `BASE` was not produced by this change: name it in `Open` as pre-existing, and it never gates.

1. **List suspects.** Each is one falsifiable claim with `file:line`: this input, this result, and what the result should be.
2. **Name the reference.** Three count as settled: the behaviour at `BASE`, a goal or constraint in the spec, or a crash on input the code plainly accepts. Anything else has no settled reference, and you say so. A difference from `BASE` that the spec asks for is not a suspect.
3. **Reproduce.** One command per suspect, with its output kept. A regression runs the same input at `BASE` and at `HEAD`.

A reproduction writes nothing into the working tree. Run it inline, or from a temporary directory outside the repository. The `BASE` side runs in a temporary `git worktree`, removed afterwards. One you cannot remove goes in `Unseen` with its path.

- **`demonstrated`**: the command ran and shows the wrong behaviour. Wrong on some runs only still counts: report how many out of how many.
- **`suspected`**: the command could not be run. Quote the error or name the reason. A command that errors proves nothing, exactly as in the sweep.
- **dropped**: the command ran and shows correct behaviour. Count these in the verdict.

Reading is how you find a suspect, never how you confirm one. A bug you only read about is `suspected`, however sure you are.

## Severity

Every finding carries one. Severity is about consequence, and it is not the same question as a goal's verdict, which is about evidence.

- **`blocker`**: a failed sweep check, a goal observed to fail, an unmeasured goal, a non-goal the diff built, a demonstrated bug. **Only a blocker produces `not ready`.**
- **`warn`**: a ladder violation whose fix would change behaviour, a `partial` goal, or a suspected bug.
- **`nit`**: a ladder violation whose fix cannot change behaviour.

**An unobserved part is a `blocker` even inside a `partial` goal.** A goal whose criterion has several parts, one of them never run, is not laundered into a `warn` by the parts that passed. Unmeasured gates regardless of its company.

A `warn` or a `nit` never gates. Treating one as a blocker halts a pipeline over a name, and a gate that fires on everything is ignored exactly like one that fires on nothing.

**Fixability is a second, independent question. A finding is auto-fixable in two cases: fixing it cannot change behaviour, or it is a demonstrated bug whose reference is settled.** A `nit` whose fix would alter behaviour still reaches the user, and a `blocker` that is a pure rename does not. A demonstrated bug with no settled reference is never auto-fixed: choosing its correct behaviour is a decision, and decisions belong to the user.

## 6. The bounded fix loop

If any finding is auto-fixable, dispatch **one** fresh subagent carrying all of them in a single brief. Never one dispatch per finding: two implementers on one diff conflict.
For a bug, the brief carries the reproduction command, its output verbatim, the reference, and the expected result. The fix agent adds the reproduction as a test when a test file is already in the diff. With none in the diff it adds no test, and you say so in `Unseen`: a new test file belongs to no task, so it would trip the scope check.

Confine the fix agent to files already in the diff. A fix reaching outside it is a `blocker`, not a fix: the fix belongs to no task's `Files` block, so without the confinement it trips the sweep's scope check on the next round. A bug whose fix needs a file outside the diff is not dispatched at all: it stays a `blocker` and reaches the user.

Then run the sweep and the ladder again from the top, with every reproduction command added to the sweep. **The re-run is the gate on the fix.** A fix that breaks a test comes back as a failed check, and a reproduction still showing the wrong behaviour comes back as a demonstrated bug. Both are `blocker`s: no special handling, and no way for a repair to slip past unchecked.

Stop at the first of these: a round produced no new findings, or one round completed. Anything still open is carried to the ending as information, never retried. A ladder finding has no exit status to converge on, so the bound is what makes stopping a property rather than a hope.
After the round, hunt once more over the fix commit only. Anything that hunt demonstrates is a `blocker` carried to the user and never auto-fixed: a fix that breaks something else does not earn a second unattended round.

If the fix agent returns anything but success, the loop ends and its findings stay open. Do not answer its question yourself.

## Verdict

Report in the conversation. Write nothing, commit nothing.

```
Swept:   the HEAD every check below ran against
Sweep:   one line per check, with what it returned
Goals:   one line per goal, verdict, then the evidence
Bugs:    one line per suspect: demonstrated or suspected, the claim with file:line, the reference,
         then the command and what it returned, or why it could not run. Then the count dropped.
         With no suspects, say so and name what you read and ran
Fixed:   what the loop fixed, each bug with its reproduction before and after, or none
Open:    remaining warns and nits, each with its severity, and any pre-existing bug
Unseen:  what you could not observe, and why
Verdict: ready | not ready
```

`not ready` requires a blocker. There is no `ready with caveats`: a caveat is a blocker looking for a waiver.

## The ending

Both exits end with the user. Present, then wait.

**On `ready`**: the `git diff --stat` summary, the open warns and nits, and every suspected bug with the reason it could not be reproduced. Then: approve, fix, or abort. Approval is always available. Only the user blocks: a suspected bug is judgement with nothing run behind it, and letting an unevidenced guess veto the person whose code it is inverts who decides.

**On `not ready`**: every blocker with its evidence, then the routing choice. A failing test or build belongs to `debug`. A goal this plan cannot satisfy belongs to `plan`. A ladder violation belongs to `exec` as a new task. The user picks, and may override with the gap named and on the record. A demonstrated bug gets three choices of its own: fixing it belongs to `debug`, amending the spec belongs to `brainstorm`, where the behaviour becomes a goal or a non-goal, and keeping it as is is the override.

## 7. Integration

Reachable only after approval, and only the one option the user picks. Never two in one run: a second one is a second decision, made again.

- **Merge locally**: `git switch <base-branch>`, then `git merge --no-ff <branch>`. No push, and the branch stays. On conflict, stop and leave it conflicted: you did not write this code, and resolving it here is the repair this skill refuses everywhere else.
- **Push and open a PR**: `git push -u origin <branch>`, then `gh pr create`. Title from the spec's title, never the branch name. The body names the spec, the plan, what the sweep ran, and the open warns and nits. Print the URL.
- **Keep as is**: nothing runs. Say so in one line.

Before any of them, two checks: the tree is clean, and `git rev-parse HEAD` equals the `Swept:` line of the verdict. A commit landing while the user decided makes the verdict stale, so say so and run again from the top rather than shipping what nothing checked. Compare the written value, never a remembered one.

Never force-push. Never delete a branch, local or remote. Never merge with a dirty tree. Never pass `--no-verify`.

## Repair nothing yourself

The loop dispatches. You do not edit. Fixing what you find makes you the author of the change you are gating, and then there is no gate.

Integrating is not repairing. A merge the user asked for adds no line you wrote and happens after the verdict rather than in order to reach one.

## Handoff

None. Integration ends the pipeline. Nothing else runs until every blocker is closed and `verify` runs again from the top.
