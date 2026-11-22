# parallel exec: Implementation Plan

**Spec:** docs/specs/2026-11-22-parallel-exec-design.md
**Goal:** Let `exec` run plan tasks that do not depend on each other at the same time, each in its own git worktree.
**Architecture:** `plan` gains a `**Blocked by:**` line per task. `exec` runs the plan in waves of ready tasks with disjoint files, up to 3, landing each by cherry-pick in plan order. `decide` stops treating `exec`'s own temporary branches as a branch deletion.

## Global constraints
- No new dependency.
- Every edited string obeys `plain`'s rules, which `npm test` checks.
- Generated files change only through `npm run generate`.
- A plan with no `Blocked by` lines runs exactly as it does today, one task at a time on the run branch.
- `exec` deletes only worktrees and branches it created in the same run.

### Task 1: plan tasks say what they wait for → verify: `grep -q 'Blocked by' skills/plan/SKILL.md` exits 0 and `npm test` exits 0

**Blocked by:** none

**Files:**
- Modify: `skills/plan/SKILL.md:47-59,96`

- [x] Step 1: In `skills/plan/SKILL.md`, in the task shape block, replace the line `### Task N: <name> → verify: <predicate>` and the blank line after it with:

```
### Task N: <name> → verify: <predicate>

**Blocked by:** none | Task 1, Task 3

```

- [x] Step 2: In `skills/plan/SKILL.md`, after the paragraph that starts `A task is the smallest unit worth a fresh reviewer's gate.`, insert a blank line and this paragraph:

```
`**Blocked by:**` names the tasks this one waits for: `none`, or earlier tasks such as `Task 1, Task 3`. A task without the line waits for the task before it, and Task 1 without it waits for nothing. Name only tasks numbered before this one, so a cycle cannot be written. Write `none` only when the task needs nothing an earlier task produces, such as an interface, a file or a passing check: `exec` runs tasks with no path between them at the same time.
```

- [x] Step 3: In `skills/plan/SKILL.md`, after the self-review item that starts `4. **Provenance.**`, add:

```
5. **Edges.** Every `Blocked by` names only earlier tasks. Two tasks that share a file need a `Blocked by` path between them: `exec` runs them one after the other anyway, and the plan should say so.
```

- [x] Step 4: Run `npm test`
- [x] Step 5: Commit `feat(plan): tasks say what they wait for`

### Task 2: exec runs independent tasks in waves → verify: `grep -q 'Never dispatch two implementers at once' skills/exec/SKILL.md` exits 1, `grep -q 'git worktree add' skills/exec/SKILL.md` exits 0, `npm run check` exits 0 and `npm test` exits 0

**Blocked by:** none

**Files:**
- Modify: `skills/exec/SKILL.md:25,32-34,73`
- Modify: `README.md:28`

- [x] Step 1: In `skills/exec/SKILL.md`, in the whole-plan gate list, after the line `- The run is on a dedicated branch or worktree, never the base branch.`, add:

```
- Every `**Blocked by:**` line names only tasks numbered before its own.
```

- [x] Step 2: In `skills/exec/SKILL.md`, replace the two lines `## The task loop`, the blank line, and `For each task in order:` with:

