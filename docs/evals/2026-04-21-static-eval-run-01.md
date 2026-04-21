# Vibekit Phase 1 — Static Eval Run 01

**Date:** 2026-04-21
**Method:** static. Read each SKILL.md as an executing agent would, walk the pipeline against a concrete test intent, log every ambiguity, missing cross-reference, and guardrail leak. No live subagent dispatch.
**Test intent:** "Add a `toKebabCase(s: string): string` utility with tests." Fresh Node/TS repo.
**Scope:** the seven Phase-1 skills (brainstorm-lean, plan-write, brief-compiler, report-filter, exec-dispatch, verify-gate, vibe).

---

## Summary of findings

| # | Severity | Skill(s) | Finding |
|---|----------|----------|---------|
| 1 | **block** | vibe, brainstorm-lean | Status-gate contract mismatch: `vibe` checks `Status: approved` in frontmatter, but the design-doc template puts `Status` in the body as `**Status:**`. The gate as written will always fail. |
| 2 | **block** | plan-write, exec-dispatch | Nested-fence collision: plan tasks contain fenced code blocks; exec-dispatch CONTEXT embeds the task excerpt inside another fenced block via `---` delimiters. With triple backticks inside triple backticks, the brief's fences close prematurely. Real parse risk. |
| 3 | **warn** | brainstorm-lean | Visual Companion is described but there is no mechanism in this plugin that implements it. Dead feature; following the instruction leads nowhere on a fresh install. |
| 4 | **warn** | report-filter | Skill says to validate that commit SHAs resolve in the repo. report-filter is a prompt; it has no git tool. The check must be done by the caller (exec-dispatch) which does. Skill does not distinguish. |
| 5 | **warn** | exec-dispatch | Gate-2 reviewer is marked "read-only" by prose; nothing enforces it. Relies on the subagent following the brief. No real isolation. |
| 6 | **warn** | verify-gate | "Three independent passes" inside a single session is aspirational, not real independence. Document the limitation or dispatch the three passes as distinct subagents. |
| 7 | **warn** | vibe | "Resumability" section has no state file; relies on globbing `docs/specs/` and `docs/plans/`. Breaks when two vibe runs are interleaved or filenames collide. |
| 8 | **nit** | brief-compiler, exec-dispatch | RTCO examples use nested fenced code blocks for JSON schema. When pasted into a `Task` prompt, the outer fence closes at the inner fence. Use indented code or a different delimiter for the schema block. |
| 9 | **nit** | plan-write | `docs/plans/` default path collides with existing repos that already use `docs/plans/` for something else. Consider `docs/vibe/plans/`. |
| 10 | **nit** | vibe | Stage numbering "[N/7]" is stale if Phase 2 adds stages. Bake the number in at runtime or drop the denominator. |
| 11 | **info** | all | No `.claude-plugin/plugin.json`, no `plugin.json`, no skill registry. Skills exist but are not yet packaged for any CLI runtime. |

Three **block**-level issues would cause the pipeline to halt on a live run. Seven **warn** issues would let the pipeline run but leak signal or reliability. Rest are polish.

---

## Walkthrough — per stage

### Stage 0 — user invokes `/vibe add a toKebabCase utility with tests`

Agent reads `skills/vibe/SKILL.md`. Clear enough to proceed.

Announcement: `[1/7] brainstorm`. OK.

### Stage 1 — brainstorm-lean

Agent reads `skills/brainstorm-lean/SKILL.md`. The HARD-GATE is explicit; the 9-step checklist is clear; one-question-at-a-time is clear.

- **Hypothetical Q1 to user:** "Should `toKebabCase` handle (a) just spaces and punctuation, (b) camelCase and PascalCase too, or (c) arbitrary Unicode with locale rules?"
- **User answer:** "(b)."
- **Hypothetical Q2:** "On empty input, return `''` or throw?"
- **User answer:** "Return `''`."
- **Hypothetical Q3:** "Is a single exported function in `src/kebab.ts` with a co-located test file acceptable?"
- **User answer:** "Yes."

Agent proposes 2-3 approaches (regex-chain, tokenizer + joiner, existing library). Rejects library (YAGNI). Presents design inline, gets per-section approval. Writes spec to `docs/specs/2026-04-21-tokebabcase-design.md`.

Spec content includes:
```
**Status:** draft
```
then after user approves, the agent flips it to:
```
**Status:** approved
```

Self-review runs, user-review-gate message sent verbatim, user says "approved".

**FINDING 1 (block):** brainstorm-lean produces `**Status:** approved` in the **body** (markdown bold), not in YAML frontmatter. vibe's gate check — `Status: approved in frontmatter` — fails because there is no frontmatter. The agent must either edit the template to use frontmatter, or update vibe's gate check, or use a looser grep. Decide one and align both skills.

