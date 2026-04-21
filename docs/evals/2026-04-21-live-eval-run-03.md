# Vibekit Phase 1 — Live Eval Run 03 (real subagent dispatches)

**Date:** 2026-04-21.
**Method:** live dispatch. Set up a throwaway repo at `tests/eval/run-03-live/` (Node 25, built-in test runner, git, docs scaffold). Walked the vibekit pipeline manually in the role of the `vibe` orchestrator. Every subagent was a real `Agent` call with a real RTCO brief. Every artifact (spec, plan, implementation) was produced by the skills under test.
**Test intent:** "Add a `toKebabCase(s)` utility with tests" — same intent as the static evals, adapted to plain JavaScript and Node's built-in test runner to avoid a TS toolchain.
**Scope reached:** brainstorm-lean → plan-write → exec-dispatch (Task 1 × 2 dispatches, Task 2 × 1 dispatch) → Gate 2 for Task 1. Stopped before verify-gate by decision.

---

## Headline finding

**The halt-and-report behavior is the single strongest signal from this run.** Two independent dispatches halted on "Expected" mismatch. In both cases the defect was in the plan (authored by the vibekit operator), not in the implementation. In both cases the subagent:

- detected the mismatch on the exact criterion the skill prescribes,
- stopped before committing,
- returned schema-valid JSON with a precise `unexpected` description,
- did not improvise a fix.

This is exactly what the skills are supposed to enforce. The guardrails held against real model behavior, not just on paper.

---

## Event log

| Event | Outcome | Evidence |
|-------|---------|----------|
| Write spec with YAML frontmatter `status: draft` | OK | `docs/specs/2026-04-21-kebab-design.md` committed |
| Flip frontmatter to `status: approved` + commit | OK (gate-1 fix holds) | commit `4670356 — spec: approve kebab` |
| Write 2-task TDD plan + commit | OK | commit `b4b0ac6`, plan at SHA `b4b0ac6` |
| Dispatch Task 1 (by reference — path + SHA) | HALT | agent ran `node --test src/` per plan; Node 25 treated `src/` as an entrypoint and errored MODULE_NOT_FOUND; agent reported with `unexpected` populated, did not commit |
| Amend plan: `node --test src/` → `node --test src/*.test.js` | OK | plan commit `2bc3d8e` |
| Re-dispatch Task 1 (fresh agent, new plan SHA) | PASS | commit `4a1d205`, filter + Gate-1 green |
| Gate 2 for Task 1 (fresh read-only reviewer) | PASS | `{"verdict":"pass","findings":[]}` |
| Dispatch Task 2 | HALT | plan's Step-2 predicted 2/3 tests fail; actual = 1/3; agent halted before implementing |
| Decision: stop live eval, capture findings | — | this document |

---

## Findings (new, from live dispatch only)