```
## Waves

A task's `**Blocked by:**` line names the tasks it waits for. A task without the line waits for the task before it, and Task 1 without it waits for nothing.

Run the plan in waves. A wave is every task not yet done whose blockers are all done, in plan order, up to 3 tasks. A task that shares a file with an earlier task in the wave waits for a later wave.

A wave of one runs the task loop below on the run branch, exactly as a plan with no `Blocked by` lines always has.

A wave of more than one gives each task its own worktree:

1. Record BASE as the run branch's HEAD. For each task, run `git worktree add -b exec/task-<N> <dir> BASE`, with `<dir>` a new temporary directory outside the repository.
2. Write each brief as in the task loop, and dispatch every agent in the background at once, each told its worktree path and to work and commit only there.
3. When every agent has returned, run each task's clause inside its worktree, and its scope check as `git diff --name-only BASE..exec/task-<N>`.
4. In plan order, for each task that passed: `git cherry-pick BASE..exec/task-<N>` onto the run branch, run the clause again on the run branch, then tick the task and commit the tick on its own.
5. Remove each landed task's worktree with `git worktree remove <dir>` and its branch with `git branch -D exec/task-<N>`. These are the only worktrees and branches `exec` deletes, and only ones it created in this run.

If the runtime cannot dispatch subagents concurrently, run the wave's tasks one at a time in plan order through the task loop on the run branch, with no worktrees.

A task in a wave that returns anything but `done`, fails its clause or breaks its scope stops the next wave. Land the tasks that passed as in step 4, leave the failed task's worktree in place for `debug`, and halt as **Repair nothing** says. A clause that passes in the worktree and fails on the run branch halts the same way.

## The task loop

For each task in a wave of one:
```

- [x] Step 3: In `skills/exec/SKILL.md`, replace the line `- Never dispatch two implementers at once. They conflict.` with:

```
- Never put two tasks that share a file in one wave. They conflict.
```

- [x] Step 4: In `README.md`, replace the line that starts `` - **`exec`** dispatches one fresh agent per task. `` with:

```
- **`exec`** dispatches one fresh agent per task. The author of a plan reads past its own contradictions. A fresh context reads it literally and stops. Every plan defect this project has found was found by a dispatched agent. Tasks the plan marks as independent run at the same time, up to 3, each in its own git worktree.
```

- [x] Step 5: Run `npm run check`
- [x] Step 6: Run `npm test`
- [x] Step 7: Commit `feat(exec): run independent tasks in waves`

### Task 3: decide lets exec clean up its own branches → verify: `grep -q 'within its own run' skills/decide/SKILL.md` exits 0 and `npm test` exits 0

**Blocked by:** none

**Files:**
- Modify: `skills/decide/SKILL.md:32`

- [x] Step 1: In `skills/decide/SKILL.md`, replace the line `- Deleting a file that is not on the run's branch, rewriting history, or deleting a branch.` with:

```
- Deleting a file that is not on the run's branch, rewriting history, or deleting a branch. The worktrees and branches `exec` creates and removes within its own run are not this door.
```

- [x] Step 2: Run `npm test`
- [x] Step 3: Commit `feat(decide): exec's own branches are not a one-way door`

### Task 4: wave worktrees survive a re-run and have dependencies → verify: `grep -q 'exec/task-<N>' skills/exec/SKILL.md` exits 1, `grep -q 'installed dependencies' skills/exec/SKILL.md` exits 0 and `npm test` exits 0

Added after verify round 1: a branch a halted wave leaves for `debug` blocks the same task's next worktree, and a fresh worktree has no installed dependencies.

**Blocked by:** Task 2

**Files:**
- Modify: `skills/exec/SKILL.md:43-47`

- [x] Step 1: In `skills/exec/SKILL.md`, replace every occurrence of `exec/task-<N>` with `exec/<BASE>-task-<N>`. Run `grep -c 'exec/task-<N>' skills/exec/SKILL.md` and confirm it prints 0.
- [x] Step 2: In `skills/exec/SKILL.md`, replace the line that starts `1. Record BASE as the run branch's HEAD.` with:

```
1. Record BASE as the run branch's HEAD. For each task, run `git worktree add -b exec/<BASE>-task-<N> <dir> BASE`, with `<BASE>` its first 7 characters and `<dir>` a new temporary directory outside the repository. Naming the branch after BASE keeps it clear of one a halted wave left for `debug`. A fresh worktree has none of the project's installed dependencies, so install them there the way the run branch has them, such as `npm ci`, before dispatch.
```

- [x] Step 3: Run `npm test`
- [x] Step 4: Commit `fix(exec): wave worktrees survive a re-run and have dependencies`
