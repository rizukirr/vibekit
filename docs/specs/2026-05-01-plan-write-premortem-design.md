---
title: plan-write premortem step
date: 2026-05-01
status: draft
---

# plan-write premortem step — Design

## Problem

`plan-write` today produces a TDD-structured implementation plan and then runs an 8-step self-review checklist for tactical defects (placeholders, type consistency, command runnability, predicted-output accuracy). What it does not do is force the author into adversarial reasoning against their own plan — looking for hidden assumptions, irreversible steps, spec-misinterpretations, and verify clauses that would pass on broken code.

The cost of a flawed plan is paid by `exec-dispatch`: workers implement against a plan whose strategic flaws weren't caught, work gets thrown away at `review-pack`, and the orchestrator pays for re-dispatches. The cost of a 4-category sweep at plan-write time is small (the author is already holding the plan in context); the cost of skipping it surfaces several phases later, much more expensively.

This design adds a **premortem step** to `plan-write` — inspired by pi-interactive-subagents' planner agent, which runs a similar pass before finalizing — to catch a class of plan-level bugs cheaply, before exec-dispatch wastes work implementing a flawed plan.

## Goals

- Force adversarial reasoning against the freshly-drafted plan via a fixed four-category sweep.
- Produce a persistent `## Premortem` section in the plan doc that downstream skills can consume as additional context.
- Surface fundamentally-broken plans to the user at the existing review gate via a `BLOCKING RISK:` label, without introducing a new halt gate.
- Stay prose-only — no schema change, no contract change, no new skill, no new tool.

## Non-goals

- Not turning `plan-write` into a heavy spec session. The four categories are bounded and fixed; the sweep does not invite open-ended risk discovery beyond them.
- Not formally gating `exec-dispatch`, `verify-gate`, or `review-pack` on the premortem. Downstream gating is deferred to a future brainstorm; this change establishes the artifact only.
- Not retroactively annotating existing plans in `docs/plans/`.
- Not adding a per-task premortem inside each task block. The premortem is plan-level, surfacing risks across the whole plan.

## Constraints

- The change is confined to `skills/plan-write/SKILL.md`. No edits to other skills, no new files, no manifest changes beyond a version bump.
- The `## Premortem` section sits in the plan doc itself, between the plan-document header and `## File structure`.
- The premortem step fires *after* the existing self-review and *before* the user-review gate.
- Backwards-compatible: plans written before this change lack a `## Premortem` section but remain valid; `exec-dispatch` does not require one.
- Cross-runtime portable: a single `SKILL.md` edit reaches all five runtime adapters (Claude Code, Codex, Gemini, opencode, pi) via existing delivery paths.
- Compression policy unchanged: the plan doc and the new section are not compressed; author narration around the step is compressible per the existing skill convention.

## Approach

### Placement in the skill flow

```
1. Load spec, scope check
2. Define file structure
3. Write tasks
4. Self-review (existing 8-step checklist) → fix inline
5. Premortem (new) → fix inline; flag BLOCKING RISKs
6. User review gate (existing message, unchanged)
7. Execution handoff (existing two-option prompt, unchanged)
```

The premortem is a distinct phase, not a checklist item folded into self-review. Self-review is a tactical-bug check (placeholders, type consistency); the premortem is adversarial reasoning. Different cognitive mode, different output shape (categorical bullets persisted in the plan vs. inline fixes that disappear), different durability. Folding them risks the premortem becoming ritual.

### Output format in the plan doc

Bulleted per-category. The `## Premortem` section is appended to the plan doc immediately after the plan-document header and before `## File structure`. Format:

```markdown
## Premortem

**Hidden assumptions:**
- <risk> — <mitigation>
- <or> none — <specific reason>

**Irreversible / risky steps:**
- <risk> — <mitigation>
- <or> none — <specific reason>

**Spec-misalignment:**
- <risk> — <mitigation>
- <or> none — <specific reason>

**Verify-clause weakness:**
- <risk> — <mitigation>
- <or> none — <specific reason>
```

Bulleted per-category was chosen over prose paragraphs (too verbose for plans with little risk) and tables (degrade when a category has 2+ risks). Bullets scale naturally to multiple risks per category and pair cleanly with the `none — <reason>` convention from `brainstorm-lean`'s design-doc template.

### The four categories

Each category is defined by what it asks the author to look for and what counts as a valid `none — <reason>`.

**1. Hidden assumptions** — *Does this plan trust something it shouldn't?*
The plan assumes some file, function, API, library behavior, environment variable, runtime invariant, or data shape exists or behaves a certain way. List each load-bearing assumption the plan does not verify itself. For each, state how the plan handles the assumption being wrong.
`none — <reason>` valid when: the plan only touches code created within the plan, OR every external dependency has been read by the author and the relevant assumption verified inline.

**2. Irreversible / risky steps** — *What's expensive to undo?*
Migrations, deletions, schema changes, mass renames, edits to files outside the feature area, package-manifest changes, lockfile updates, anything production-affecting, anything touching shared state across tasks. For each, state the rollback path and whether the plan exercises it before the destructive step.
`none — <reason>` valid when: every task can be reverted by `git revert <commit>` without follow-up work.

**3. Spec-misalignment** — *Where could the user say "that's not what I asked for"?*
For each spec requirement with more than one reasonable interpretation, state which the plan picked and surface it. Verify clauses that lock in the interpretation count as mitigation. Cases where the plan's interpretation diverges from the most-literal reading of the spec are BLOCKING RISK candidates.
`none — <reason>` valid when: every spec requirement has exactly one reasonable interpretation AND every task's verify clause matches that interpretation observably.

