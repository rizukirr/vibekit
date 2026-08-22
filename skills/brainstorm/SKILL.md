---
name: brainstorm
description: Use before any creative or implementation work: features, components, behavior changes. Hard gate, no code before an approved design.
trigger: About to start creative or implementation work, before code is written
gate: hard
---

# brainstorm

Turn an idea into a validated design through dialogue, then hand off to `plan`. No code is written here.

## HARD-GATE

Do NOT write code, scaffold a project, or invoke any implementation skill until you have presented a design and the user has approved it in writing.

This applies to every project regardless of perceived simplicity. A todo list, a one-function utility, a config change: all go through this gate. The design can be three sentences, but it must exist and be approved.

**Anti-pattern:** "this is too simple to need a design." Simple projects are where unexamined assumptions cause the most wasted work.

## Understand before you shorten

Before proposing anything, trace the whole thing first: every file the change touches, the actual flow. `lazy` governs how short the solution gets. It never shortens the reading.

## Procedure

1. **Invoke `lazy`, `terse` and `plain` before anything else.** `lazy` governs what you build, `terse` how you talk, `plain` how text is typed. All three stay on for the rest of the session. Their description lines are not their content. You have not read a skill until you have invoked it.
2. Explore context: **look before you ask**. List the directory, read what matters, check recent commits. "New project, nothing to explore" is a conclusion you may only reach *after* a tool call, never instead of one. Asking your first question before you have looked is skipping this step.
3. Clarifying questions, one at a time.
4. Scope check.
5. Pushback turn.
6. Two or three approaches with a recommendation.
7. Present the design in sections, approval after each.
8. Write the spec doc, commit.
9. Self-review.
10. User review gate.
11. Hand off to `plan`. Terminal.

## Clarifying questions

One at a time. Never batch. Multiple choice when the option space is small, open-ended when it is wide. Focus on purpose, constraints, success criteria.

**One question mark per turn.** Batching is what this rule actually fails at, so check the literal text before sending: if your turn contains a second `?`, or an "and" joining two asks, cut everything after the first question and hold it for the next turn. Two questions in one turn is a violation even when they are related, especially then, because the answer to the first often deletes the second.

Two rules that override the urge to proceed:

- **If multiple interpretations exist, present them. Do not pick silently.**
- **If something is unclear, stop. Name what is confusing. Ask.**

## Scope check

Before spending questions on detail: if the request spans multiple independent subsystems, say so immediately. Do not refine a project that must first be decomposed.

Decompose into sub-projects with an explicit build order, then brainstorm the first one. Each sub-project gets its own spec, plan and implementation cycle.

## Pushback turn

Exactly one, before approaches. Required. Challenge the framing if a simpler path exists. Silently accepting the user's framing is a failure mode.

Output verbatim, in this shape:

> **Pushback:** Before I sketch approaches, one challenge. `<one-sentence simpler framing or hidden assumption>`. Is the smaller version what you want, or do you need the larger framing? (If the larger framing is correct, say so and I'll proceed.)

If no simpler framing exists, say so explicitly:

> **Pushback:** No simpler framing: the requirement is already minimal. Proceeding to approaches.

Record the user's response in the spec's Approach section.

## Approaches

Two or three, always, even when one seems obvious. The user decides obviousness.

Full prose, with trade-offs and your recommendation. Lead with the recommendation and say why.

**At least one approach must sit at the laziest rung of `lazy`'s ladder that still meets the requirement**, so the user can choose it.

## Presenting the design

Scale each section to its complexity: a few sentences if straightforward, up to about 300 words if nuanced. Ask after each section whether it looks right so far.

Cover architecture, components, data flow, error handling, testing.

Break the system into units with one clear purpose each, communicating through well-defined interfaces. For each unit: what does it do, how do you use it, what does it depend on? If a unit cannot be understood without reading its internals, or its internals cannot change without breaking consumers, the boundaries need work.

In an existing codebase, follow existing patterns. Include targeted improvements where existing problems affect this work. Do not propose unrelated refactoring.

## Spec document

Write to `docs/specs/YYYY-MM-DD-<topic>-design.md`, then commit. Headings, in order:

```
---
title: <topic>
date: YYYY-MM-DD
status: draft
---

# <topic>: Design

## Problem
## Goals
## Non-goals
## Constraints
## Approach
## Alternatives considered
## Testing
## Open questions
```

**Each goal states an observable success criterion.** "Make it work" is not a goal. Strong criteria let downstream skills verify without asking the user.

If a section is genuinely not applicable, write `N/A: <one-line reason>`, never `TODO`.

## Self-review

Fresh eyes on what you just wrote:

1. **Placeholders.** Any TBD, TODO, or vague requirement? Fix it.
2. **Internal consistency.** Do sections contradict each other?
3. **Scope.** Focused enough for a single implementation plan?
4. **Ambiguity.** Could any requirement be read two ways? Pick one and make it explicit.

Fix inline. No re-review.

## User review gate

Send exactly this, verbatim:

> Spec written and committed to `<path>`. Please review it and let me know if you want to make any changes before we start writing out the implementation plan.

Wait for the response. On requested changes, make them and re-run self-review.

**On approval:** change `status: draft` to `status: approved` in the frontmatter and commit that single line with the message `spec: approve <topic>`. Downstream skills gate on it, so this step is not optional.

## Handoff

The only next skill is `plan`. Never invoke a frontend, component, or other implementation skill from here.
