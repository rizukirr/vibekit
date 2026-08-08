---
title: verify integration and the end of the pipeline
date: 2026-08-08
status: approved
---

# verify integration and the end of the pipeline — Design

## Problem

`verify` ends by handing to `finish`, and `finish` does not exist. Its HARD-GATE
names `finish` as the outward-facing skill nobody may invoke early, and its
`## Handoff` names `finish` as the next skill on approval. Both point at nothing.

That is the last dead end in the frame. Every other link resolves:
`brainstorm → plan → exec → verify` all hand to a skill that ships.

The integration work itself has happened every cycle, by hand and outside any
skill. The user says "open a PR", the session pushes and runs `gh pr create`, the
user merges on GitHub. Three standing safety constraints govern that work —
never force-push, never delete a remote branch, no `--no-verify` — and all three
live only in conversation and in operator memory. None is a shipped artefact.

The pushback held: a separate `finish` skill would be roughly forty lines, most
of them frontmatter, gate, preconditions and handoff wrapped around three git
commands, and it would add a trigger that must fire reliably — the failure this
project has measured more than any other. The user took the smallest version.

## Goals

- **The pipeline has no dead ends.** Observable: `grep -rn '\bfinish\b' skills/`
  returns zero matches. Run today it returns exactly two, both in
  `skills/verify/SKILL.md`, at lines 19 and 190. The word boundary matters: the
  two occurrences of "unfinished" in `skills/lazy/SKILL.md` and
  `skills/verify/SKILL.md` do not match it, which is what makes zero the correct
  target rather than a judgement call about which matches count.

- **Integration is reachable only after approval.** Observable:
  `skills/verify/SKILL.md` places the integration section after `## The ending`,
  states it is reachable only after the user approves, and states that only the
  one option the user picks runs.

- **Three options, no more.** Observable: the section defines exactly merge
  locally, push and open a PR, and keep as is. No local-delete option, no
  abandon option, no combined option.

- **A stale verdict cannot ship.** Observable: the section requires, before any
  option runs, that the working tree is clean and that `HEAD` is what the sweep
  ran against, and states that a moved `HEAD` sends the run back to the top.

- **The safety rules are shipped, not remembered.** Observable: the section
  states never force-push, never delete a branch local or remote, never merge
  with a dirty tree, never pass `--no-verify`.

- **The HARD-GATE names actions, not a skill that does not exist.** Observable:
  line 19's `finish` reference is replaced by the outward actions themselves —
  push, merge, open a pull request.

- **The base branch is a named input.** Observable: the `## 1. Preconditions`
  table carries a `base branch` row, and the merge option in the integration
  section switches to that input rather than to an unexplained placeholder.

- **Integrating is distinguished from repairing.** Observable: `## Repair
  nothing yourself` states that a merge the user asked for is not a repair, and
  says why — it adds no line the skill wrote, and it follows the verdict rather
  than producing one.

- **The swept commit is written down, not remembered.** Observable: `## 2.
  Repo-level sweep` records `git rev-parse HEAD` before running any check; the
  verdict template carries a `Swept:` line; and the integration step compares
  `git rev-parse HEAD` against that written line rather than against recall.

- **The skill stays under its budget.** Observable: `wc -l
  skills/verify/SKILL.md` is at most 225. Read as a content budget: reflowing to
  pass it is a violation, not a fix.

  **This ceiling was derived, not chosen.** The four edits were drafted onto a
  scratch copy before this spec was written, and that copy measured 211 lines —
  observed, not estimated. 215 is that number plus margin for wording. The
  previous three cycles each set a ceiling before the content existed and each
  was wrong; one of them said in the spec that its number was "chosen rather than
  predicted" and was wrong anyway. A ceiling chosen before the content exists is
  a prediction wearing a different word, so this one waited for the content.

  An earlier draft of this goal stated the budget as a property instead — *no
  larger than `exec`*. It was unsatisfiable: `exec` is 134 lines and `verify` was
  already 191. Stating a budget as a property does not exempt it from being
  checked against the repo.

  **Amended after the first verdict, 2026-08-08.** The ceiling was 215 and the
  shipped file measured 211. The three goals added above came from `verify`'s own
  risk critique, which the user chose to act on, and they do not fit. The new
  ceiling of 225 was derived the same way as the old one: the three edits were
  drafted onto a scratch copy first, that copy measured 221, and 225 is that
  number plus margin. Raising a budget to hold approved content is legitimate;
  cutting the content to hold the number would not be.