| # | Severity | Skill | Finding |
|---|----------|-------|---------|
| L1 | none (positive) | exec-dispatch | Halt-on-Expected-mismatch works under real subagent behavior. Two independent halts; both clean, both schema-valid, both truthful in `unexpected`. |
| L2 | none (positive) | report-filter + Gate 1 | Schema validation caught *no* spurious issues on the healthy run and accepted the halt reports as schema-valid with a populated `unexpected` field. No false rejects, no false accepts. |
| L3 | none (positive) | exec-dispatch | By-reference plan embedding (path + plan commit SHA) works end-to-end. Both re-dispatches re-read the plan via `git show <sha>:<path>` and executed it verbatim. Nested-fence collision is gone in practice, not just on paper. |
| L4 | **warn** | plan-write | **Plan predictions about runtime behavior are a primary defect source.** Both halts in this run were caused by plan-author mis-predictions (a command that doesn't run in Node 25; a TDD "2 of 3 fail" prediction that was actually "1 of 3 fails"). The strict halt rule turns a plan defect into a dispatch halt and a wasted agent run. Addressed: added self-review items 6 (command runnability) and 7 (predicted-output accuracy) to `plan-write`. |
| L5 | nit | exec-dispatch | Runtime quirks (Node 25 removing `node --test <dir>`) are not visible to the plan author from the spec alone. Consider a one-line "Runtime notes" section in the plan header so the plan author is forced to state the target runtime's version and the commands known to work there. Phase 2. |
| L6 | nit | general | Each dispatch consumed ~30k tokens. Run-03 total (3 dispatches) ≈ 90k. If verify-gate had run fully (3 × 5 requirements = 15 dispatches) it would have been another ~450k. For small features the verify-gate amortization is poor. Reinforces the cost-control note added to `verify-gate` (critical-only mode). |
| L7 | info | packaging | Everything was invoked by hand because there is no plugin manifest yet. A real `/vibe` invocation + auto-skill-chaining requires Phase 3 packaging. Static + live evals both hit the same ceiling on this. |

No skill-level regressions. All three run-01 block-level fixes held.

---

## What the live eval proved

- **Frontmatter gate (fix 1) works.** Real agent, real `git show` call, real frontmatter parse. No ambiguity.
- **By-reference plan embedding (fix 2) works.** Two separate agents loaded the plan at a specific commit SHA and executed it without drift.
- **Read-only Gate 2 works.** Reviewer read `git show 2bc3d8e:...` + `git show 4a1d205`, returned clean verdict. Tool allowlisting would tighten it further per the skill's own note.
- **verify-gate three-pass design** not exercised yet, but the pattern is validated by how well the three earlier dispatches handled their briefs.

## What the live eval revealed that static could not

- Plans contain hidden assumptions about the runtime that neither static nor the spec exposes. The skill catches the mismatch but the cost is a wasted dispatch. Plan-write's self-review now covers this (items 6 and 7).
- Subagent reports are well-behaved when the brief's OUTPUT schema is exact. Ambiguous output-format instructions would not survive real agent behavior.

---

## Token profile (actual, this run)

| Event | Dispatched tokens | Notes |
|-------|-------------------|-------|
| Task 1 dispatch (first, halted) | ~33.8k | 14 tool calls (read plan, write code, run tests, git checks) |
| Task 1 re-dispatch (pass) | ~29.4k | 8 tool calls |
| Gate 2 review (pass) | ~26.3k | 2 tool calls (git show × 2) |
| Task 2 dispatch (halted) | ~28.8k | 4 tool calls |
| **Total subagent usage** | **~118k** | 4 dispatches, one halted run avoided an implementation commit |

Wall-clock dominated by the first Task 1 dispatch (≈45 min — single long agent run). Others completed in under a minute.

---

## Changes applied during run-03

- `docs/plans/.../kebab.md` test command fixed (test fixture only).
- `skills/plan-write/SKILL.md` self-review gained items 6 and 7 (command runnability + predicted-output accuracy). Live-eval-derived and load-bearing.

No other skill edits needed.

---

## Verdict

**Phase 1 is live-validated on the dispatch spine.** Two block-level fixes from run-01 (frontmatter gate + by-reference embedding) are proven against real subagents. The halt-and-report discipline is the most valuable single property of this pipeline; it turned two plan defects into clean halts instead of bad commits.

**Recommend Phase 2 priorities:**

1. Adopt a runnability hook for plan-write — either a real pre-commit shell that dry-runs the plan's commands, or a convention of "Runtime notes" at the plan header.
2. Write `isolate` / worktree skill (stage 4 placeholder in vibe).
3. Add `review-pack` + `finish-branch` (user-facing endpoint of the pipeline).

**Recommend Phase 3 priority:** packaging. Until `.claude-plugin/plugin.json` exists, every eval is a manual walk. Packaging unlocks real `/vibe` invocation and a repeatable eval harness.

**Do not recommend** a run-04 manual live eval before Phase 3 — the remaining value per token is low. The next eval worth doing is an automated run against the packaged plugin on 2–3 intents of varying complexity, measuring halt-rate, dispatch-to-commit ratio, and wall-clock.