**FINDING 3 (warn):** the agent considered offering the Visual Companion. There is no implementation — not a command, not an MCP server, not even a stub URL. Including this section leaves the agent dangling if they try to invoke it. Either build a minimal stub or cut the section from this skill.

### Stage 2 — plan-write

Agent reads `skills/plan-write/SKILL.md`. Prerequisite check (spec exists, approved) passes. Scope check: single function, single file, fine.

Agent produces `docs/plans/2026-04-21-tokebabcase.md`. File structure section lists `src/kebab.ts` and `src/kebab.test.ts`. Tasks follow the TDD bite-sized template:

- Task 1: failing test for "hello world" → "hello-world"
- Task 2: minimal implementation
- Task 3: failing test for camelCase input
- Task 4: extend implementation
- Task 5: empty-input test + guard
- Task 6: failing test for `HTTPServer` → `http-server` edge
- Task 7: extend implementation

Self-review passes. **FINDING 9 (nit):** default path `docs/plans/` could collide with existing plans in a real repo. Namespace under `docs/vibe/plans/` or similar.

### Stage 3 — user picks execution mode

vibe asks: "subagent-driven (recommended) | inline". User picks subagent-driven. OK.

### Stage 4 — isolate

No worktree skill exists in this phase. vibe's instruction is "create worktree or confirm branch" but there is no skill that owns this. **FINDING (warn):** missing skill. Probably belongs in Phase 2. For now, the orchestrator does it inline.

### Stage 5 — exec-dispatch

Agent reads `skills/exec-dispatch/SKILL.md`. Per task, compile an RTCO brief via `brief-compiler`.

For Task 1 of our plan:

```
ROLE: TypeScript test author for src/kebab.test.ts.
TASK: Implement Task 1 — Write failing test for "hello world" → "hello-world" — from docs/plans/2026-04-21-tokebabcase.md.
CONSTRAINTS:
  - Implement ONLY Task 1.
  - ...
CONTEXT:
  Plan path: docs/plans/2026-04-21-tokebabcase.md
  Task excerpt (verbatim):
  ---
  ### Task 1: failing test for basic kebab conversion

  **Files:**
  - Create: `src/kebab.test.ts`

  - [ ] **Step 1: Write the failing test**

  ```ts
  import { toKebabCase } from './kebab';
  test('converts space-separated to kebab', () => {
    expect(toKebabCase('hello world')).toBe('hello-world');
  });
  ```
  ...
  ---
OUTPUT (return exactly this JSON schema):
  ```json
  { ... }
  ```
```

**FINDING 2 (block):** the task excerpt contains triple-backtick fences. The brief's own representation (when shown to a subagent or logged as markdown) will terminate at the first inner triple-backtick. The whole CONTEXT + OUTPUT section collapses. This will silently produce a malformed brief on any real dispatch.

Fix options:
- (a) Use `~~~` as the outer fence whenever the inner content is `'''`-fenced.
- (b) Strip code fences from the plan when embedding, and instead embed the code as indented blocks or as a file reference: `See docs/plans/... § Task 1 (read verbatim)`.
- (c) Require the plan to use a sentinel fence language that the compiler rewrites on embed.

Recommend (b): brief carries only the *reference* (`plan path + task number + sha of plan at dispatch time`), and the subagent re-reads the plan itself. Removes the nested-fence problem entirely and also guarantees the subagent sees the current plan, not a stale copy.

**FINDING 8 (nit):** same class of bug for the OUTPUT JSON schema fencing. Same fix.

**FINDING 5 (warn):** Gate 2 reviewer claims "read-only". The brief says so, but if the subagent edits a file anyway, nothing prevents it. In practice, enforcement depends on the runtime's tool permissions. Note this limitation in the skill so users configure their runtime accordingly, or ensure Gate-2 briefs omit Edit/Write from the subagent's allowed-tool list where the runtime supports it.

**FINDING 4 (warn):** report-filter's schema validation includes "every `commits.sha` resolves in the repo". The skill as written is a prompt, so it cannot run `git cat-file`. The actual resolve has to happen in exec-dispatch (which does control tools). Either:
- move the SHA-resolution check text out of report-filter into exec-dispatch's return-filter, or
- clarify in report-filter that "validate" means "assert syntactically valid hex of ≥7 chars" and leave repo resolution to the caller.

### Stage 6 — verify-gate

Agent reads `skills/verify-gate/SKILL.md`. Reads the spec. Enumerates requirements:

- R1: "`toKebabCase('hello world')` returns `'hello-world'`"
- R2: "`toKebabCase('helloWorld')` returns `'hello-world'`"
- R3: "`toKebabCase('HTTPServer')` returns `'http-server'`"
- R4: "`toKebabCase('')` returns `''`"

