---
name: finish-branch
description: Use after review-pack has returned `yes` and the user has explicitly signed off on the diff. Presents the user with concrete integration options (merge, PR, keep branch, cleanup) and executes only the one the user picks. Never auto-merges, auto-pushes, or auto-PRs. This is the outward-facing endpoint of the vibe pipeline.
---

# finish-branch

## Overview

Take a verified, reviewed, user-approved vibe branch and integrate it into the user's main flow. This is the only skill in the pipeline that performs outward-facing actions — merges, pushes, PR creation. Every one of those actions requires explicit user selection, in this skill, right now. A previous `yes` from `review-pack` authorizes this skill to *run*; it does not authorize any specific outward action.

## When to invoke

- After `review-pack` returned `yes`.
- Never before `verify-gate` verdict `ready`.
- Never before `review-pack` sign-off.
- Not at all for runs the user decided to abort or keep idle.

Do not invoke:
- If the pipeline halted earlier.
- If the user's intent was "work in progress, don't integrate yet".

## Prerequisites

- Verify-gate report present, verdict `ready`.
- Review-pack document present, user signed off `yes`.
- The vibe branch exists and has unmerged commits.
- The repo is at the reviewed HEAD; no new commits have landed on the branch since review.

If any prerequisite fails, stop and surface it. In particular, if new commits have landed since review-pack, re-run review-pack on the current HEAD — do not integrate unreviewed work.

## Option menu (present exactly these four, let the user pick)

```
finish-branch: review approved. How do you want to integrate?

  (1) Merge into <base> locally.
      git switch <base> && git merge --no-ff vibe/<slug>
      Does not push. Does not delete the branch.

  (2) Open a pull request.
      Pushes vibe/<slug> to origin and opens a PR against <base> via `gh pr create`.
      Title: <suggested>
      Body:  <suggested, see §PR body template>
      Does not merge. Does not delete.

  (3) Keep the branch, do nothing.
      No push, no merge. Useful if you want to review offline or share manually.

  (4) Abandon the branch.
      Deletes the branch and (if using worktree mode) removes the worktree.
      Destructive. Double-confirms before running.

Pick a number.
```

Only the option the user picks runs. If they want multiple (e.g. merge locally AND push), they run finish-branch again for the second action.

## Option 1 — merge locally

Commands (announce first, execute after):

```
git switch <base>
git merge --no-ff vibe/<slug> -m "merge: <feature> — <spec slug>"
```

Do not delete the vibe branch. Leave branch and worktree intact so the user can iterate or roll back. A later finish-branch invocation can clean up.

On conflict: stop immediately, announce the conflict, leave the merge in the conflicted state. Do not attempt auto-resolution. The user decides whether to resolve manually or `git merge --abort`.

## Option 2 — open a PR

Prerequisites on top of the general ones:
- `gh` is installed and authenticated, or the user's configured PR-creation command is available.
- Remote `origin` exists.

Commands:

```
git push -u origin vibe/<slug>
gh pr create --base <base> --head vibe/<slug> \
  --title "<suggested title>" \
  --body "<body from template>"
```

### Suggested title

Derive from the spec's title: e.g. spec `toKebabCase` → PR title `feat: add toKebabCase utility`.

Do not default to the vibe run id. Use the spec's semantic title.

### PR body template

```markdown
## Summary
<one-line, from the spec's Goals section>

## Changes
<bulleted list, one per plan task>

## Testing
<commands run + pass summary from the verify-gate report>

## Spec
`<path to spec>` (status: approved)

## Plan
`<path to plan>`

## Verification
`<path to verify-gate report>` — verdict: ready

## Review
`<path to review-pack document>` — user signed off
```

Include the artifact paths verbatim; reviewers follow them to reconstruct the run.

Push output and PR URL are captured verbatim in the finish-branch log. Do not summarize.

## Option 3 — keep the branch

No-op action. Announce:

```
finish-branch: kept vibe/<slug>. No push, no merge.
Branch and worktree remain.
```

Record the run as complete-but-not-integrated. The user can come back later and run finish-branch again with a different option.

## Option 4 — abandon

Destructive. Requires a double confirm:

```
Abandon vibe/<slug>? This deletes the branch and removes the worktree if any.
Commits will be reachable for ~90 days via reflog but are otherwise lost.
Type `abandon <slug>` exactly to confirm.
```

On correct confirmation:

```
git worktree remove .vibe-worktrees/<run-id>   # if worktree mode
git branch -D vibe/<slug>
```

On wrong confirmation string: cancel the action. Do not ask again. User re-invokes the skill if they really mean it.

## Safety rules (non-negotiable)

- Never force-push.
- Never delete a remote branch. Option 4 is local only.
- Never `git reset --hard` on main / master / the user's base branch.
- Never merge if the working tree has uncommitted changes.
- Never run any option other than the one the user picked.
- Never run a hook-skipping flag (`--no-verify`, `--no-gpg-sign`) unless the user explicitly asks in this invocation.

If any safety rule would be violated, stop and surface the condition. The user has to unblock, not the skill.

## Anti-patterns

- Combining options in one run ("merge AND push AND PR"). Each run does one thing.
- Assuming the user wants a PR because the repo has a remote. Ask.
- Writing the PR body from your own summarization of the work. Pull the artifact paths from the pipeline's own files; cite them verbatim.
- Auto-deleting the vibe branch after merge. Keep it until the user explicitly abandons.
- Suggesting new work or follow-ups in the finish-branch output. This skill integrates; it does not plan.

## Compression policy

- Option menu, titles, and prompts: verbatim as shown above.
- PR body: verbatim from the template with values filled in; no rephrasing.
- Command output: verbatim in the run log.

## Output of this skill

- Exactly one of the four option behaviors executed.
- A one-line result message to the user:

```
finish-branch: merged vibe/<slug> into <base> (local, no push).
```

or

```
finish-branch: PR opened — <url>.
```

or

```
finish-branch: kept vibe/<slug>.
```

or

```
finish-branch: abandoned vibe/<slug>.
```

Nothing else.
