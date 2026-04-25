---
name: brainstorm-lean
description: You MUST use this before any creative or implementation work — creating features, building components, adding functionality, or modifying behavior. Runs a disciplined Socratic brainstorming loop (hard gate, one-question-at-a-time, 2-3 approaches, design doc, user approval) while keeping token overhead minimal. Questions, user answers, approaches, design, and the written spec are never compressed.
---

# brainstorm-lean

Turn an idea into a validated design through collaborative dialogue, then hand off to the implementation plan. No code is written here. No implementation skill runs until the user has approved a design.

## HARD-GATE

Do NOT invoke any implementation skill, write any code, scaffold any project, or take any implementation action until you have presented a design and the user has approved it in writing.

**This applies to every project regardless of perceived simplicity.** A todo list, a single-function utility, a config change — all go through this gate. The design can be short (a few sentences for truly simple projects), but you MUST present it and get approval.

## When to invoke

The first skill in the vibe pipeline. Invoke whenever the user asks to build, add, modify, or refactor a feature — no exceptions.

## Anti-pattern: "this is too simple to need a design"

Every project goes through this process. "Simple" projects are where unexamined assumptions cause the most wasted work.

## Checklist

Create a task for each item. Complete in order:

1. **Explore project context** — files, docs, recent commits.
2. **Ask clarifying questions** — one at a time; purpose, constraints, success criteria.
3. **Pushback turn** — before proposing approaches, challenge the framing if a simpler path exists.
4. **Propose 2-3 approaches** — with trade-offs and your recommendation.
5. **Present design** — in sections scaled to complexity; approval after each section.
6. **Write design doc** — `docs/specs/YYYY-MM-DD-<topic>-design.md`, then commit.
7. **Spec self-review** — placeholders, contradictions, ambiguity, scope.
8. **User reviews written spec** — wait for explicit approval.
9. **Transition** — invoke the implementation-plan skill. This is the only terminal handoff.

## Process flow

```
Explore context
  └─ Clarifying questions (one at a time, Socratic)
       └─ loop until purpose / constraints / success criteria are explicit
  └─ Pushback turn (challenge framing — does a simpler path exist?)
  └─ 2-3 approaches + trade-offs + recommendation (full prose)
  └─ Present design in sections (approval after each)
  └─ Write design doc → docs/specs/YYYY-MM-DD-<topic>-design.md → commit
  └─ Spec self-review (fix inline)
  └─ User reviews spec (verbatim prompt — see §User review gate)
  └─ Invoke implementation-plan skill  [terminal]
```

## Key principles

- **One question at a time.** Do not batch. If a topic needs more exploration, split into multiple questions across multiple turns.
- **Multiple choice preferred** when possible; open-ended is fine when the question space is too wide.
- **YAGNI ruthlessly.** Remove unnecessary features from every design.
- **Always 2-3 approaches.** Even when one seems obvious. The user decides obviousness.
- **Incremental validation.** Present design in sections; get approval before moving on.
- **Be flexible.** Go back and clarify when something does not make sense.

## Compression policy

This skill compresses *only* assistant narration. Everything else is verbatim.

### Compress (trim to the minimum)
- Transitions between checklist steps (e.g., "Exploring repo context." not "Great — now that we've done X, let's move on to Y...").
- Self-narration ("I'll ask three questions about..." — drop entirely, just ask).
- Restatement of the user's last answer before asking the next question — drop.
- Acknowledgements ("Great!", "Got it!", "Excellent!") — drop.
- Prefaces on approach proposals ("Here are three options I've been thinking about..." → "Three options:").

### Keep verbatim (no compression, no paraphrase)
- **Every question asked to the user.** Questions are the product of this skill.
- **User's answers**, when quoted back. Quote exact; do not paraphrase.
- **Constraints, requirements, success criteria** as captured.
- **All three approach options + trade-offs + your recommendation.** Full prose — the user is making a decision.
- **The design itself**, at every section. Full prose, scaled to complexity.
- **The written design doc.** Normal prose. The implementation-plan skill parses this.
- **The user-review-gate message** (see below).
- **The pushback turn** (see §Pushback turn).
- **Any destructive-operation warning, scope flag, or ambiguity alert.**

### Auto-clarity override

Drop all compression entirely when:
- Presenting a security warning or irreversible-action confirmation.
- A multi-step sequence where fragment order risks misread.
- The user asks to clarify or repeats a question.
- Scope is flagged as too large and decomposition is proposed.

Resume normal compression after the clear passage.

## Understanding the idea

- Check the current project state first — files, docs, recent commits.
- **Scope check before detail questions.** If the request describes multiple independent subsystems (e.g., "build a platform with chat, file storage, billing, and analytics"), flag this immediately. Do not spend questions refining details of a project that must first be decomposed.
- If the project is too large for a single spec, help the user decompose into sub-projects: independent pieces, relationships, build order. Then brainstorm the first sub-project through the normal flow. Each sub-project gets its own spec → plan → implementation cycle.
- For appropriately-scoped projects, ask questions one at a time to refine the idea.
- Focus on: purpose, constraints, success criteria.