Gathers evidence: test file + test runner output + commit SHAs.

Runs three self-consistency passes.

**FINDING 6 (warn):** in a single session, three passes back-to-back share context. The earlier pass anchors the later ones, so the "independent" guarantee is weak. Either (a) dispatch three fresh subagents for the verification verdict, or (b) weaken the claim in the skill to "three reasoning rounds" and accept the limitation. Recommend (a) since verify-gate is the last guardrail and the cost is small.

Repo-level checks: `npm test`, `tsc --noEmit`, `eslint`, `git status`. All logged verbatim. OK.

Verdict: `ready` (happy path). Report saved, committed.

### Stage 7 — final message

vibe sends the `vibe: ready` message. OK.

---

## Guardrail regression pass

From the top-level `CLAUDE.md` test list:

1. **Brainstorm flow fires all four phases, one question per turn, user answers quoted exact.** PASS — brainstorm-lean enforces it.
2. **Destructive operations surface full uncompressed warnings.** NOT TESTED in this scenario; no destructive op occurred. Needs a separate scenario.
3. **Debug evidence quotes byte-identical to source.** N/A here; debug-trace-lean is Phase 2.
4. **Plan-exec checklist items 1:1 with plan file.** PASS in principle — exec-dispatch lifts tasks verbatim. Blocked in practice by FINDING 2 (nested fences).
5. **TDD red/green/refactor markers explicit, never fragmented.** PASS — plan-write template is explicit.

---

## Token profile (estimated)

Ballpark for the kebab-case scenario, subagent-driven mode:

| Stage | Est. tokens | Notes |
|-------|-------------|-------|
| Brainstorm Q&A (3 Qs) | ~2k | mostly question/answer, verbatim |
| Approach + design + approval | ~1.5k | normal prose |
| Spec doc | ~0.8k | verbatim |
| Plan doc | ~1.2k | verbatim, includes code |
| 7 × subagent briefs | ~1.4k | RTCO, tight |
| 7 × subagent reports (filtered) | ~1.0k | JSON schema + verbatim output tails |
| 7 × Gate-2 reviews | ~1.4k | read-only |
| Verify-gate report | ~1.5k | evidence verbatim |
| Orchestrator overhead | ~0.2k | stage announcements |
| **Total** | **~11k** | vs. estimated ~25k unoptimized |

~55% reduction without compromising guardrails. Matches the pipeline's compression-policy design — most savings come from `brief-compiler` + `report-filter`, not from prose compression elsewhere.

---

## Recommended fixes (ordered by severity)

### Must fix before any live run

1. **Align Status gate (FINDING 1).** Pick: frontmatter YAML `status: approved` OR body `**Status:** approved`. Update both brainstorm-lean design template and vibe gate check. Recommend frontmatter — easier to grep reliably.

2. **Fix nested-fence bug (FINDINGS 2, 8).** Change exec-dispatch (and by extension brief-compiler examples) to embed plan tasks by *reference* (path + task number + plan commit SHA) rather than by verbatim paste. The subagent re-reads the plan directly. Side benefit: single source of truth, no staleness.

### Should fix before Phase 2

3. **Cut or stub Visual Companion (FINDING 3).** Remove the section from brainstorm-lean until a real implementation exists, or reduce to a one-line "out of scope".

4. **Disambiguate report-filter's validation scope (FINDING 4).** Explicit split: syntactic checks are the filter's job; repo-level resolve is the caller's (exec-dispatch).

5. **Gate-2 read-only enforcement note (FINDING 5).** One paragraph in exec-dispatch naming the runtime-dependent limitation and the allowed-tools configuration hint.

6. **Three-pass independence in verify-gate (FINDING 6).** Switch to dispatching three fresh subagents for the final verdict. The rest of the verification can stay in-session.

### Nice to have

7. Namespace default paths under `docs/vibe/...` (FINDING 9).
8. Runtime-computed stage numbering (FINDING 10).
9. A small state file for resumability (FINDING 7).
10. Packaging scaffold: `.claude-plugin/plugin.json`, skill registry, slash-command wiring (FINDING 11). Phase 3.

---

## Verdict

**Phase 1 is structurally sound but not runnable as-is.** Three block-level issues — two of which are one-line fixes, one of which (nested fences) requires a minor redesign of how briefs embed plan content. Once fixed, the pipeline is ready for a live dispatch eval.

The compression math works (~55% token cut on this scenario) and the guardrails (HARD-GATE, TDD structure, evidence-verbatim, 3-pass verdict) are clearly expressible and auditable.

Recommend: apply fixes 1, 2, 3, 4, 5, 6 in a single edit round, then re-eval with a live dispatch on the same kebab-case intent.
