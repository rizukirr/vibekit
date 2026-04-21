---
name: isolate
description: Use after a plan is approved and before any implementation dispatch. Creates an isolated workspace — a git worktree (preferred) or a fresh branch — scoped to the current vibe run. Prevents in-progress work from mixing with the user's other work, makes rollback cheap, and gives exec-dispatch a clean slate to operate in.
---

# isolate

## Overview

Create a workspace that is dedicated to one vibe run, named after the run, branched from the user's current base, and guaranteed clean at creation. All implementation commits land in this workspace. Rollback = delete the worktree / branch.

Two modes: **worktree** (default, preferred) and **branch** (fallback when worktrees are unavailable or the user prefers it).

## When to invoke

- After `plan-write` has produced and committed a plan and the user has chosen an execution mode.
- Before the first `exec-dispatch` task.
- Only once per vibe run. Subsequent tasks in the same run reuse the same workspace.

Do not invoke:
- On read-only / exploratory work.
- On runs the user explicitly scoped to "edit in place".
- If an isolated workspace for this run already exists — reuse it.

## Naming convention

Derive from the vibe run or the spec:

- Worktree path: `<repo>/.vibe-worktrees/<run-id>/` where `<run-id>` is `YYYY-MM-DD-<slug>` taken from the spec filename.
- Branch name: `vibe/<slug>` where `<slug>` is the spec's filename slug.

Examples for a spec at `docs/specs/2026-04-21-kebab-design.md`:
- Worktree path: `.vibe-worktrees/2026-04-21-kebab/`
- Branch name: `vibe/kebab`

Override: if the user has configured a different naming scheme (in project memory or CLAUDE.md), follow theirs.

## Preconditions (check before creating anything)

- [ ] The current repo is a git repo (`.git/` exists).
- [ ] The working tree is clean OR the user has explicitly authorized the pending changes to be carried into the new workspace.
- [ ] The chosen branch name / worktree path does not already exist. If it does, stop and offer to resume the existing workspace instead of creating a duplicate.
- [ ] The current branch is the expected base for this work (usually `main` / `master` / `develop`). If `HEAD` is detached or on an unexpected branch, surface this and ask the user.

If any precondition fails, do not create the workspace. Surface the failure.

## Mode 1 — worktree (default)

Worktrees give full filesystem isolation and let the user's main workspace continue untouched. Preferred whenever supported.

Commands:

```
git worktree add -b vibe/<slug> .vibe-worktrees/<run-id> <base-branch>
cd .vibe-worktrees/<run-id>
```

After creation:
- Every subsequent dispatch runs with the worktree as its working directory.
- The spec and plan files already committed on `<base-branch>` are visible (same repo, same git objects). Subagents read them with `git show` or direct `Read`.
- Worktree cleanup (after merge or abandonment): `git worktree remove .vibe-worktrees/<run-id>` plus `git branch -D vibe/<slug>` if the user wants the branch gone.

Record:
- The worktree path + branch name in the vibe run log so subsequent stages find it.

## Mode 2 — branch (fallback)

When worktrees are unavailable (shallow clone, certain CI environments, explicit user preference):

```
git switch -c vibe/<slug> <base-branch>
```

Constraints:
- The user's working tree is now on the new branch. If they had uncommitted work not authorized to carry, the preconditions check should have caught this already.
- Rollback is less clean: `git switch <base-branch>` + optional `git branch -D vibe/<slug>`.

## `.gitignore` additions

When using worktree mode, ensure the worktree directory is ignored at the repo root:

```
# .gitignore
.vibe-worktrees/
```

Add this line only if not already present. Commit the .gitignore change on the base branch before creating the worktree, so the worktree's creation does not dirty the main tree.

## Report (return value to the caller)

After successful creation, return a small structured record:

```json
{
  "mode": "worktree | branch",
  "path": "<absolute path of working directory the next stage should use>",
  "branch": "vibe/<slug>",
  "base": "<base branch name>",
  "base_sha": "<sha>"
}
```

Caller (usually `vibe`) uses this record for the remainder of the pipeline: exec-dispatch briefs cite the path, verify-gate runs there, finish-branch uses the branch name.

## Failure modes

- **Dirty working tree, user not authorized.** Stop. Ask the user whether to stash, commit, or abort.
- **Branch / worktree path collision.** Stop. Ask the user whether to resume the existing workspace, rename, or abort. Do not delete the existing workspace.
- **Base branch does not exist or is detached.** Stop. Ask the user to specify a base.
- **Worktree creation fails (e.g. on network-mounted filesystem).** Fall back to branch mode and note the fallback in the returned record.
- **Disk space exhausted.** Stop. Surface the specific error; do not half-create and leave the repo in a mixed state.

On any failure, leave the repo in exactly the state it started in. This skill's operations are atomic from the user's perspective: either the workspace exists as requested or nothing changed.

## Anti-patterns

- Creating a worktree without first ensuring `.gitignore` excludes its parent directory. The next commit on the base branch would otherwise pull the worktree in as a dirty submodule.
- Silently switching the user to a new branch in branch mode without surfacing the change. Always announce the mode and the resulting branch / path.
- Naming the workspace after the feature description instead of the spec slug. Spec slug is stable; feature descriptions drift.
- Re-creating an existing workspace after a halted run. Resume, do not recreate — commits from the halted run are the recovery point.

## Output of this skill

- A working directory where the rest of the vibe pipeline will operate.
- A structured record (see §Report) passed to the caller.
- A one-line user-facing announcement:

```
isolated: worktree .vibe-worktrees/<run-id> on branch vibe/<slug> from <base>@<sha>
```

or, in branch mode:

```
isolated: branch vibe/<slug> from <base>@<sha>
```

Nothing else.
