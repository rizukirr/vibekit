# Verification Report — NEEDS_INPUT halt-and-resume

**Date:** 2026-05-02
**Spec:** `docs/specs/2026-05-02-needs-input-design.md`
**Plan:** `docs/plans/2026-05-02-needs-input.md`
**Commit verified:** `9d33046` (range `def79bd~1..HEAD`)
**Verification mode:** single-pass per requirement + mandatory surgical-diff pass (path C from skill cost-control). Single-pass verdicts are weaker evidence than three-pass; user opted in.

---

## Repo-level checks

vibekit is a markdown/JSON skill repository — no test suite, type-checker, linter, or build step applies. The only repo-level checks are surgical-diff (mandatory), git status, and git log.

- **Surgical-diff pass:** `clean` (zero orphans). All changed files trace to plan tasks 1–5; checkbox-flip commits authorized by exec-dispatch protocol.

  ```json
  {"verdict": "clean", "orphans": []}
  ```

- **`git status --porcelain`:**
  ```
   M .gitignore
  ```
  The `.gitignore` modification is pre-existing (predates this run; user instructed to leave alone). No other uncommitted changes.

- **`git log --oneline def79bd~1..HEAD`:**
  ```
  9d33046 chore: complete Task 5 — cross-skill consistency audit (5/5 PASS)
  ca64256 audit: cross-skill consistency check passes for NEEDS_INPUT (5/5)
  426beab chore: complete Task 4 — bump 5 manifests to v0.3.2
  dfdde7c release: bump all manifests to v0.3.2 (NEEDS_INPUT halt-and-resume)
  9acf209 chore: complete Task 3 — exec-dispatch NEEDS_INPUT halt-and-resume protocol
  2be7762 feat(exec-dispatch): add NEEDS_INPUT halt-and-resume protocol with budget cap
  3935fe8 chore: complete Task 2 — report-filter discriminated-union routing
  0c7e880 feat(report-filter): add discriminated-union routing and NEEDS_INPUT validation
  265d774 chore: complete Task 1 — brief-compiler NEEDS_INPUT schema and CONSTRAINTS
  def79bd feat(brief-compiler): declare NEEDS_INPUT discriminated-union schema and CONSTRAINTS contract
  ```

---

## Requirements

### G1. "Give a dispatched subagent a structured way to halt on genuine ambiguity (spec interpretation OR missing context the brief did not provide) instead of guessing or failing."

- **Verdict:** satisfied (single-pass)
- **Evidence:**
  - `skills/brief-compiler/SKILL.md` (commit `def79bd`) introduces a CONSTRAINTS bullet permitting NEEDS_INPUT on spec-ambiguity OR missing-context only:
    ```
    - You MAY halt with a NEEDS_INPUT return ONLY on spec-ambiguity (a spec/plan detail with two reasonable interpretations) OR missing-context (a file/API/library reference the brief did not provide).
    ```
  - `skills/exec-dispatch/SKILL.md` (commit `2be7762`) routes accepted `status: needs_input` returns into the new `## NEEDS_INPUT halt-and-resume protocol` section instead of failing the task. Verified by grep: `## NEEDS_INPUT halt-and-resume protocol` returns 1.

### G2. "Surface the halt to the user via a fixed verbatim wrapper that signals 'this is a NEEDS_INPUT halt, distinct from a normal exec-dispatch question or a task failure.'"

- **Verdict:** satisfied (single-pass)
- **Evidence:** `skills/exec-dispatch/SKILL.md` `## NEEDS_INPUT halt-and-resume protocol` Step 3 includes the fixed wrapper template starting with `> **Task <N> halted — needs input.**`. Wrapper field set verified in cross-skill audit (Task 5, `ca64256`) — references only variant-B schema fields. The wrapper joins the never-compress list per the same section.

### G3. "Resume cleanly via re-dispatch with augmented CONTEXT — no shared state, no two-agent handoffs, fresh subagent every time."

- **Verdict:** satisfied (single-pass)
- **Evidence:** `skills/exec-dispatch/SKILL.md` Step 5 ("Compile augmented brief") adds one block to CONTEXT — `Prior NEEDS_INPUT halt: Question / User answer / Halts remaining`. Step 6 ("Dispatch a fresh subagent") states: "Fresh agent, no history of the prior attempt. The augmented CONTEXT is the only carryover." Step 1 ("Verify rollback") + the `rolled_back: true` requirement enforce no shared state.

### G4. "Keep the path honest with a hard budget cap (2 halts/task) and a question-quality schema enforced by `report-filter`."

