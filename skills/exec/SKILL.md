---
name: exec
description: Use when a plan is approved and implementation has not started: dispatches one fresh subagent per task, runs each task's verify clause, and routes failures back instead of repairing them. One task, one commit.
trigger: Plan approved, implementation not yet started
gate: hard
---

# exec

Execute an approved plan, one task per fresh subagent. No task is written here
and nothing is repaired here.

## HARD-GATE

Do NOT implement any task in this session. Every task goes to a fresh subagent.

The reason is not tidiness. A session that wrote the plan reads past its own
contradictions. A fresh context reads the plan literally and stops. Every plan
defect found in this project was found by a dispatched implementer or a
reviewer, never by the author.

## Whole-plan gate

Before dispatching anything, refuse unless all of these hold:

- The plan file exists, is committed, and the user approved it.
- The spec it names carries `status: approved`.
- The working tree is clean.
- The run is on a dedicated branch or worktree, never the base branch.
- **Every task header carries a `→ verify:` clause.**

A plan missing even one clause is rejected whole, naming the task. Do not
dispatch the tasks that do have clauses and deal with the rest later. The
alternative is discovering task six is unverifiable after paying for five
dispatches.

`exec` does not create the workspace. If there is no dedicated branch, stop and
say so.

## The task loop

For each task in order:

**1. Record BASE.** `git rev-parse HEAD`, before dispatch. Every later check
measures against it. Never `HEAD~1`: a task making three commits would have two
escape the scope check silently.

**2. Write the brief to a file.** Extract this task's section from the plan
verbatim, heading, files, every step, the clause, into a scratch file, and add
one line to it: invoke `lazy` before writing any code. Pass the path. Never
paste the task into the prompt, and never hand over the whole plan. Everything
pasted into a dispatch stays in your context for the rest of the session and is
re-read on every later turn.

The line goes in the brief, not beside it. The brief is what the implementer
treats as its requirements. Anything else is framing it may reasonably ignore.

**3. Dispatch one fresh subagent.** Its prompt carries: one line on where the
task sits, the brief path introduced as its requirements to use verbatim, repo
state it cannot infer, interfaces earlier tasks produced that its brief cannot
know, and the return contract below. Restrict its tools to what the task needs,
plus whatever loads a skill. The brief tells it to invoke `lazy`, and an
instruction it has no means to obey is worse than no instruction. A constraint
the runtime enforces cannot be talked past. A constraint in prose can.

A dispatched agent inherits none of this session's modifiers. It starts unaware
of them. What you know about how much to build reaches the implementer only if
the brief says so, and naming the skill beats restating it: the ladder has one
home.

**4. Run the clause.** Execute the task's `→ verify:` command yourself. Its exit
status decides. This is the gate. There is no reviewer.

**5. Check scope.** `git diff --name-only BASE..HEAD` must be a subset of the
task's files. Every changed line traces to the task that authorised it.

Then tick the task's checkboxes and commit that plan update on its own, so the
plan always states what actually happened.

## Return contract

Three statuses. Branch on the first field.

- **`done`**: commits made as `sha: subject`, the command run and its exit
  status, and a `concerns` string, empty if none. Concerns are recorded, not
  acted on.
- **`blocked`**: cannot be completed as written. What was tried and why it
  stopped. Not a retry request.
- **`needs-input`**: a genuine ambiguity in the plan. The blocking step quoted
  verbatim, what was attempted from the brief alone, and two or more options.
  Roll back to BASE before returning, so a halt never leaves partial work.

## Repair nothing

On anything that is not `done`, halt and route. Never fix it here.

- **`needs-input`**: surface the question verbatim, wait. On an answer, the plan
  is amended by `plan`, in its own commit, then the task is dispatched fresh.
  Never patch the plan inline mid-loop: the plan and the work drift apart, and
  the drift is only found later, by a reviewer.
- **`blocked`**: surface, stop the run.
- **Clause fails**: halt. The task's own criterion said no. A failed clause is
  a failure with no diagnosis, which is what `debug` is for.
- **Scope violation**: halt, name the offending paths.

A halt leaves the branch as it was at the last completed task.

## Never

- Never dispatch two implementers at once. They conflict.
- Never fix a finding yourself. Your context is for coordination, and a fix you
  make skips the gate.
- Never re-dispatch an unchanged brief after a halt. If it stopped, something
  has to change first.
- Never batch commits across tasks.

## Name the model

Every dispatch names its model explicitly. An omitted model inherits this
session's, which is usually the most expensive one available, on tasks that
rarely need it.

Choose by task shape, not by importance:

- **Cheap tier**: the brief carries the full code and the steps are mechanical.
- **Standard tier**: the steps require judgement the brief cannot spell out.

Naming it is the point. A dispatch with no model is a cost decision made by
accident.

## Handoff

When every task is complete, the plan file is fully ticked and the branch holds
one or more commits per task. The next skill is `verify`. Say plainly what ran
and what remains unproven.
