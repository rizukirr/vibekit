---
name: plan-write
description: Use when a spec has been approved by the user and implementation has not started. Converts the spec into a bite-sized, TDD-structured implementation plan with exact file paths, full code snippets, and explicit commit boundaries. The plan is written as normal prose (not compressed) because downstream execution agents parse it verbatim.
---

# plan-write

## Overview

Write a comprehensive implementation plan assuming the executing engineer has zero context for the codebase and questionable taste. Document everything they need to know: which files to touch for each task, the actual code, tests, docs to check, exact commands. Break the work into bite-sized tasks of 2–5 minutes each. DRY. YAGNI. TDD. Frequent commits.

Assume a skilled developer who knows almost nothing about the toolset, the problem domain, or good test design.

**Announce at start:** "Writing the implementation plan."

## When to invoke

Only after a spec has been written, self-reviewed, and explicitly approved by the user (the output of brainstorm-lean). Never before.

## Prerequisites

- A spec file exists at `docs/specs/YYYY-MM-DD-<topic>-design.md` or a user-specified path.
- The user has approved that spec in writing.
- No implementation has started yet.

If any prerequisite is missing, stop and redirect: either run brainstorm-lean first or ask the user to confirm the spec path.

## Save plans to

`docs/plans/YYYY-MM-DD-<feature-name>.md`

User preferences for plan location override this default.

## Compression policy

The plan doc is **not compressed**. Downstream execution agents read this file verbatim and make edits based on what it says. Every path, every code block, every command must be exact. Compressing prose to save tokens here causes silent bugs later.

The *announcement* to the user ("Writing the implementation plan.") is compressed; the plan itself is normal prose.

## Scope check (first action after loading spec)

If the spec covers multiple independent subsystems, it should have been broken into sub-project specs during brainstorming. If it was not, stop and suggest breaking this into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

Do not write a mega-plan that spans unrelated subsystems.

## File structure (before defining tasks)

Before listing tasks, map out every file that will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file has one clear responsibility.
- Files that change together live together. Split by responsibility, not by technical layer.
- In an existing codebase, follow established patterns. Do not unilaterally restructure. If a file you are modifying has grown unwieldy, including a focused split in the plan is reasonable.

Present the file structure as a short list before the first task. Example:

```
## File structure

New:
- src/components/ThemeToggle/ThemeToggle.tsx — the toggle component
- src/components/ThemeToggle/ThemeToggle.test.tsx — component tests
- src/components/ThemeToggle/index.ts — public export

Modified:
- src/App.tsx:12-40 — mount the toggle in the header
- src/theme/tokens.ts:12-48 — add `colorScheme` token
```

## Bite-sized task granularity

Each step is one action taking 2–5 minutes. Examples of steps:

- "Write the failing test"
- "Run it to confirm it fails"
- "Write the minimal implementation"
- "Run the tests and confirm they pass"
- "Commit"

A task is a small group of steps that together produce a working, committable change.

## Plan document header

Every plan starts with this header, exactly:

```markdown
# [Feature Name] Implementation Plan

> **For executing agents:** implement this plan task-by-task. Each step uses checkbox (`- [ ]`) syntax. Do not skip steps. Do not batch commits across tasks.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2–3 sentences about approach]

**Tech stack:** [key technologies and libraries]

---
```

After the header, every plan doc includes a `## Premortem` section in this exact shape (filled in during the premortem step, not at header-writing time):

```markdown
## Premortem

**Hidden assumptions:**
- [risk] — [mitigation], or `none — <specific reason>`

**Irreversible / risky steps:**
- [risk] — [mitigation], or `none — <specific reason>`

**Spec-misalignment:**
- [risk] — [mitigation], or `none — <specific reason>`

**Verify-clause weakness:**
- [risk] — [mitigation], or `none — <specific reason>`
```

## Task structure

Every task follows this shape exactly. The `→ verify:` clause on the task header is **mandatory** — it names the checkable success criterion for the whole task. `exec-dispatch` will reject any task missing it.

````markdown
### Task N: [Component Name] → verify: [observable success criterion]

