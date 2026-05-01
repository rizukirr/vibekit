# plan-write Premortem Step Implementation Plan

> **For executing agents:** implement this plan task-by-task. Each step uses checkbox (`- [ ]`) syntax. Do not skip steps. Do not batch commits across tasks.

**Goal:** Add an adversarial four-category premortem step to `skills/plan-write/SKILL.md`, fired after self-review and before the user-review gate, producing a persistent `## Premortem` section in every plan doc.

**Architecture:** Single-skill prose-only edit. New `## Premortem` section in `skills/plan-write/SKILL.md` defines four categories (hidden assumptions, irreversible/risky steps, spec-misalignment, verify-clause weakness), the `none — <reason>` allowance, the `BLOCKING RISK:` label, and anti-patterns. The plan-document-header template inside the skill gains a `## Premortem` placeholder. The existing self-review section gets one closing line directing to the new step. Plugin manifest versions bump 0.3.0 → 0.3.1 across all five runtime adapters per `AGENTS.md` versioning convention.

**Tech stack:** Markdown skill files; JSON plugin manifests; bash for verification (grep, jq).

---

## Premortem

**Hidden assumptions:**
- Assumes the existing `## Self-review (after writing the plan)` heading text in `skills/plan-write/SKILL.md` matches verbatim — verified by reading the file at planning time (line 206). Mitigation: Task 1 step 2 greps for the exact heading and halts on miss.
- Assumes all five plugin manifest version fields read `"version": "0.3.0"` at execution time — verified via `rtk grep '"version"'` at planning time. Mitigation: Task 2 reads each manifest and verifies the current value before bumping; mismatch halts the task.

**Irreversible / risky steps:**
- none — every change is contained to `skills/plan-write/SKILL.md` and five JSON manifests; `git revert <commit>` reverses each task without follow-up work.

**Spec-misalignment:**
- Spec calls the new section "premortem step" and says it fires "after self-review and before user-review gate." Plan implements that ordering literally and surfaces the heading as `## Premortem (after self-review, before user review gate)` so the placement is explicit in the skill text. Mitigation: section heading matches spec wording and the closing line of self-review explicitly directs to it.

**Verify-clause weakness:**
- Task 1's verify clause greps for the new section heading; an empty section (heading only, no body) would still pass. Mitigation: tightened to also grep for the four category labels (`Hidden assumptions:`, `Irreversible / risky steps:`, `Spec-misalignment:`, `Verify-clause weakness:`) and the `BLOCKING RISK` keyword.
- Task 2's verify clause checks that all five manifests read `0.3.1`; a partial bump (e.g., four manifests bumped, one missed) would fail correctly because the grep expects all five.

---

## File structure

Modified:
- `skills/plan-write/SKILL.md` — add `## Premortem` section after the existing `## Self-review` section; add `## Premortem` placeholder to the plan-document header template; add one closing line to the self-review section.
- `.claude-plugin/plugin.json:4` — version bump 0.3.0 → 0.3.1.
- `.codex-plugin/plugin.json:3` — version bump 0.3.0 → 0.3.1.
- `.pi-plugin/plugin.json:4` — version bump 0.3.0 → 0.3.1.
- `gemini-extension.json:4` — version bump 0.3.0 → 0.3.1.
- `.opencode/plugin.json:4` — version bump 0.3.0 → 0.3.1.

No new files. No file deletions.

---

### Task 1: Add `## Premortem` section, header-template stub, and self-review closing line to `skills/plan-write/SKILL.md` → verify: `grep -c "^## Premortem" skills/plan-write/SKILL.md` returns `2` (one in the header template, one as the new top-level section); all four category labels present; `BLOCKING RISK` keyword present; the line `After self-review fixes are applied, run the premortem (next section).` present.

**Files:**
- Modify: `skills/plan-write/SKILL.md`

- [ ] **Step 1: Confirm the existing self-review section heading is exactly `## Self-review (after writing the plan)`**

Run: `grep -n "^## Self-review" skills/plan-write/SKILL.md`
Expected: one match, line 206, text `## Self-review (after writing the plan)`. If the match line differs, halt and ask the user — the spec assumed this heading.

- [ ] **Step 2: Append the closing line to the self-review section**

Insert immediately after the existing line `Fix issues inline. No re-review — just fix and move on. If a spec requirement has no task, add the task.` — add a blank line then this exact line:

```markdown
After self-review fixes are applied, run the premortem (next section).
```

- [ ] **Step 3: Insert the new `## Premortem` section between the existing `## Self-review` section and the existing `## Anti-patterns` section**

Insert this exact content as a new section (it sits between `## Self-review` and `## Anti-patterns`; existing `## Anti-patterns` heading is unchanged):

````markdown
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
````

- [ ] **Step 4: Update the plan-document-header template (existing `## Plan document header` section in `skills/plan-write/SKILL.md`)**

The current template ends with a `---` separator line. Insert the following block immediately after that `---` and before the next existing `## Task structure` section heading. The template now shows authors what the `## Premortem` placeholder looks like in the rendered plan:

````markdown
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
````

- [ ] **Step 5: Verify the four required markers are present**

Run:

