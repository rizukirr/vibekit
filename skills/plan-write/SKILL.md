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

## Task structure

Every task follows this shape exactly:

````markdown
### Task N: [Component Name]

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
7. **Predicted-output accuracy.** Every "Expected: ..." line in a step that describes runtime behavior (test failures, error messages, output samples) must be validated before the plan is approved. Predicted failure modes in TDD steps are a frequent source of wrong predictions — the author guesses what the current code will do and is occasionally wrong. For TDD steps where the plan predicts *which* tests will fail, either (a) actually run the new tests against the current code before writing the prediction, or (b) soften the prediction to the checkable minimum, e.g., "at least one of the new tests fails with an assertion error". Wrong predictions cause the executing agent to halt on an "Expected" mismatch even though the implementation is on track — a wasted dispatch.

Items 6 and 7 together: do not specify output the plan author has not observed or cannot derive with certainty. Ambiguity and guessing here cascade directly into failed dispatches.

Fix issues inline. No re-review — just fix and move on. If a spec requirement has no task, add the task.

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