- **Verdict:** satisfied (single-pass)
- **Evidence:**
  - Budget cap = 2 stated in three places (verified by Task 5 audit step 6):
    - `skills/brief-compiler/SKILL.md`: `Budget cap: at most TWO NEEDS_INPUT signals on the same task across re-dispatches.`
    - `skills/exec-dispatch/SKILL.md`: `Each task starts with a NEEDS_INPUT budget of **2**.`
    - `skills/exec-dispatch/SKILL.md` escalation message: `Two prior halts have not produced a path forward.`
  - Question-quality schema in `skills/report-filter/SKILL.md` `## Discriminated-union schemas` section (commit `0c7e880`): seven NEEDS_INPUT validation rules (`blocking_step` non-empty; `ambiguity_type` enum; `tried` not placeholder; `question` ends with `?`; `options` ≥2; `recommendation` references option label or exact `none — no clear preference`; `rolled_back` is bool).

### G5. "Stay prose-only — no schema-validation library, no new tool, no new skill."

- **Verdict:** satisfied (single-pass)
- **Evidence:** `git diff --name-only def79bd~1..HEAD` shows changes confined to:
  - 3 existing SKILL.md files (no new skill)
  - 5 existing JSON manifests (version bumps only)
  - 1 plan file (this feature's plan)
  - 1 audit doc (verification artifact, not a skill)
  No new code files, no new tool definitions, no new skill directories under `skills/`.

### NG1. "Not letting subagents halt on environment, tooling, or test failures."

- **Verdict:** satisfied (single-pass)
- **Evidence:** `skills/brief-compiler/SKILL.md` CONSTRAINTS bullet (commit `def79bd`):
  ```
  You MAY NOT use NEEDS_INPUT for environment, tooling, test, or dependency failures — those are task failures and go in `unexpected`.
  ```
  Reinforced in `skills/exec-dispatch/SKILL.md` `## Anti-patterns` (commit `2be7762`):
  ```
  - Treating NEEDS_INPUT as a synonym for "task failed." It is a deliberate halt for ambiguity; failures still go through the existing `unexpected` field + escalation path.
  ```

### NG2. "Not preserving partial work across a halt."

- **Verdict:** satisfied (single-pass)
- **Evidence:**
  - `skills/brief-compiler/SKILL.md` CONSTRAINTS: `Before halting with NEEDS_INPUT, roll back any uncommitted partial work (git restore .) and any commits made during this task attempt (git reset --hard <pre-task-sha>). Set rolled_back: true in the return.`
  - `skills/exec-dispatch/SKILL.md` Step 1 verifies rollback; rejects `rolled_back: true` claims that don't match `git status` / `git log`.
  - Anti-pattern bullet: `Carrying partial commits across a NEEDS_INPUT halt to "save work." Rollback is mandatory.`

### NG3. "Not amending the plan file with user clarifications mid-run."

- **Verdict:** satisfied (single-pass)
- **Evidence:** `skills/exec-dispatch/SKILL.md` `## NEEDS_INPUT halt-and-resume protocol` Step 5 places the user's answer into the fresh brief's CONTEXT block, NOT into the plan file. No protocol step writes to the plan file. Anti-pattern from the existing skill (unchanged) still holds: "Editing the plan mid-run to retroactively match what the agent did" remains forbidden. No new edits to the plan-writing path.

### NG4. "Not adding a `NEEDS_INPUT`-style halt to read-only review subagents."

- **Verdict:** satisfied (single-pass)
- **Evidence:** `skills/exec-dispatch/SKILL.md` `### Gate 2 — plan-compliance review` section (lines 121–145, unchanged in commit `2be7762`) still declares OUTPUT as the non-discriminated `{"verdict": "pass|fail", "findings": [...]}` schema. No NEEDS_INPUT route added to read-only review briefs. `skills/brief-compiler/SKILL.md` CONSTRAINTS bullets are scoped to implementation briefs (worked example B, the implementation subagent example); worked example A (research subagent, read-only) is unchanged.

### NG5. "Not promoting NEEDS_INPUT to its own skill."

- **Verdict:** satisfied (single-pass)
- **Evidence:** `git diff --name-only def79bd~1..HEAD` shows zero new files under `skills/`. `using-vibekit/SKILL.md` auto-trigger map is unchanged (verified by grep: no edits to `skills/using-vibekit/`).

### C1. "The change is confined to three skill files: `skills/brief-compiler/SKILL.md`, `skills/report-filter/SKILL.md`, `skills/exec-dispatch/SKILL.md`. No new files. No edits to other skills."

- **Verdict:** satisfied (single-pass)
- **Evidence:** `git diff --name-only def79bd~1..HEAD` under `skills/`:
  ```
  skills/brief-compiler/SKILL.md
  skills/exec-dispatch/SKILL.md
  skills/report-filter/SKILL.md
  ```
  Only the three named skills modified. No other files under `skills/`. The audit doc (`docs/verifications/2026-05-02-needs-input-cross-skill-audit.md`) is a verification artifact, not a skill — outside this constraint's scope which applies to skills.

### C2. "Manifest version bumps across all five runtime adapters (Claude Code, Codex, Gemini, opencode, pi) — same rollout pattern as the plan-write premortem step (0.3.1 → 0.3.2)."

- **Verdict:** satisfied (single-pass)
- **Evidence:** `git show --stat dfdde7c` shows all five manifests modified. Cross-skill audit Task 5 confirmed `grep '"version"' ... | grep -c '0.3.2'` returns 5; JSON validity check returns 5 OK lines.

### C3. "Cross-runtime portable: a single SKILL.md edit per skill reaches all five runtime adapters via existing delivery paths."

- **Verdict:** satisfied (single-pass)
- **Evidence:** Each runtime adapter (Claude Code SessionStart hook, Codex AGENTS.md import, Gemini `@`-import, opencode plugin bootstrap, pi plugin extension) reads from the canonical `skills/<name>/SKILL.md` per the project's documented architecture (CLAUDE.md "Cross-runtime changes" section). No runtime-specific files were edited; only the canonical sources. Confirmed by `git diff --name-only` showing zero edits under `.codex-plugin/skills/`, `.opencode/skills/`, `.pi-plugin/skills/`, `hooks/`, or `gemini-extension.json` content beyond version field.

### C4. "Backwards-compatible: subagents that return the existing `complete` schema (without a `status` field) MUST still be accepted as `status: 'complete'` by `report-filter` for one minor version, to avoid breaking briefs from older plans cached in subagent runtimes."

- **Verdict:** satisfied (single-pass)
- **Evidence:** `skills/report-filter/SKILL.md` `## Discriminated-union schemas` section step 1 (commit `0c7e880`):
  ```
  - **Absent** → for backwards compatibility during one minor version, treat as `status: "complete"` and route to the existing single-schema validation. Drop this fallback at the next major.
  ```

### C5. "Compression policy unchanged: the four NEEDS_INPUT CONSTRAINTS bullets and the user-facing wrapper template join the never-compress list."

- **Verdict:** satisfied (single-pass)
- **Evidence:**
  - `skills/brief-compiler/SKILL.md` anti-patterns block adds: `Compressing or paraphrasing the NEEDS_INPUT CONSTRAINTS block. The four bullets are guardrail-critical and the contract that makes the halt path honest. Verbatim or the brief is invalid.`
  - `skills/exec-dispatch/SKILL.md` `## NEEDS_INPUT halt-and-resume protocol` Step 3 (after the wrapper template fenced block): `This wrapper joins the never-compress list. Never paraphrase, trim, or hide it.`

### C6. "The discriminated-union schema, the four CONSTRAINTS bullets, the wrapper template field set, and the REJECT messages MUST be byte-identical across the three skills' prose. Enforcement is the manual cross-skill audit checklist (see Testing)."

- **Verdict:** satisfied (single-pass)
- **Evidence:** Cross-skill audit document `docs/verifications/2026-05-02-needs-input-cross-skill-audit.md` (commit `ca64256`) records all 5 PASS lines:
  - Field-name parity: 8 fields (`status`, `blocking_step`, `ambiguity_type`, `question`, `tried`, `options`, `recommendation`, `rolled_back`) appear in at least two of the three SKILL.md files.
  - CONSTRAINTS-vs-protocol consistency: budget cap value, rollback contract, eligibility rules agree across `brief-compiler` and `exec-dispatch`.
  - REJECT-message field-name parity: no phantom field names; only the eight known fields appear.
  - Wrapper-template field-set: `exec-dispatch` references only variant-B schema fields.
  - Budget-cap-value parity: `2`/`TWO` appears identically in all three required locations.

---

## Disagreements

None. All 16 requirements (G1–G5 + NG1–NG5 + C1–C6) verified satisfied via single-pass.

---

## Overall verdict

**ready** — all requirements satisfied, surgical-diff pass returned `clean`, no repo-level check failed (none applicable beyond surgical-diff and git status, both clean), no disagreements.

**Caveat on rigor:** verification was single-pass per requirement, not the three-pass independent-subagent check. User opted into path C (cost-control) for this small, deterministic markdown+JSON change. Three-pass would strengthen the evidence for ambiguous requirements; for this run, every verdict is grounded in a verbatim file quote, `git diff` output, or the cross-skill audit's documented checks, which leaves little room for interpretation drift.
