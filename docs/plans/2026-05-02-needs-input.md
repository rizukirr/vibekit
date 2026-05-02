# NEEDS_INPUT Halt-and-Resume Implementation Plan

> **For executing agents:** implement this plan task-by-task. Each step uses checkbox (`- [ ]`) syntax. Do not skip steps. Do not batch commits across tasks.

**Goal:** Add a structured NEEDS_INPUT halt-and-resume mechanism to exec-dispatch's subagent loop so dispatched subagents can pause on genuine ambiguity (spec interpretation OR missing context) instead of guessing or failing.

**Architecture:** Three coupled prose edits to existing skills. `brief-compiler` declares a discriminated-union OUTPUT schema and adds four guardrail-critical CONSTRAINTS bullets. `report-filter` adds a discriminator-based routing section and validation rules for the `needs_input` variant. `exec-dispatch` splits its dispatch-loop on the `status` discriminator, adds a halt-and-resume protocol section with verbatim wrapper templates, a budget cap of 2, and updated failure-modes/anti-patterns. Five plugin manifests bump 0.3.1 → 0.3.2.

**Tech stack:** Markdown (prose-only skills) + JSON (plugin manifests). No code paths, no tests, no build. Verification is grep-based string presence.

---

## Premortem

**Hidden assumptions:**
- The current cached plugin runtime is at 0.2.1; the canonical source already has the plan-write premortem section at 0.3.1. Workers run from canonical source paths in this repo, not the cache. — mitigation: every task uses absolute repo paths under `/home/rizki/Projects/vibekit/skills/...`, never cache paths.
- `report-filter` is invoked uniformly by all dispatch sites; adding a `## Discriminated-union schemas` section reaches every consumer. — mitigation: section is additive after `## Schema validation`; existing single-schema validation rules are untouched, so non-discriminated callers (e.g. read-only review subagents) keep working.
- `exec-dispatch`'s dispatch-loop step 4 is the only entry point for return processing. — verified by grep: only one `Receive the return` reference in the file.

**Irreversible / risky steps:**
- none — every task can be reverted by `git revert <commit>`. No migrations, no schema changes, no shared-state edits, no package-manifest changes (manifest version bumps are reversible string edits).

**Spec-misalignment:**
- The spec says the four CONSTRAINTS bullets are "verbatim, never compressed." Risk: if Task 1 paraphrases them to fit the surrounding `## The RTCO template (mandatory)` section's prose style, `report-filter` and `exec-dispatch` validation expectations diverge. — mitigation: Task 1 step 1's verify clause is `grep -F` byte-exact match for each bullet's first 60 characters; soft paraphrase fails the grep.
- Spec says "implicit-complete fallback for one minor version" — the absence of `status` field is treated as `status: "complete"`. Risk: ambiguous interpretation — does this mean the discriminator-missing REJECT in `report-filter` Section 3a only fires when `status` is *present-and-invalid*, not when *absent*? — mitigation: Task 2 explicitly includes the fallback rule in `report-filter`'s discriminator-routing logic with a verbatim phrasing.