```bash
grep -c "^## Premortem" skills/plan-write/SKILL.md
grep -c "Hidden assumptions:" skills/plan-write/SKILL.md
grep -c "Irreversible / risky steps:" skills/plan-write/SKILL.md
grep -c "Spec-misalignment:" skills/plan-write/SKILL.md
grep -c "Verify-clause weakness:" skills/plan-write/SKILL.md
grep -c "BLOCKING RISK" skills/plan-write/SKILL.md
grep -c "After self-review fixes are applied, run the premortem" skills/plan-write/SKILL.md
```

Expected: at least one match for each (the first line should produce `2` — one in the header-template stub, one as the new top-level section heading; the others should produce `≥2` because each label appears both in the new section's category headings and in the output-format block, and `≥1` for the closing line).

If any expected count is 0, the corresponding insertion is missing — re-do the relevant step before committing.

- [ ] **Step 6: Commit**

```bash
git add skills/plan-write/SKILL.md
git commit -m "feat(plan-write): add premortem step with four-category adversarial sweep"
```

---

### Task 2: Bump plugin manifest versions 0.3.0 → 0.3.1 across all five runtime adapters → verify: `grep -h '"version"' .claude-plugin/plugin.json .codex-plugin/plugin.json .pi-plugin/plugin.json gemini-extension.json .opencode/plugin.json | grep -c '0.3.1'` returns `5`.

**Files:**
- Modify: `.claude-plugin/plugin.json:4`
- Modify: `.codex-plugin/plugin.json:3`
- Modify: `.pi-plugin/plugin.json:4`
- Modify: `gemini-extension.json:4`
- Modify: `.opencode/plugin.json:4`

- [ ] **Step 1: Confirm all five manifests currently read `0.3.0`**

Run:

```bash
grep -h '"version"' .claude-plugin/plugin.json .codex-plugin/plugin.json .pi-plugin/plugin.json gemini-extension.json .opencode/plugin.json
```

Expected: five lines, each containing `"version": "0.3.0"` (the `.pi-plugin/plugin.json` line lacks a trailing comma; the other four include one).

If any manifest reports a different version, halt and ask the user — the spec assumed all-five-at-0.3.0.

- [ ] **Step 2: Edit each manifest to bump 0.3.0 → 0.3.1**

For each of the five files, change exactly the one line containing `"version": "0.3.0"` to `"version": "0.3.1"`. Preserve trailing comma or its absence per the existing line:
- `.claude-plugin/plugin.json` line 4 — has trailing comma
- `.codex-plugin/plugin.json` line 3 — has trailing comma
- `.opencode/plugin.json` line 4 — has trailing comma
- `gemini-extension.json` line 4 — has trailing comma
- `.pi-plugin/plugin.json` line 4 — no trailing comma (preserve)

- [ ] **Step 3: Verify all five manifests now read `0.3.1`**

Run:

```bash
grep -h '"version"' .claude-plugin/plugin.json .codex-plugin/plugin.json .pi-plugin/plugin.json gemini-extension.json .opencode/plugin.json | grep -c '0.3.1'
```

Expected: `5`.

Also confirm no manifest still reads `0.3.0`:

```bash
grep -h '"version"' .claude-plugin/plugin.json .codex-plugin/plugin.json .pi-plugin/plugin.json gemini-extension.json .opencode/plugin.json | grep -c '0.3.0'
```

Expected: `0`.

- [ ] **Step 4: Confirm each manifest is still valid JSON**

Run:

```bash
for f in .claude-plugin/plugin.json .codex-plugin/plugin.json .pi-plugin/plugin.json gemini-extension.json .opencode/plugin.json; do
  python3 -c "import json; json.load(open('$f'))" && echo "OK: $f" || echo "FAIL: $f"
done
```

Expected: five `OK:` lines. If any reports `FAIL:`, the JSON was corrupted by the edit — re-do the relevant manifest edit.

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin/plugin.json .codex-plugin/plugin.json .pi-plugin/plugin.json gemini-extension.json .opencode/plugin.json
git commit -m "release: bump all manifests to v0.3.1 (plan-write premortem step)"
```

---

## Post-implementation verification (no commit; run before review-pack)

These items implement the spec's Testing section. They are not separate plan tasks because they produce no commits — they're verification activities.

1. **Static check on the canonical SKILL.md.** Re-read `skills/plan-write/SKILL.md` end-to-end and confirm: `## Premortem` section is between `## Self-review` and `## Anti-patterns`; defines all four categories per the spec's Approach; includes the `BLOCKING RISK` label rule; includes the anti-patterns block; the plan-document-header template shows the `## Premortem` placeholder.

2. **Live eval pair.** Per `AGENTS.md`'s eval workflow, dispatch `plan-write` against a deliberately-flawed spec under `tests/eval/<run-id>/` (control: pre-change skill body via git stash; treatment: post-change). Pass criterion: treatment plan contains a non-`none` premortem bullet for at least one of the seeded flaws; control plan does not.

3. **Self-consistency check.** Pick one existing plan from `docs/plans/`, manually run the four-category sweep against it as if `plan-write` had emitted the section, confirm at least one category produces a substantive bullet (not all four `none`), each `none — <reason>` is specific.