**Files:**
- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts:123-145`
- Test: `tests/exact/path/to/file.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('specific behavior', () => {
  const result = fn(input);
  expect(result).toBe(expected);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- path/to/file.test.ts -t "specific behavior"`
Expected: FAIL with "fn is not defined"

- [ ] **Step 3: Write minimal implementation**

```ts
export function fn(input: Input): Output {
  return expected;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- path/to/file.test.ts -t "specific behavior"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/path/to/file.test.ts src/path/to/file.ts
git commit -m "feat: add specific behavior"
```
````

## Optional parallel-group markers

Sequential is the default. When and only when a contiguous block of tasks is genuinely independent — disjoint "Files" sections, no ordering dependencies, no shared package-manifest edits — the plan author MAY wrap them in a parallel-group:

```markdown
<!-- parallel-group: <kebab-case-name>
     rationale: <one-line justification — why these tasks are independent> -->
### Task K: ... → verify: ...
**Files:** ...
- [ ] Step 1: ...
...

### Task K+1: ... → verify: ...
**Files:** ...
- [ ] Step 1: ...
...
<!-- /parallel-group -->
```

Constraints on every parallel-group:

- **Files-disjoint.** No file appears in two wrapped tasks' "Files" sections. `exec-dispatch` re-checks this and rejects the group otherwise.
- **No ordering dependencies.** No wrapped task's CONTEXT references another wrapped task's output.
- **No shared installs.** No wrapped task touches package manifests, lockfiles, or shared global config.
- **All wrapped tasks have `→ verify:` clauses** (already globally mandatory).
- **No setup/teardown inside a group.** Setup runs as a sequential task before the opening marker; teardown after the closing marker.

The opening marker's `rationale:` line is non-optional — the plan author justifies independence in writing so reviewers (and future you) can see why these specific tasks were considered safe to fan out. Empty or vague rationales ("they look independent") are caught in self-review.

Default is sequential. Reach for parallel-group only when the wall-clock saving justifies the analysis cost; for plans of <5 tasks, almost always skip it.

## Mandatory `→ verify:` clause

Every task header ends with `→ verify: <observable success criterion>`. The criterion must be checkable without judgment — a passing test name, a command exit code, a file existing, an HTTP status. "It works" is not a verify clause.

Examples:
- `### Task 3: ThemeToggle component → verify: ThemeToggle.test.tsx passes; clicking toggle flips data-theme on <html>`
- `### Task 5: /healthz endpoint → verify: curl localhost:8080/healthz returns 200 with body {"ok":true}`

If a task cannot be expressed with a verify clause, it is not bite-sized — split it.

## No placeholders

Every step must contain the actual content an engineer needs. These are plan failures — never write them:

- "TBD", "TODO", "implement later", "fill in details".
- "Add appropriate error handling", "add validation", "handle edge cases" — spell out what, where, and how.
- "Write tests for the above" without actual test code.
- "Similar to Task N" — repeat the code; agents may read tasks out of order.
- Steps that describe what to do without showing how (code blocks are required for code steps).
- References to types, functions, or methods not defined in any task.

## Remember

- Exact file paths, every time.
- Complete code in every step that changes code. Show the code, not a description.
- Exact commands with expected output.
- DRY, YAGNI, TDD, frequent commits.
- One logical change per commit.

## Self-review (after writing the plan)

Look at the spec with fresh eyes and check the plan against it. This is a checklist — not a subagent dispatch.

1. **Spec coverage.** Skim each section/requirement in the spec. Can you point to a task that implements it? List any gaps.
2. **Placeholder scan.** Search the plan for any of the red flags in the "No placeholders" section. Fix them.
3. **Type consistency.** Do the types, method signatures, and property names used in later tasks match what was defined in earlier tasks? A function called `clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug.
4. **File-structure alignment.** Does every file touched by a task appear in the "File structure" section at the top? Does every file in the structure get touched by at least one task?
5. **Commit boundaries.** Does each task end with a commit? Are commit messages specific and action-oriented?
6. **Command runnability.** Every shell command that appears in the plan (test runs, build commands, linters, `git` invocations) must actually work in the target repo's toolchain as written. If the command's expected output is a behavior of the runtime (not just the code under test), dry-run the command once before finalizing the plan.
7. **Verify clause present.** Every `### Task N` header ends with `→ verify: <criterion>`. Missing or vague clause = fix it now; `exec-dispatch` will refuse to dispatch otherwise.
7a. **Parallel-group integrity.** For every `<!-- parallel-group: ... -->` block: rationale present and concrete; wrapped tasks' "Files" sections fully disjoint (do the union, look for collisions); no wrapped task references another's output in CONTEXT; no wrapped task touches package manifests. If any check fails, either fix the plan or unwrap the group. `exec-dispatch` will re-check and halt on any violation.
8. **Predicted-output accuracy.** Every "Expected: ..." line in a step that describes runtime behavior (test failures, error messages, output samples) must be validated before the plan is approved. Predicted failure modes in TDD steps are a frequent source of wrong predictions — the author guesses what the current code will do and is occasionally wrong. For TDD steps where the plan predicts *which* tests will fail, either (a) actually run the new tests against the current code before writing the prediction, or (b) soften the prediction to the checkable minimum, e.g., "at least one of the new tests fails with an assertion error". Wrong predictions cause the executing agent to halt on an "Expected" mismatch even though the implementation is on track — a wasted dispatch.

Items 6 and 8 together: do not specify output the plan author has not observed or cannot derive with certainty. Ambiguity and guessing here cascade directly into failed dispatches.

Fix issues inline. No re-review — just fix and move on. If a spec requirement has no task, add the task.

After self-review fixes are applied, run the premortem (next section).

## Premortem (after self-review, before user review gate)

After self-review fixes are applied, run an adversarial four-category sweep against the plan. The premortem is a distinct cognitive mode from self-review: self-review catches tactical defects (placeholders, type consistency, command runnability); the premortem catches strategic flaws (hidden assumptions, irreversibility, spec-misinterpretation, weak verify clauses). Run both, in order.

Append a `## Premortem` section to the plan doc, immediately after the plan-document header and before `## File structure`. The section uses bulleted per-category format. For each category, write either one or more risk bullets in the form `<risk> — <mitigation>`, or a single `none — <specific reason>` bullet. No category is skipped.

### The four categories

**1. Hidden assumptions** — *Does this plan trust something it shouldn't?*
The plan assumes some file, function, API, library behavior, environment variable, runtime invariant, or data shape exists or behaves a certain way. List each load-bearing assumption the plan does not verify itself. For each, state how the plan handles the assumption being wrong (a verify clause that catches it, an early task that confirms it, or "we accept the risk because <reason>").
`none — <reason>` valid when: the plan only touches code created within the plan, OR every external dependency has been read by the author and the relevant assumption verified inline.

**2. Irreversible / risky steps** — *What's expensive to undo?*
Migrations, deletions, schema changes, mass renames, edits to files outside the feature area, package-manifest changes, lockfile updates, anything production-affecting, anything touching shared state across tasks. For each, state the rollback path (a revert commit, a down-migration, a backup) and whether the plan exercises it before the destructive step.
`none — <reason>` valid when: every task can be reverted by `git revert <commit>` without follow-up work.

**3. Spec-misalignment** — *Where could the user say "that's not what I asked for"?*
For each spec requirement that has more than one reasonable interpretation, state which interpretation the plan picked and surface it. Verify clauses that lock in the interpretation count as mitigation. Cases where the plan's interpretation diverges from the most-literal reading of the spec are BLOCKING RISK candidates.
`none — <reason>` valid when: every spec requirement has exactly one reasonable interpretation, AND every task's verify clause matches that interpretation observably.

**4. Verify-clause weakness** — *Where does success and failure look the same?*
For each task, ask: could broken code pass this verify clause? Could correct code fail it? Examples of weak clauses: "test file passes" (passes on empty file), "no errors in console" (passes if the feature didn't load), "endpoint returns 200" (passes on a stub). For each weak clause, tighten it inline before the user-review gate.
`none — <reason>` valid when: every verify clause names a specific assertion, exit code, file content, or HTTP response that distinguishes correct from broken.

### Output format (in the plan doc)

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

### BLOCKING RISK label

If any category surfaces a risk the author cannot mitigate inline by editing the plan (typically a category-3 spec-misalignment that goes deep, or a category-2 irreversibility with no rollback), the bullet is prefixed `**BLOCKING RISK:**` and the mitigation field reads `requires user decision — recommend revising spec or accepting risk`.

The premortem itself never halts the skill. It produces the section and proceeds to the user-review gate. The user reads the labeled bullet there and decides whether to approve, revise the spec, or bounce back to brainstorm.

### Premortem anti-patterns

- Writing `none — N/A` or `none — no risks` for every category. If the categorical sweep produces four `none` lines, the author did not actually do the sweep. `none` reasons must be specific (e.g., `none — only touches new files in src/components/ThemeToggle/`, not `none — N/A`).
- Stating a risk without a mitigation. Every fixable bullet has the form `<risk> — <mitigation>`. Risks without mitigations are either BLOCKING RISKs (label them) or unfinished work.
- Treating the premortem as documentation of risks already addressed during drafting. The premortem is adversarial *new* analysis. If every bullet is something the author already had in mind while writing tasks, the sweep wasn't adversarial.
- Removing or watering down a `BLOCKING RISK:` label to make the plan look approvable. The label is for the user, not for the author's comfort.

## Anti-patterns

- Writing a single mega-task that touches ten files. Split it.
- Using compressed or telegraphic prose anywhere in the plan. The plan is a contract; compression makes it ambiguous.
- Skipping the file-structure section. Task decomposition without a file map leads to overlap and rework.
- Writing "similar to above" instead of repeating code. Agents execute tasks in parallel or out of order.
- Inventing behaviors the spec did not authorize. Stay within scope; surface anything the spec missed as a question, do not silently add tasks.

## Execution handoff

After the plan is saved and self-reviewed, present the user with the execution choice:

> Plan saved to `docs/plans/<filename>.md`. Two execution options:
>
> **1. Subagent-driven (recommended)** — one fresh agent per task, review between tasks.
> **2. Inline execution** — run tasks in this session, batched with checkpoints.
>
> Which approach?

Wait for the user's choice. Then invoke the corresponding execution skill. Do not pick unilaterally.

## Output of this skill

- A committed plan file at `docs/plans/YYYY-MM-DD-<feature-name>.md`.
- A pending question to the user about execution mode.

No structured return value — this skill is file-producing and user-facing.