## Non-goals

- **A `finish` skill.** Dropped from the frame. `verify` is terminal, and the
  pipeline is `brainstorm → plan → exec → verify`.

- **An abandon option.** Deleting a branch is `git branch -D`, which the user can
  run without a skill wrapping a double-confirm around it. The v1 skill had one;
  it is not carried over.

- **A cleanup path.** `verify` stops at the PR URL or the local merge. Switching
  back to the base branch, pulling, and deleting the merged local branch stay
  manual, as they have been every cycle. A second re-invocable code path that
  detects post-merge repo state was considered and rejected as unearned.

- **Verify writing a receipt.** The precondition is the conversation plus a
  re-check, not an on-disk artefact. `verify` still writes nothing and commits
  nothing up to the moment the user picks an option. Reversing last cycle's
  decision to gain a verdict file was offered and declined.

- **Conflict resolution.** A local merge that conflicts stops, conflicted. The
  skill that refuses to repair its own findings does not repair a merge.

- **Owning branch creation.** `exec` requires a dedicated branch and explicitly
  does not create one, and no v2 skill does. That gap is real and is not closed
  here; it belongs upstream of `exec`, not at the end of the pipeline.

- **Any new eval scenario.** Argued under Testing. Every line this change adds is
  shell-driven, and eval sessions run without `Bash`.

## Constraints

- **Dependency free.** No shipped file under `skills/` names a project vibekit
  borrows from; `tests/no-external-references.test.mjs` enforces it.
- **One directory, one file.** `skills/verify/SKILL.md` is the only file that
  changes. `CLAUDE.md`, `README.md` and `AGENTS.md` are regenerated by
  `npm run generate` and committed together, never hand-edited.
- **No `Co-Authored-By` trailers. Branch names carry no prefix. Artefacts stay
  committed under `docs/`.**
- **Measurement integrity.** `git ls-files -s skills evals | sha256sum` pinned
  before and after every paid run.
- **Rates are quoted at n=10 or not at all.**
- **Suspect the probe before the skill.** Every cycle so far has produced more
  defects in the plan and the measuring apparatus than in any implementation.

## Approach

One file changes: `skills/verify/SKILL.md`, from 191 lines to a measured 211.
Three edits.

### Edit 1 — the HARD-GATE names actions

Line 19 currently reads *"do not invoke `finish` or any outward-facing skill"*.
With no `finish`, the gate must name what it forbids:

> Do NOT claim work is done, fixed, complete or passing, and do not push, merge
> or open a pull request, until this returns `ready` and the user has signed off.

This is strictly better than the original even if `finish` existed. A gate naming
a skill is bypassed by doing the action without the skill; a gate naming the
action is not.

### Edit 2 — `## 6. Integration`

A new numbered section after `## The ending`, before `## Repair nothing
yourself`. Reachable only after approval. Only the option the user picks runs;
never two in one run, because a second one is a second decision.

- **Merge locally** — `git switch <base>`, then `git merge --no-ff <branch>`. No
  push, and the branch stays. On conflict, stop and leave it conflicted.
- **Push and open a PR** — `git push -u origin <branch>`, then `gh pr create`.
  Title from the spec's title, never the branch name. The body names the spec,
  the plan, what the sweep ran, and the open warns and nits. Print the URL.
- **Keep as is** — nothing runs.

Two checks precede any of them: the tree is clean, and `HEAD` is what the sweep
ran against. The second is the one that matters. `verify` reports, the user
reads, decides, and answers — and a commit landing in that window would ship
against a verdict that never saw it. The check is weaker than v1's, which
compared HEAD against a written review document; here there is no document, so
the comparison is against what the sweep ran. It still catches the case.

Then the four safety rules: never force-push, never delete a branch local or
remote, never merge with a dirty tree, never pass `--no-verify`. These exist
today only in conversation and in operator memory. This is the edit that makes
them shipped.

### Edit 3 — handoff

`## Handoff` stops naming `finish`:

