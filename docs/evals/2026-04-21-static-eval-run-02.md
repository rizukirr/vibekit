# Vibekit Phase 1 — Static Eval Run 02 (post-fix re-eval)

**Date:** 2026-04-21 (same day as run-01, after the six-fix pass).
**Method:** static re-walk with the same test intent as run-01.
**Test intent:** "Add a `toKebabCase(s: string): string` utility with tests." Fresh Node/TS repo.
**Goal:** confirm the three block-level issues are resolved, confirm the should-fix warnings are addressed, surface any regression or new issue introduced by the fixes.

---

## Verification of run-01 findings

| # | Severity | Status | Notes |
|---|----------|--------|-------|
| 1 | block | **resolved with nit** | `brainstorm-lean` now writes YAML frontmatter (`status: draft`, flipped to `status: approved` on user approval). **New nit:** `vibe`'s gate still phrases the check as `Status: approved` (capital S) — the frontmatter key is lowercase `status`. Case-insensitive grep works in practice but the skill should match the template exactly. One-word fix. |
| 2 | block | **resolved** | `exec-dispatch` now embeds plan tasks by **reference** (plan path + plan commit SHA + task id). The subagent re-reads the plan directly. Nested-fence collision is eliminated. Side benefit: single source of truth, no stale copies. |
| 3 | warn | **resolved** | Visual Companion section removed from `brainstorm-lean`. Checklist renumbered 1–8. Process-flow diagram updated. No dangling references left in the skill. |
| 4 | warn | **resolved** | `report-filter` now explicitly scopes its validation as **syntactic** (regex-level) and delegates repo-level resolve to the caller. Clear boundary. |
| 5 | warn | **resolved** | `exec-dispatch` Gate-2 section now documents the read-only limitation and names tool-allowlisting as the runtime-dependent enforcement path. Users can act on it. |
| 6 | warn | **resolved** | `verify-gate`'s three passes are now **three fresh subagent dispatches** with fully specified briefs and a JSON verdict schema. In-session anchoring is eliminated by construction. |
| 7 | warn | still open | Resumability without a state file. Punted — not a Phase 1 blocker. Add `docs/vibe/runs/<run-id>.json` or equivalent before public release. |
| 8 | nit | **resolved** | OUTPUT JSON schemas in RTCO examples use indented blocks, not nested fences. No outer-fence collisions. |
| 9 | nit | still open | Default paths still `docs/specs/`, `docs/plans/`, `docs/verifications/`. Namespacing under `docs/vibe/` is worth doing before Phase 2. |
| 10 | nit | still open | Stage numbering `[N/7]` is hardcoded. Will need updating when Phase 2 adds stages. Low risk. |
| 11 | info | still open | No `.claude-plugin/plugin.json` yet. Packaging is Phase 3. |

**Score:** 3/3 blocks resolved. 3/7 warns resolved (the three flagged as should-fix). 1/4 nits resolved. No regressions introduced by the fixes.

---

## Walkthrough — what changed

### Stage 1 — brainstorm-lean

Design doc is now written with YAML frontmatter:

```
---
title: toKebabCase
date: 2026-04-21
status: draft
---

# toKebabCase — Design

## Problem
...
```

After user approval, the agent flips the frontmatter in place:

```
status: approved
```

and commits `spec: approve toKebabCase`. Downstream gates can grep the frontmatter reliably. The old `**Status:**` body-bold form is gone.

**New nit:** `vibe` says `Status: approved` (capital S) in the gate check line; the frontmatter key is lowercase `status`. A plain `grep -i '^status: approved'` handles it either way, but the skill's own text should match the template. One-token edit when convenient.

### Stage 2 — plan-write

No changes required; already referenced by path. Plan file sits at `docs/plans/2026-04-21-tokebabcase.md` as before.

### Stage 5 — exec-dispatch

The dispatch brief now looks like:

```
ROLE: TypeScript test author for src/kebab.test.ts.
TASK: Implement Task 1 — failing test for basic kebab conversion — from docs/plans/2026-04-21-tokebabcase.md.
CONSTRAINTS:
  - Implement ONLY Task 1.
  - Follow every step in order.
  - TDD: write the failing test first and run it to confirm it fails before any implementation.
  - After each code change, run the test command shown in the task and include the last 20 lines of output in your report.
  - Make exactly one commit per logical change, using the commit message shown in the task.
  - Do not modify files outside the ones the task's "Files" section names.
  - Do not install new dependencies or modify package manifests unless the task explicitly says so.
  - If any step fails or produces output that does not match the task's "Expected" value, stop and report the failure. Do not improvise a fix.
CONTEXT:
  Plan path: docs/plans/2026-04-21-tokebabcase.md
  Plan commit SHA: <sha of HEAD for the plan file at dispatch time>
  Task id: Task 1
  Instruction: read the plan file at the given path at the given commit, locate `### Task 1:`, and follow every step in order.
  Repo state: branch vibe/tokebabcase, clean worktree.
