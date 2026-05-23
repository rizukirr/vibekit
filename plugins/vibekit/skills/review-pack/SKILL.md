---
name: review-pack
description: Use after verify-gate returns `ready` and before finish-branch or any outward-facing action. Performs a self-review pass (Reflexion-style) — the skill critiques its own completed work against the spec and the plan, surfaces issues in order of severity, and presents the diff to the user for explicit sign-off. No outward-facing action runs until the user approves.
---

# review-pack

## Overview

A structured self-review and user sign-off. The skill:

1. Re-reads the spec and the plan.
2. Reads the full diff from the isolation base to HEAD on the vibe branch.
3. Critiques its own work against the spec (not against abstract best practice — against *this* spec).
4. Presents a severity-ranked list of findings + the full diff + a sign-off prompt.
5. Waits for user approval before handing off.

This is the last reasoning gate before the pipeline touches anything outside the isolated workspace.

## When to invoke

- After `verify-gate` returns verdict `ready`.
- Before `finish-branch`, before any merge, PR, push, tag, or deploy.
- When the user explicitly asks for a review of completed work.

Do not invoke:
- If `verify-gate` returned `not ready`. Review-pack is not a bypass.
- If no commits exist on the vibe branch beyond the base — there is nothing to review.

## Prerequisites

- Spec exists at the path recorded by the vibe run, `status: approved` in frontmatter.
- Plan exists at the path recorded by the vibe run.
- Verify-gate report exists with `verdict: ready`.
- Vibe branch has at least one commit beyond the isolation base.

If any prerequisite fails, stop and surface what is missing.

## Self-review procedure (Reflexion)

Run through these critique passes in order. Each pass produces findings with a severity tag.

### Pass 1 — spec coverage

For each requirement in the spec's Goals and Constraints sections:
- Is there a commit, test, or code hunk that implements it?
- Is the implementation consistent with the spec's stated Approach?
- Are the spec's Non-goals respected (no new code touching forbidden areas)?

Finding severity:
- `block` — a Goal is not satisfied, a Non-goal has been violated, a Constraint has been broken.
- `warn` — a Goal is satisfied weakly (e.g. one test where more were reasonable).
- `nit` — style, naming, or documentation detail.

### Pass 2 — plan fidelity

For each task in the plan:
- Are its "Files" matched by the diff?
- Is the commit message on its commit the one the plan specified?
- Are the tasks' order reflected in commit order?

Finding severity:
- `block` — a plan task's code is missing from the diff.
- `warn` — commit messages diverge from the plan's wording.
- `nit` — extraneous whitespace or non-functional edits introduced.

### Pass 3 — code quality (within the spec's scope)

- DRY: are there obvious duplications of logic within the changed files?
- YAGNI: are there new code paths or exports with no caller, no test, and no spec requirement?
- Test adequacy: does each new behavior have at least one assertion that would fail if the code were broken?
- Naming: do new public identifiers match the spec's wording?

Finding severity:
- `block` — a public API diverges from the spec (name, signature, semantics).
- `warn` — clear duplication or speculative feature; ambiguous tests.
- `nit` — local naming nits, minor comments.

### Pass 4 — simplicity (Karpathy principle 2)

Run the senior-engineer test on the diff:

- Total LOC added (count from `git diff --shortstat`).
- Identify the single largest new construct (function / class / module / file).
- Ask: "Could a senior engineer halve this without losing required behavior?"
- If yes, quote the bloat candidate **verbatim** (file:line range + the code) and name what could be cut.

Finding severity:
- `block` — a new abstraction has a single caller and could be inlined; speculative configurability with no spec requirement; new code paths/exports with no caller and no test.
- `warn` — code that is twice the natural length but functionally correct.
- `nit` — micro-bloat (extra wrapper, unused parameter).

A `block` here halts the handoff just like a spec violation.

### Pass 5 — surgical-diff (Karpathy principle 3)

For every changed file in the diff:
- Does it appear in at least one plan task's "Files" section?
- Does every changed *hunk* trace to a specific plan task or spec requirement?

Finding severity:
- `block` — a file was modified that no plan task names; or a hunk has no traceable origin.
- `warn` — pre-existing dead code was deleted without explicit user request; formatting or comment changes unrelated to the task.
- `nit` — touched lines that did not need to change to satisfy the task.

Quote the orphan file:line ranges verbatim.

### Pass 6 — self-critique (Reflexion)

Ask explicitly: "What are three ways this implementation could be wrong that the tests would not catch?" Write down the three answers. For each:
- Is there evidence in the diff that the risk is mitigated?
- If not, what would an additional test or assertion look like?

If any of the three risks has no mitigation evidence, raise a `warn` with a suggested follow-up.

## Output structure

Write a review document at `docs/reviews/YYYY-MM-DD-<feature>-review.md` containing:

```markdown
# Review — <feature>

**Date:** YYYY-MM-DD
**Spec:** <path>
**Plan:** <path>
**Verify report:** <path>
**Commits under review:** <base sha>..<head sha> on <branch>

## Diff summary

- Files changed: <count>
- Lines added: <n>, removed: <n>
- Commits: <count>

## Findings

### Block
- <one per finding, with evidence: file:line or commit sha>

### Warn
- <...>

### Nit
- <...>

## Self-critique (three risks)

1. <risk> — mitigation: <...> OR follow-up test: <...>
2. ...
3. ...

## Diff

(Full `git diff <base>..HEAD` inline, or a reference to the command the user can run.)

## Sign-off

- [ ] User reviewed findings.
- [ ] User reviewed diff.
- [ ] User approves proceeding to finish-branch.
```

## Compression policy

- Findings: terse bullets; location + the specific defect; no pleasantries.
- Diff: verbatim. Never paraphrase or trim.
- Spec quotes: verbatim.
- Self-critique rationale: one line per risk.

## Sign-off gate

After writing the review document, present to the user:

```
Review: <path>.
Blocks: <n>. Warns: <n>. Nits: <n>.
Diff: <lines added>/<lines removed> across <N commits>.

Approve proceeding to finish-branch? (yes / fix / abort)
```

Wait for the user's response.

- `yes` → hand off to `finish-branch`.
- `fix` → user gives the specific fixes they want; the orchestrator plans a small targeted update (not a full re-plan).
- `abort` → stop. User decides whether to roll back the vibe branch or keep it for later.

Never auto-proceed. The user's explicit sign-off is non-optional.

## Hard rule: blocks halt the handoff

If the review finds any `block`-severity issue, the handoff to `finish-branch` is not available — only `fix` or `abort`. The user cannot approve a `yes` that overrides an unresolved block. Surface this clearly:

```
Review has <N> block finding(s). `yes` is not available. Choose `fix` or `abort`.
```

This preserves the invariant that `finish-branch` only runs on work that passed both verify-gate and a clean review.

## Anti-patterns

- Treating `warn` as `block` to inflate caution. If it is blocking, it is `block`; otherwise let the user decide.
- Running review-pack as a silent automation. It requires explicit user sign-off.
- Presenting findings without file:line evidence. Every finding cites a location.
- Proposing refactors outside the spec's scope. Review-pack critiques *this work against this spec*, not the whole codebase.
- Accepting `yes` after any `block` finding.

## Output of this skill

- A committed review document at `docs/reviews/YYYY-MM-DD-<feature>-review.md`.
- An explicit user response: `yes` (→ finish-branch), `fix` (→ targeted update), or `abort`.

Terminal states: `yes` unblocks finish-branch. `fix` returns to exec-dispatch for the specific items the user chose. `abort` stops the pipeline with the branch retained.