> None. Integration ends the pipeline. Nothing else runs until every blocker is
> closed and `verify` runs again from the top.

### Edits 4, 5 and 6 — added after the first verdict

The first `verify` run returned `ready` and named three ways the change could be
wrong that the tests would not catch. The user chose to fix all three. They are
carried here, and through the plan, rather than patched into the skill directly —
the first time this project has routed a post-verdict fix instead of overriding.

**Edit 4 — the base branch becomes an input.** The integration step tells the
skill to switch to the base branch and never says how to find it. In this repo
the base is `v2`, not the repo's default, and the first sweep of this very run
derived it wrongly and swept 170 files. A `base branch` row joins the
`## 1. Preconditions` table, above the `BASE` row that already depends on it.

**Edit 5 — integrating is not repairing.** `## 6. Integration` can create a merge
commit; `## Repair nothing yourself`, two sections below, says the skill never
edits what it gates. Both are correct and the reconciliation was unstated, so a
literal reader meets an apparent contradiction. Two sentences state it: the merge
adds no line the skill wrote, and it follows the verdict rather than producing
one.

**Edit 6 — the swept commit is written down.** The staleness check compares
`HEAD` against "what the sweep ran against", which nothing recorded. It therefore
asked the agent to remember a commit across the user's decision — and this run
demonstrated the failure directly, sending a fabricated SHA into a dispatch brief
after observing only its short form. The sweep now records `git rev-parse HEAD`
before any check, the verdict template carries a `Swept:` line, and the
integration step compares against that written value. A check against memory is
not a check.

### Pushback and response

The pushback challenged whether `finish` needed to exist: `verify`'s ending
already presents the diff and waits for approve / fix / abort, so "which
integration?" is one more option on a menu that exists, and the three actions
behind it are one or two git commands each. The user answered "use the smallest".

The cost is real and is not hidden. `verify` says *"Report in the conversation.
Write nothing, commit nothing."* This gives it a push button, and the two-key
property — one skill gates, a different skill acts — is gone. What survives is
the property that actually protects the verdict: `verify` still does not author
or repair the change it grades, and the integration step runs only on a decision
the user makes after seeing the evidence. It does not verify its own push.

## Alternatives considered

**A forty-line `finish` skill.** Keeps `verify` mechanical and inside its
budget, keeps the outward action behind its own trigger and its own hard gate.
Rejected by the user in favour of the smaller version, and on the same grounds
that removed `review` last cycle: the wrapper outweighs the content, and a new
trigger is the least reliable part of this system.

**Nothing at all.** Genuinely the laziest rung: the user already says "open a
PR" and it happens. Rejected because the three safety constraints would remain
unshipped, and because `verify` would keep pointing at a skill that does not
exist — the defect this cycle exists to close.

**Four options, including abandon.** Matches v1. Rejected: the destructive path
earns a double-confirm, a worktree-removal branch, and a safety argument, for an
action that is one git command the user can run directly.

**A second, re-invocable cleanup path.** `verify` run again after the merge
lands would detect the merged PR, switch to base, pull, and delete the local
branch. Rejected as a second code path in a skill that just absorbed a first one.

## Testing

**Free CI.** `npm run generate` and `npm run check` cover registration;
`tests/no-external-references.test.mjs` covers the prose. Nothing new is needed,
and the goals above are all greppable against the shipped file.

**Paid: none, deliberately.** Every line this change adds is shell-driven —
push, merge, `gh pr create`, the clean-tree check, the HEAD-staleness check — and
eval sessions run with `--disallowedTools Bash`. A scenario asserting that a
session "offered three integration options" when it could not have executed any
of them measures the prose against itself. That is the vacuous-check failure this
project has already shipped three times, and adding a fourth to claim coverage is
worse than recording the gap.

**Stated weakness.** This change adds unmeasurable surface to a skill that was
already two-thirds unmeasurable, on the strength of a defect found by reading.
The per-scenario `allowBash` capability that would close it remains unbuilt with
no spec, and this cycle does not make it cheaper.

**Unchanged debt.** Eight scenarios have never run — five `verify`, three
`plan`. This change does not touch them, does not add to them, and does not
reduce what they cost.

## Open questions

None. Deferred items are listed under Non-goals.