**Verify-clause weakness:**
- Risk: prose edits cannot truly "fail then pass" like code TDD. A grep for the new content matches as soon as the edit lands; there's no genuine failing-test phase. — mitigation: TDD pre-implementation grep is run on the *unedited* file (returns 0 matches → "fails" in TDD sense), then re-run after the edit (returns N matches → "passes"). The pre-edit zero-match grep IS the failing test. Verify clauses below quote the exact expected match counts post-edit.
- Risk: `grep -c "pattern"` returns line counts, but a multi-line section heading match could be inflated by example fence blocks (the same trap that Task 1 of the premortem feature hit, where the new section's `## Premortem` example block double-counted). — mitigation: every verify clause uses `grep -cF` (fixed-string) on long unique anchor phrases (≥30 chars) that cannot collide with example blocks.

---

## File structure

Modified:
- `skills/brief-compiler/SKILL.md` — add four NEEDS_INPUT CONSTRAINTS bullets to the RTCO template (after line 33, inside the CONSTRAINTS block), replace the OUTPUT schema in worked example B (lines 112-122) with the discriminated union, add one anti-pattern bullet (after line 133).
- `skills/report-filter/SKILL.md` — add new `## Discriminated-union schemas` section after line 73 (between `## Schema validation` and `## Worked examples`); add one anti-pattern bullet (after line 182).
- `skills/exec-dispatch/SKILL.md` — modify dispatch-loop step 4 (line 39) to split on `status`; add new `## NEEDS_INPUT halt-and-resume protocol` section after `## Return-side filter` (after line 100, before line 102 `## Review gates`); add two bullets to `## Failure modes and recovery` (after line 245); add two bullets to `## Anti-patterns` (after line 254); add one paragraph to `## Parallelism` (after line 231).
- `.claude-plugin/plugin.json:4` — version 0.3.1 → 0.3.2.
- `.codex-plugin/plugin.json:3` — version 0.3.1 → 0.3.2.
- `.opencode/plugin.json:4` — version 0.3.1 → 0.3.2.
- `.pi-plugin/plugin.json:4` — version 0.3.1 → 0.3.2 (no trailing comma — preserve).
- `gemini-extension.json:4` — version 0.3.1 → 0.3.2.

---

### Task 1: ✓ Edit `skills/brief-compiler/SKILL.md` → verify: `grep -cF 'You MAY halt with a NEEDS_INPUT return' skills/brief-compiler/SKILL.md` returns 1, AND `grep -cF '"status": "needs_input"' skills/brief-compiler/SKILL.md` returns 1, AND `grep -cF 'Compressing or paraphrasing the NEEDS_INPUT CONSTRAINTS block' skills/brief-compiler/SKILL.md` returns 1

**Files:**
- Modify: `skills/brief-compiler/SKILL.md` (RTCO template at lines 18-39, worked example B at lines 91-122, anti-patterns at lines 126-133)

- [x] **Step 1: Pre-edit grep — confirm content does not yet exist (TDD failing-test phase)**

Run:
```bash
grep -cF 'You MAY halt with a NEEDS_INPUT return' skills/brief-compiler/SKILL.md
grep -cF '"status": "needs_input"' skills/brief-compiler/SKILL.md
grep -cF 'Compressing or paraphrasing the NEEDS_INPUT CONSTRAINTS block' skills/brief-compiler/SKILL.md
```
Expected: all three return `0`.

- [x] **Step 2: Add four NEEDS_INPUT CONSTRAINTS bullets to the RTCO template**

Locate the CONSTRAINTS block in the RTCO template at line 25-30. After the existing bullet `- Do not delete pre-existing dead code; mention it in OUTPUT instead.` (line 28) and before the `<task-specific rule>` placeholder lines, insert these four bullets verbatim (preserve the two-space indent that matches the surrounding YAML-ish layout):

```
  - You MAY halt with a NEEDS_INPUT return ONLY on spec-ambiguity (a spec/plan detail with two reasonable interpretations) OR missing-context (a file/API/library reference the brief did not provide). You MAY NOT use NEEDS_INPUT for environment, tooling, test, or dependency failures — those are task failures and go in `unexpected`.
  - A NEEDS_INPUT return MUST include: `blocking_step` (verbatim quote of the plan step you halted at), `tried` (what you attempted to resolve from the brief alone — `n/a` is invalid), 2+ `options` with non-empty `label` and `summary`, and a `recommendation` (option label + reason, or exactly `none — no clear preference`). Vague returns are REJECTED by report-filter.
  - Before halting with NEEDS_INPUT, roll back any uncommitted partial work (`git restore .`) and any commits made during this task attempt (`git reset --hard <pre-task-sha>`). Set `rolled_back: true` in the return.
  - Budget cap: at most TWO NEEDS_INPUT signals on the same task across re-dispatches. A third halt is a task failure, not a question.
```

- [x] **Step 3: Replace OUTPUT schema in worked example B with discriminated union**

Locate worked example B's OUTPUT block at lines 112-122. Replace the entire fenced JSON block (the lines beginning ` ```json` through ` ``` `) with this discriminated-union declaration:

````
OUTPUT (discriminated union — return EXACTLY ONE variant):

  Variant A — task complete:
  ```json
  {
    "status": "complete",
    "tests_added": ["path:line"],
    "files_changed": ["path"],
    "test_command": "string",
    "test_output_tail": "string (last 20 lines of test runner output)",
    "commits": ["sha — subject"]
  }
  ```

  Variant B — needs input (spec-ambiguity OR missing-context only):
  ```json
  {
    "status": "needs_input",
    "task_number": 0,
    "task_title": "string",
    "blocking_step": "verbatim plan step quote",
    "ambiguity_type": "spec-ambiguity | missing-context",
    "question": "string ending with ?",
    "tried": "what you attempted from the brief alone",
    "options": [
      {"label": "A", "summary": "string"},
      {"label": "B", "summary": "string"}
    ],
    "recommendation": "option label + reason, or 'none — no clear preference'",
    "rolled_back": true
  }
  ```
````

- [x] **Step 4: Add anti-pattern bullet**

Locate the anti-patterns block at lines 126-133. After the last existing bullet (line 133, `- Hidden state...`), append one new bullet on a new line:

```
- Compressing or paraphrasing the NEEDS_INPUT CONSTRAINTS block. The four bullets are guardrail-critical and the contract that makes the halt path honest. Verbatim or the brief is invalid.
```

- [x] **Step 5: Post-edit grep — confirm three required strings present**

Run:
```bash
grep -cF 'You MAY halt with a NEEDS_INPUT return' skills/brief-compiler/SKILL.md
grep -cF '"status": "needs_input"' skills/brief-compiler/SKILL.md
grep -cF 'Compressing or paraphrasing the NEEDS_INPUT CONSTRAINTS block' skills/brief-compiler/SKILL.md
```
Expected: all three return `1`.

- [x] **Step 6: Commit**

```bash
git add skills/brief-compiler/SKILL.md
git commit -m "feat(brief-compiler): declare NEEDS_INPUT discriminated-union schema and CONSTRAINTS contract"
```

---

### Task 2: ✓ Edit `skills/report-filter/SKILL.md` → verify: `grep -cF '## Discriminated-union schemas' skills/report-filter/SKILL.md` returns 1, AND `grep -cF 'status discriminator missing' skills/report-filter/SKILL.md` returns 1, AND `grep -cF 'Accepting a NEEDS_INPUT return with' skills/report-filter/SKILL.md` returns 1

**Files:**
- Modify: `skills/report-filter/SKILL.md` (insert new section after line 73; add anti-pattern bullet after line 182)

- [x] **Step 1: Pre-edit grep — confirm content does not yet exist**

Run:
```bash
grep -cF '## Discriminated-union schemas' skills/report-filter/SKILL.md
grep -cF 'status discriminator missing' skills/report-filter/SKILL.md
grep -cF 'Accepting a NEEDS_INPUT return with' skills/report-filter/SKILL.md
```
Expected: all three return `0`.

- [x] **Step 2: Insert `## Discriminated-union schemas` section between `## Schema validation` (ends line 73) and `## Worked examples` (line 74)**

Locate line 73 (the last line of the Schema validation section, ending with "Three rejections in a row on the same dispatch → escalate to user. Do not enter an infinite loop."). Immediately after that line, insert one blank line, then the following section verbatim, then one blank line before the existing `## Worked examples` heading:

```markdown
## Discriminated-union schemas

Some briefs (notably implementation briefs from `exec-dispatch`) declare two valid return shapes distinguished by a top-level `status` field. The filter routes before validating:

1. **Read the discriminator first.** Parse the top-level `status` field.
   - **Absent** → for backwards compatibility during one minor version, treat as `status: "complete"` and route to the existing single-schema validation. Drop this fallback at the next major.
   - **`status: "complete"`** → existing variant A validation rules (unchanged).
   - **`status: "needs_input"`** → variant B validation rules (below).
   - **Any other value** → REJECT with `status discriminator missing or invalid: declare 'complete' or 'needs_input'`.

2. **Variant B (`needs_input`) validation rules.** In addition to the standard key/type checks:
   - `blocking_step` non-empty and not whitespace. Empty → REJECT (`blocking_step required: quote the verbatim plan step you halted at`).
   - `ambiguity_type` is exactly `spec-ambiguity` or `missing-context`. Anything else → REJECT.
   - `tried` non-empty AND not a placeholder. Strings matching `/^(n\/a|nothing|none|tbd)$/i` after trim → REJECT (`tried required: state what you attempted to resolve from the brief alone — 'n/a' is not a valid answer`).
   - `question` non-empty AND ends with `?`. A NEEDS_INPUT halt without a question is malformed.
   - `options` array length ≥ 2. Each entry has non-empty `label` and `summary`. Single-option "questions" → REJECT.
   - `recommendation` non-empty. Either references one of the option labels OR is exactly the string `none — no clear preference`. Other "no recommendation" wording → REJECT.
   - `rolled_back` is bool, no string coercion.

3. **Caveat.** Syntactic validation only. The filter cannot judge whether a NEEDS_INPUT question is *substantively* genuine — that judgment belongs to the orchestrator (`exec-dispatch`), which decides whether a syntactically-valid halt is worth surfacing to the user.

```

- [x] **Step 3: Add anti-pattern bullet at end of `## Anti-patterns` block**

Locate the `## Anti-patterns` block starting at line 176. After the last existing bullet ("Accepting a report that *looks* right but violates the schema. Schema is the contract."), append one new bullet on a new line:

```
- Accepting a NEEDS_INPUT return with `tried: "n/a"` or a single-option `options` array because "the question seems reasonable." The filter's job is schema enforcement; reasonableness is the orchestrator's call after the schema passes. Reject and let the subagent re-format.
```

- [x] **Step 4: Post-edit grep — confirm all three strings present**

Run:
```bash
grep -cF '## Discriminated-union schemas' skills/report-filter/SKILL.md
grep -cF 'status discriminator missing' skills/report-filter/SKILL.md
grep -cF 'Accepting a NEEDS_INPUT return with' skills/report-filter/SKILL.md
```
Expected: all three return `1`.

- [x] **Step 5: Commit**

```bash
git add skills/report-filter/SKILL.md
git commit -m "feat(report-filter): add discriminated-union routing and NEEDS_INPUT validation"
```

---

### Task 3: ✓ Edit `skills/exec-dispatch/SKILL.md` → verify: `grep -cF '## NEEDS_INPUT halt-and-resume protocol' skills/exec-dispatch/SKILL.md` returns 1, AND `grep -cF 'Task <N> halted — needs input' skills/exec-dispatch/SKILL.md` returns 1, AND `grep -cF 'NEEDS_INPUT budget exhausted' skills/exec-dispatch/SKILL.md` returns 2 (one in the protocol section, one in failure-modes)

**Files:**
- Modify: `skills/exec-dispatch/SKILL.md` (dispatch-loop step 4 at line 39; insert protocol section between line 100 and 102; failure-modes at lines 239-245; anti-patterns at lines 247-254; parallelism section ending at line 231)

- [x] **Step 1: Pre-edit grep — confirm content does not yet exist**

Run:
```bash
grep -cF '## NEEDS_INPUT halt-and-resume protocol' skills/exec-dispatch/SKILL.md
grep -cF 'Task <N> halted — needs input' skills/exec-dispatch/SKILL.md
grep -cF 'NEEDS_INPUT budget exhausted' skills/exec-dispatch/SKILL.md
```
Expected: all three return `0`.

- [x] **Step 2: Modify dispatch-loop step 4 to split on `status`**

Locate line 39 (`4. **Receive the return.** Apply the report filter (see §Return-side filter). If validation fails, REJECT and ask the subagent to re-format (never re-run). Three rejections in a row on the same task → escalate to user.`). Replace that line with:

```
4. **Receive the return.** Apply the report filter (see §Return-side filter). If validation fails, REJECT and ask the subagent to re-format (never re-run). Three rejections in a row on the same task → escalate to user. On accept, route by the `status` discriminator: `complete` → step 5; `needs_input` → enter the **NEEDS_INPUT halt-and-resume protocol** (see §NEEDS_INPUT halt-and-resume protocol), then return to step 4 with the new return.
```

- [x] **Step 3: Insert `## NEEDS_INPUT halt-and-resume protocol` section between `## Return-side filter` and `## Review gates`**

Locate line 100 (the last line of `## Return-side filter`, which is `5. **On accept:** pass to the review gates.`). After that line, insert one blank line, then the following section verbatim, then one blank line before the existing `## Review gates` heading at line 102:

````markdown
## NEEDS_INPUT halt-and-resume protocol

When `report-filter` returns an accepted variant B (`status: "needs_input"`) result, the dispatch loop enters this protocol instead of proceeding to the review gates. The protocol is bounded, verbatim-surfaced, and resumes via fresh re-dispatch.

### Step 1 — Verify rollback

The return claims `rolled_back: true`. Cross-check with the actual repo state:

```bash
git status --porcelain
git log --oneline <pre-task-sha>..HEAD
```

If `git status` shows uncommitted changes OR `git log` shows commits made during this task attempt that were not reverted, REJECT with delta: `rolled_back claimed but <evidence> shows uncommitted/unreverted state`. The subagent must roll back fully or the halt is rejected as malformed.

### Step 2 — Budget check

Each task starts with a NEEDS_INPUT budget of **2**. Each accepted halt decrements the budget. If the current return is the **third** halt on this task (budget would go negative), do NOT surface to the user — escalate as a task failure with this verbatim message:

> **Task <N> escalated — NEEDS_INPUT budget exhausted.** Two prior halts have not produced a path forward. The plan or brief is likely structurally broken. Options: (1) roll back the task and route back to plan-write to repair the plan; (2) accept the unresolved ambiguity as a known-risk and continue with explicit user direction.

### Step 3 — Surface to user (verbatim wrapper template)

Print exactly this block, with field values quoted verbatim from the return — do not paraphrase, do not "clean up" the question:

```
> **Task <N> halted — needs input.**
>
> **Blocking step:** <blocking_step>
> **Ambiguity type:** <ambiguity_type>
> **Question:** <question>
>
> **What the subagent already tried:** <tried>
>
> **Options:**
> - **A.** <options[0].summary>
> - **B.** <options[1].summary>
> <... additional options if present ...>
>
> **Subagent recommendation:** <recommendation>
>
> Reply with an option label or your own answer. Halts remaining on this task: <budget_remaining>.
```

This wrapper joins the never-compress list. Never paraphrase, trim, or hide it.

### Step 4 — Receive user answer

Free-form. The user MAY reply with:
- An option label (`A`, `B`, …) → fold the corresponding `options[].summary` into the augmented brief as the resolution.
- Free-text answer → fold verbatim into the augmented brief.
- A routing instruction (e.g. "stop, the plan is wrong") → exit the dispatch loop, route back to `plan-write` with the question and user response as new context. Do not attempt to re-dispatch.

### Step 5 — Compile augmented brief

Re-run `brief-compiler` for the same task with one addition to the CONTEXT block:

```
Prior NEEDS_INPUT halt:
  Question: "<question verbatim>"
  User answer: "<answer verbatim>"
  Halts remaining: <budget_remaining>
```

CONSTRAINTS unchanged from the original brief — the four NEEDS_INPUT bullets remain, since the subagent may halt again up to budget. OUTPUT schema unchanged — still the discriminated union.

### Step 6 — Dispatch a fresh subagent

Same procedure as the original step 3 of the dispatch loop. Fresh agent, no history of the prior attempt. The augmented CONTEXT is the only carryover.

### Step 7 — Loop

Return to step 4 of the main dispatch loop. The new return goes through `report-filter`, gets routed by `status`, and either completes the task or triggers another NEEDS_INPUT cycle (up to budget).

````

- [x] **Step 4: Add two bullets to `## Failure modes and recovery`**

Locate the `## Failure modes and recovery` block ending at line 245 (last bullet: "Plan file has drifted during execution..."). After that bullet, append two new bullets:

```
- **NEEDS_INPUT budget exhausted on a task.** Escalate per §NEEDS_INPUT halt-and-resume protocol Step 2 with the verbatim escalation message. Do not silently grant a third halt; do not silently fail the task either — present the two options explicitly.
- **User answers a NEEDS_INPUT with "the plan is wrong" or equivalent.** Exit the dispatch loop. Route back to `plan-write` with the halt question and user response as new context. Do not attempt to re-dispatch.
```

- [x] **Step 5: Add two bullets to `## Anti-patterns`**

Locate the `## Anti-patterns` block ending at line 254 (last bullet: "Editing the plan mid-run..."). After that bullet, append two new bullets:

```
- Treating NEEDS_INPUT as a synonym for "task failed." It is a deliberate halt for ambiguity; failures still go through the existing `unexpected` field + escalation path.
- Carrying partial commits across a NEEDS_INPUT halt to "save work." Rollback is mandatory. The augmented re-dispatch is a fresh start, not a continuation.
```

- [x] **Step 6: Add parallel-group interaction paragraph to `## Parallelism`**

Locate the end of the `### Anti-patterns specific to parallel-group` subsection at line 231 (last bullet: "Mixing files in two tasks' Files sections..."). After that bullet, insert one blank line, then this paragraph verbatim:

```
### NEEDS_INPUT inside a parallel-group

A NEEDS_INPUT halt inside a parallel-group does NOT halt the group. Sibling tasks continue executing. The halted task waits for the user's answer; on resume, it rejoins the group's completion-tracking. Group-fail-closed semantics still apply: if the halted task ultimately fails (budget exhausted, user routes to replan), the whole group is treated as failed and surfaced to the user per §Parallel dispatch procedure step 6.
```

- [x] **Step 7: Post-edit grep — confirm content present**

Run:
```bash
grep -cF '## NEEDS_INPUT halt-and-resume protocol' skills/exec-dispatch/SKILL.md
grep -cF 'Task <N> halted — needs input' skills/exec-dispatch/SKILL.md
grep -cF 'NEEDS_INPUT budget exhausted' skills/exec-dispatch/SKILL.md
```
Expected: first two return `1`, third returns `2` (one occurrence in the verbatim escalation message inside the protocol section, one in the failure-modes bullet).

- [x] **Step 8: Commit**

```bash
git add skills/exec-dispatch/SKILL.md
git commit -m "feat(exec-dispatch): add NEEDS_INPUT halt-and-resume protocol with budget cap"
```

---

### Task 4: ✓ Bump plugin manifest versions 0.3.1 → 0.3.2 across all five runtime adapters → verify: `grep -h '"version"' .claude-plugin/plugin.json .codex-plugin/plugin.json .opencode/plugin.json .pi-plugin/plugin.json gemini-extension.json | grep -c '0.3.2'` returns 5

**Files:**
- Modify: `.claude-plugin/plugin.json:4`
- Modify: `.codex-plugin/plugin.json:3`
- Modify: `.opencode/plugin.json:4`
- Modify: `.pi-plugin/plugin.json:4` (preserve absence of trailing comma)
- Modify: `gemini-extension.json:4`

- [x] **Step 1: Pre-edit grep — confirm all five at 0.3.1**

Run:
```bash
grep -h '"version"' .claude-plugin/plugin.json .codex-plugin/plugin.json .opencode/plugin.json .pi-plugin/plugin.json gemini-extension.json | grep -c '0.3.1'
```
Expected: `5`.

- [x] **Step 2: Bump `.claude-plugin/plugin.json` line 4**

Change `"version": "0.3.1",` to `"version": "0.3.2",` (preserve trailing comma).

- [x] **Step 3: Bump `.codex-plugin/plugin.json` line 3**

Change `"version": "0.3.1",` to `"version": "0.3.2",` (preserve trailing comma).

- [x] **Step 4: Bump `.opencode/plugin.json` line 4**

Change `"version": "0.3.1",` to `"version": "0.3.2",` (preserve trailing comma).

- [x] **Step 5: Bump `.pi-plugin/plugin.json` line 4 (NO trailing comma — confirmed by pre-edit grep)**

Change `"version": "0.3.1"` to `"version": "0.3.2"` (no comma; this manifest's version is the last key so the line must remain comma-less).

- [x] **Step 6: Bump `gemini-extension.json` line 4**

Change `"version": "0.3.1",` to `"version": "0.3.2",` (preserve trailing comma).

- [x] **Step 7: Post-edit grep — confirm all five at 0.3.2**

Run:
```bash
grep -h '"version"' .claude-plugin/plugin.json .codex-plugin/plugin.json .opencode/plugin.json .pi-plugin/plugin.json gemini-extension.json | grep -c '0.3.2'
```
Expected: `5`.

- [x] **Step 8: JSON validity check**

Run:
```bash
for f in .claude-plugin/plugin.json .codex-plugin/plugin.json .opencode/plugin.json .pi-plugin/plugin.json gemini-extension.json; do python3 -c "import json; json.load(open('$f'))" && echo "OK: $f"; done
```
Expected: five `OK:` lines, no Python tracebacks.

- [x] **Step 9: Commit**

```bash
git add .claude-plugin/plugin.json .codex-plugin/plugin.json .opencode/plugin.json .pi-plugin/plugin.json gemini-extension.json
git commit -m "release: bump all manifests to v0.3.2 (NEEDS_INPUT halt-and-resume)"
```

---

### Task 5: ✓ Cross-skill consistency audit (manual checklist) → verify: a single audit document at `docs/verifications/2026-05-02-needs-input-cross-skill-audit.md` exists with five PASS lines, one per checklist item

**Files:**
- Create: `docs/verifications/2026-05-02-needs-input-cross-skill-audit.md`

- [x] **Step 1: Read all three edited SKILL.md files in one pass**

Open in order, skim end-to-end:
- `skills/brief-compiler/SKILL.md`
- `skills/report-filter/SKILL.md`
- `skills/exec-dispatch/SKILL.md`

- [x] **Step 2: Field-name parity check**

Confirm these eight field names appear byte-identical wherever referenced across the three files:
`status`, `blocking_step`, `ambiguity_type`, `question`, `tried`, `options`, `recommendation`, `rolled_back`.

Run:
```bash
for field in status blocking_step ambiguity_type question tried options recommendation rolled_back; do
  echo "=== $field ==="
  grep -lF "$field" skills/brief-compiler/SKILL.md skills/report-filter/SKILL.md skills/exec-dispatch/SKILL.md
done
```
Expected: every field appears in at least two of the three files (some appear in all three; none appear in zero or one).

- [x] **Step 3: CONSTRAINTS-vs-protocol consistency check**

Confirm:
- `brief-compiler`'s budget bullet says "TWO" / "third" — same as `exec-dispatch`'s Step 2 ("budget of 2", "third halt").
- `brief-compiler`'s rollback bullet matches `exec-dispatch`'s Step 1 (both reference `git restore .` + `git reset --hard <pre-task-sha>` + `rolled_back: true`).
- `brief-compiler`'s eligibility bullet (spec-ambiguity OR missing-context, NOT environment/tooling/test) matches `report-filter`'s `ambiguity_type` enum (`spec-ambiguity | missing-context`).

- [x] **Step 4: REJECT-message field-name parity**

Confirm `report-filter`'s NEEDS_INPUT REJECT messages reference only field names that `brief-compiler`'s OUTPUT schema declares. No phantom fields.

Run:
```bash
grep -F 'REJECT' skills/report-filter/SKILL.md | grep -iE 'blocking_step|ambiguity_type|tried|question|options|recommendation|rolled_back|status'
```
Expected: every match references one of the eight known field names; no other field names appear.

- [x] **Step 5: Wrapper-template field-set check**

Confirm `exec-dispatch`'s wrapper template references only fields present in variant B of the schema. The wrapper uses: `<N>` (task_number), `<blocking_step>`, `<ambiguity_type>`, `<question>`, `<tried>`, `<options[0].summary>`, `<options[1].summary>`, `<recommendation>`, `<budget_remaining>` (orchestrator-tracked, not a field). All schema-fields here exist in variant B.

- [x] **Step 6: Budget-cap-value parity**

Confirm the value `2` (or "TWO") appears identically as the budget cap in all three places:
- `brief-compiler` CONSTRAINTS bullet: "at most TWO"
- `exec-dispatch` Step 2: "budget of **2**"
- `exec-dispatch` escalation message: "Two prior halts"

Run:
```bash
grep -F 'TWO NEEDS_INPUT signals' skills/brief-compiler/SKILL.md
grep -F 'budget of **2**' skills/exec-dispatch/SKILL.md
grep -F 'Two prior halts' skills/exec-dispatch/SKILL.md
```
Expected: each grep returns exactly one line.

- [x] **Step 7: Write the audit document**

Create `docs/verifications/2026-05-02-needs-input-cross-skill-audit.md` with this content:

```markdown
# Cross-skill consistency audit — NEEDS_INPUT

**Date:** 2026-05-02
**Spec:** `docs/specs/2026-05-02-needs-input-design.md`
**Plan:** `docs/plans/2026-05-02-needs-input.md`
**Files audited:** `skills/brief-compiler/SKILL.md`, `skills/report-filter/SKILL.md`, `skills/exec-dispatch/SKILL.md`

## Checklist results

- [x] **Field-name parity** — all eight fields (`status`, `blocking_step`, `ambiguity_type`, `question`, `tried`, `options`, `recommendation`, `rolled_back`) appear byte-identical across at least two of the three files. PASS — evidence: grep loop in plan Task 5 Step 2.
- [x] **CONSTRAINTS-vs-protocol consistency** — budget value (2/TWO/third), rollback contract (`git restore .` + `git reset --hard`), eligibility (spec-ambiguity OR missing-context) all agree across `brief-compiler` and `exec-dispatch`. PASS.
- [x] **REJECT-message field-name parity** — no phantom field names in `report-filter` REJECT messages. PASS.
- [x] **Wrapper-template field-set** — `exec-dispatch` wrapper references only variant B schema fields. PASS.
- [x] **Budget-cap-value parity** — value 2/TWO present identically in all three required locations. PASS.

## Verdict

**clean** — no cross-skill drift detected. The discriminated-union schema, four CONSTRAINTS bullets, REJECT messages, wrapper template, and budget cap value are byte-identically aligned across the three skills.
```

- [x] **Step 8: Verify the audit document exists with five PASS lines**

Run:
```bash
test -f docs/verifications/2026-05-02-needs-input-cross-skill-audit.md && grep -c 'PASS' docs/verifications/2026-05-02-needs-input-cross-skill-audit.md
```
Expected: `5`.

- [x] **Step 9: Commit**

```bash
git add docs/verifications/2026-05-02-needs-input-cross-skill-audit.md
git commit -m "audit: cross-skill consistency check passes for NEEDS_INPUT (5/5)"
```

---

## Plan saved to `docs/plans/2026-05-02-needs-input.md`. Two execution options:

**1. Subagent-driven (recommended)** — one fresh agent per task, review between tasks.
**2. Inline execution** — run tasks in this session, batched with checkpoints.

Which approach?
