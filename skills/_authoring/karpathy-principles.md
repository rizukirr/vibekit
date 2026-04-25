# Karpathy Principles — Vibekit Behavioral Standard

**Purpose.** Authoring-only contract. Every vibekit skill that mutates code must be written to obey these four principles. Sibling to `peg-cheatsheet.md`: PEG structures *substance*, Karpathy governs *behavior*. Caveman compresses *style*. Three orthogonal axes; none substitutes for another.

Derived from Andrej Karpathy's observations on LLM coding pitfalls (forrestchang/andrej-karpathy-skills). Distilled to fit vibekit's pipeline.

This file is **never loaded at runtime**. It is read by the human or agent editing skill files. Enforcement lives inside the skills themselves (see Injection map below).

---

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. **Push back when warranted.**
- If something is unclear, stop. Name what's confusing. Ask.

Vibekit injection: `brainstorm-lean` runs an explicit **Pushback turn** before approach generation. The skill is *required* to challenge the user's framing if a simpler path exists.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If 200 lines could be 50, rewrite it.

Test: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

Vibekit injection: `review-pack` runs a **Simplicity pass** before user sign-off. LOC reported, bloat candidates quoted verbatim, verdict blocks merge.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

Test: every changed line traces directly to the user's request or a plan task.

Vibekit injection: `brief-compiler` ships these constraints in every RTCO CONSTRAINTS block; `exec-dispatch` enforces them per-task in its inline RTCO and Gate-1 self-review; `review-pack` Pass 5 audits the diff during review; `verify-gate` Step 3b is the fail-closed surgical-diff pass on orphan edits.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

| Instead of...   | Transform to...                                  |
|-----------------|--------------------------------------------------|
| "Add validation" | "Write tests for invalid inputs, then make them pass" |
| "Fix the bug"    | "Write a test that reproduces it, then make it pass"  |
| "Refactor X"     | "Ensure tests pass before and after"             |

Plan format:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let the agent loop independently. Weak criteria ("make it work") require constant clarification.

Vibekit injection: `plan-write` makes the `→ verify:` clause **mandatory** per task header. `vibe`'s post-plan gate refuses to advance the pipeline if any task header is missing the clause. `exec-dispatch` step 1a is the second-line defense — rejects ungated tasks at dispatch time.

---

## Injection map (where each principle is enforced)

| Principle              | Enforcing skills (in pipeline order)                                               | Mechanism                                                                       |
|------------------------|------------------------------------------------------------------------------------|---------------------------------------------------------------------------------|
| 1. Think Before Coding | `brainstorm-lean`                                                                  | Pushback turn before approach generation                                        |
| 2. Simplicity First    | `review-pack`                                                                      | Pass 4 — Simplicity, in Reflexion checklist                                     |
| 3. Surgical Changes    | `brief-compiler` → `exec-dispatch` → `review-pack` → `verify-gate`                 | RTCO CONSTRAINTS (prevention) → Gate-1 self-review (per-task detection) → Pass 5 (review detection) → Step 3b (fail-closed verification) |
| 4. Goal-Driven         | `plan-write` → `vibe` → `exec-dispatch`                                            | Mandatory `→ verify:` clause in plan; orchestrator gate after plan-write; dispatch step 1a rejects ungated tasks |

---

## Compression policy

Karpathy guardrail lines join the **never-compress** list. They sit alongside TDD markers, verification quotes, destructive-op warnings, and user answers. Caveman applies to *narration around* these checks, never to the checks themselves.

## Tradeoff note

These guardrails bias toward caution over speed. For trivial tasks (typo fixes, obvious one-liners), use judgment — not every change needs the full rigor. The goal is reducing costly mistakes on non-trivial work, not slowing down simple tasks.

## When authoring or editing a skill

1. Read this file and `peg-cheatsheet.md`.
2. Cite both in the skill header: `Follows: PEG (<technique>) + Karpathy (<principles>)`.
3. If the skill mutates code, ensure it routes through at least one Karpathy injection point.
4. Every line in the skill prompt must justify itself. No comments unless the *why* is non-obvious.