**4. Verify-clause weakness** — *Where does success and failure look the same?*
For each task, ask: could broken code pass this verify clause? Could correct code fail it? Examples of weak clauses: "test file passes" (passes on empty file), "no errors in console" (passes if the feature didn't load), "endpoint returns 200" (passes on a stub). For each weak clause, tighten it inline before the user-review gate.
`none — <reason>` valid when: every verify clause names a specific assertion, exit code, file content, or HTTP response that distinguishes correct from broken.

### BLOCKING RISK protocol

If any category surfaces a risk the author cannot mitigate inline by editing the plan (typically a category-3 spec-misalignment that goes deep, or a category-2 irreversibility with no rollback), the bullet is prefixed `**BLOCKING RISK:**` and the mitigation field reads `requires user decision — recommend revising spec or accepting risk`.

The premortem itself never halts the skill. It produces the section and proceeds to the user-review gate. The user reads the labeled bullet there and decides whether to approve, revise the spec, or bounce back to brainstorm.

### Anti-patterns called out in the new section

- Writing `none — N/A` or `none — no risks` for every category. If the categorical sweep produces four `none` lines, the author did not actually do the sweep. `none` reasons must be specific.
- Stating a risk without a mitigation. Every fixable bullet has the form `<risk> — <mitigation>`. Risks without mitigations are either BLOCKING RISKs (label them) or unfinished work.
- Treating the premortem as documentation of risks already addressed during drafting. The premortem is adversarial *new* analysis.
- Removing or watering down a `BLOCKING RISK:` label to make the plan look approvable. The label is for the user, not for the author's comfort.

### Edits to `SKILL.md`

1. New `## Premortem` section sibling to `## Self-review (after writing the plan)`, placed immediately after it, containing: the four-category definitions above, the bulleted output format, the BLOCKING RISK protocol, and the anti-patterns block.
2. Plan-document-header template gains a `## Premortem` section reference between the header block and `## File structure`, with the four category headings as fill-in placeholders.
3. One closing line at the end of `## Self-review (after writing the plan)` directing to the new step: "After self-review fixes are applied, run the premortem."

No other changes to `SKILL.md`.

## Alternatives considered

**Single checklist item inside `## Self-review`.** Add "step 9: premortem (four-category sweep)" to the existing 8-step list. ~10 lines of skill prose vs. ~40 for a distinct section. Rejected because it dilutes the premortem's distinct cognitive mode (adversarial vs. tactical) into a checkbox, and predictably degrades to ritual. The marginal token cost of a distinct section is trivial; the marginal behavioral cost of folding it in is substantial.

**Separate artifact at `docs/plans/.../<feature>-premortem.md`.** Decoupled from the plan; only loaded when explicitly referenced. Rejected because vibekit's "one plan, one execution" cadence doesn't have a use case for the premortem-without-plan; the decoupling adds discipline cost (another file to maintain) without adding value. The persisted-in-plan form (chosen) gives downstream skills the analysis automatically as part of normal plan-loading.

**Internal-only pass with no persisted artifact.** Premortem runs, drives plan edits, then the analysis is discarded. Rejected because the premortem's value extends beyond planning — `verify-gate` and `review-pack` benefit from knowing what the plan author flagged as risky, even though they don't formally gate on it. Discarding the analysis (option A in question 1 of the brainstorm) loses that.

**Premortem before self-review instead of after.** Strategic before tactical. Rejected because in practice the author can produce a higher-signal premortem against a plan that is already internally consistent (placeholders fixed, verify clauses present); running it first means re-running it after self-review fixes anyway, or accepting that some premortem bullets reference parts of the plan that get rewritten in self-review.

**Free-form prose risk discussion (no fixed categories).** Rejected because vibekit's existing patterns are categorical (design-doc template's fixed sections, self-review's numbered checklist). Free-form drift is the failure mode; fixed categories with `none — <reason>` allowed is the fit.

## Testing

1. **Static check on the canonical SKILL.md.** After editing `skills/plan-write/SKILL.md`, re-read the file and confirm: the `## Premortem` section exists, sits between `## Self-review` and `## Execution handoff`, defines the four categories per the Approach above, includes the BLOCKING RISK label rule, and includes the anti-patterns block. The plan-document-header template is updated to show the `## Premortem` placeholder section.

2. **Live eval — control vs. treatment.** Per `AGENTS.md`'s eval workflow, run one eval pair against `tests/eval/<run-id>/`:
   - Control: dispatch a `plan-write` invocation against a deliberately-flawed spec (one with a known spec-misalignment ambiguity, one task whose verify clause is weak by construction). Record the produced plan.
   - Treatment: same spec, post-change `plan-write`. Record the produced plan.
   - Pass criterion: the treatment plan contains a `## Premortem` section, and at least one of the seeded flaws appears as a non-`none` bullet with a concrete mitigation. The control plan does not.

3. **Self-consistency check on a real recent plan.** Pick one plan from `docs/plans/`, manually run the four-category sweep against it as if `plan-write` had emitted the section, and confirm: at least one category produces a substantive bullet (not all four `none`); each `none — <reason>` line is specific, not generic. Sanity-checks the categories against vibekit's actual planning patterns.

## Open questions

- Whether `exec-dispatch`, `verify-gate`, and `review-pack` should formally gate on the premortem section in a future change. Deferred — this change establishes the artifact; downstream gating is its own brainstorm.
- Whether plans in `docs/plans/` written before this change should be retroactively annotated with premortems. Deferred — not necessary, no value relative to cost.