## Pushback turn (Karpathy principle 1: Think Before Coding)

Before generating approaches, run exactly one pushback turn. The skill is *required* to challenge the user's framing if a simpler path exists. Silently accepting the framing is a failure mode.

Output verbatim, in this shape:

> **Pushback:** Before I sketch approaches, one challenge — `<one-sentence simpler framing or hidden assumption>`. Is the smaller version what you want, or do you need the larger framing? (If the larger framing is correct, say so and I'll proceed.)

Examples:
- "Before I sketch approaches, one challenge — could this be a single CSS variable swap instead of themed component variants? Is the smaller version what you want, or do you need the larger framing?"
- "Before I sketch approaches, one challenge — the request says 'add caching layer', but the bottleneck so far is one slow query. Is per-request memoization enough, or do you need a real cache?"

If no simpler framing exists, state that explicitly:

> **Pushback:** No simpler framing — the requirement is already minimal. Proceeding to approaches.

The user's response (or absence of pushback) is recorded in the spec's `## Approach` section.

This turn is **never compressed**. It joins the verbatim list.

## Exploring approaches

- Propose 2-3 different approaches with trade-offs.
- Present conversationally with your recommendation and reasoning.
- Lead with your recommended option and explain why.

## Presenting the design

- Once you believe you understand what is being built, present the design.
- Scale each section to its complexity — a few sentences if straightforward, up to ~300 words if nuanced.
- Ask after each section whether it looks right so far.
- Cover: architecture, components, data flow, error handling, testing.
- Be ready to go back and clarify if something does not make sense.

## Design for isolation and clarity

- Break the system into smaller units that each have one clear purpose, communicate through well-defined interfaces, and can be understood and tested independently.
- For each unit, be able to answer: what does it do, how do you use it, and what does it depend on?
- If someone cannot understand what a unit does without reading its internals, or cannot change internals without breaking consumers — the boundaries need work.
- Smaller, well-bounded units are easier to hold in context and easier to edit reliably. A file that has grown large is usually a signal that it is doing too much.

## Working in existing codebases

- Explore the current structure before proposing changes. Follow existing patterns.
- Where existing code has problems that affect the work (a file that has grown too large, unclear boundaries, tangled responsibilities), include targeted improvements as part of the design — the way a good developer improves code they are working in.
- Do not propose unrelated refactoring. Stay focused on what serves the current goal.

## Design doc template

Every design doc has exactly these headings, scaled to the project's complexity.

```markdown
---
title: <topic>
date: YYYY-MM-DD
status: draft
---

# <topic> — Design

## Problem
<what the user is trying to do and why>

## Goals
- <bullet>

## Non-goals
- <bullet; scope limits>

## Constraints
- <technical, operational, deadline>

## Approach
<the chosen approach — architecture, components, data flow>

## Alternatives considered
<the other 1-2 approaches from step 4 and why rejected>

## Testing
<how we'll know it works>

## Open questions
<anything deferred by agreement — empty if none>
```

If a section is genuinely N/A for this project (e.g., no testing on a pure doc change), write `N/A — <one-line reason>`, not `TODO`.

## Spec self-review

After writing the spec, look at it with fresh eyes:

1. **Placeholder scan.** Any TBD / TODO / incomplete sections / vague requirements? Fix them.
2. **Internal consistency.** Do sections contradict? Does the architecture match the feature description?
3. **Scope check.** Is this focused enough for a single implementation plan, or does it need decomposition?
4. **Ambiguity check.** Could any requirement be interpreted two ways? If so, pick one and make it explicit.

Fix issues inline. No re-review — just fix and move on.

## User review gate

After the self-review passes, send exactly this message, verbatim:

> Spec written and committed to `<path>`. Please review it and let me know if you want to make any changes before we start writing out the implementation plan.

Wait for the user's response. If they request changes, make them and re-run the spec review. Only proceed once the user approves.

**On approval:** edit the spec's frontmatter in place — change `status: draft` to `status: approved` — and commit that single-line change with message `spec: approve <topic>`. Downstream skills gate on `status: approved` in the frontmatter, so this step is non-optional.

## After the design

- The ONLY next skill is the implementation-plan skill (writing-plans equivalent). Do not invoke any frontend, component, or implementation skill directly from this one.

## Output of this skill

Not a structured report — this skill is user-facing and file-producing.

**Side effects:**
- A committed design doc at `docs/specs/YYYY-MM-DD-<topic>-design.md`.
- User has explicitly approved the spec.

**Terminal action:**
- Invoke the implementation-plan skill with the spec path.