OUTPUT (return exactly this JSON schema):
  {
    "task_number": 1,
    ...
  }
```

No triple-backticks inside triple-backticks. The brief can be pasted verbatim into any dispatch target. The subagent fetches the plan text itself; it cannot drift from a summary because there is no summary.

### Stage 6 — verify-gate

Each of the three verdict passes is now a separate subagent brief:

```
ROLE: Verification pass 1 of 3 for requirement R-1.
TASK: Decide whether the supplied evidence satisfies the supplied requirement.
CONSTRAINTS:
  - Read-only. No edits, no commits, no external tool calls beyond reading the cited artifacts.
  - Base the decision on the evidence as quoted. Do not consult other requirements, other passes, or external knowledge.
  - If the evidence is insufficient, return `partial` with a one-line reason.
CONTEXT:
  Requirement: "toKebabCase('HTTPServer') returns 'http-server'"
  Evidence:
    - tests/kebab.test.ts:34 — assertion line:
      `expect(toKebabCase('HTTPServer')).toBe('http-server');`
    - npm test output tail:
      ```
      ✓ converts acronyms to lowercased segments (6 ms)
      ```
OUTPUT:
  { "pass": 1, "verdict": "yes", "reason": "" }
```

Three of these dispatch in parallel, each with `pass: 1 | 2 | 3`. The caller collects three verdicts and applies the majority rule (or escalates on disagreement). No context-sharing between passes — independence is enforced structurally.

---

## New findings introduced by the fix pass

| # | Severity | Skill | Finding |
|---|----------|-------|---------|
| A | nit | vibe | `Status` vs `status` case mismatch in the gate-check wording. See above. |
| B | nit | exec-dispatch | The subagent now needs `git show <plan-sha>:<plan-path>` access to read the plan at the specific commit. This requires `Bash` or equivalent in its tool allowlist. Not a bug, but worth noting in the skill so a runtime with tight tool scopes does not silently fail. |
| C | nit | verify-gate | Three parallel verification dispatches multiply by the number of requirements. A spec with 20 requirements = 60 subagent briefs. For typical Phase 1 scope this is fine; note the cost for large specs in the skill so users can opt into a "critical requirements only" mode on big features. |

All three are **nits**, not blockers. Log and move on; fix opportunistically.

---

## Updated token profile

Net effect of the fixes on the kebab-case scenario:

| Stage | Run-01 | Run-02 | Delta | Reason |
|-------|--------|--------|-------|--------|
| Brainstorm Q&A | 2.0k | 2.0k | 0 | |
| Spec doc | 0.8k | 0.8k | 0 | |
| Plan doc | 1.2k | 1.2k | 0 | |
| Subagent briefs (7×) | 1.4k | 1.1k | −0.3k | no embedded task excerpts |
| Subagent reports | 1.0k | 1.0k | 0 | |
| Gate-2 reviews (7×) | 1.4k | 1.1k | −0.3k | same, by reference |
| Verify-gate (3 passes × 4 reqs) | 1.5k | 1.8k | +0.3k | three dispatches per req |
| Overhead | 0.2k | 0.2k | 0 | |
| **Total** | **~11.0k** | **~10.5k** | **−5%** | net improvement |

Savings on briefs offset the added cost of independent verification dispatches. Token total goes down, guardrails get stronger. That is the correct trade.

---

## Verdict

**Pass.** All three run-01 blockers are resolved. All three prioritized warnings are resolved. No regressions. Three new nits (A, B, C) — all safe to defer.

The pipeline is now ready for a **live dispatch eval** on the same kebab-case intent:

1. Create a throwaway TypeScript repo.
2. Invoke `/vibe add a toKebabCase utility with tests`.
3. Walk through brainstorm, plan, exec, verify.
4. Log actual token usage, actual gate behavior, any real-world failure modes the static eval could not surface.

Recommend that as **eval run-03**, after deciding whether to address the three new nits (A, B, C) first. A and B are one-line edits; C is documentation. Probably cheaper to fix now than to rediscover during a live run.

---

## Recommendation

Fix A, B, C in one short edit round (≈5 minutes), then schedule eval run-03 as a live dispatch on a throwaway repo.
