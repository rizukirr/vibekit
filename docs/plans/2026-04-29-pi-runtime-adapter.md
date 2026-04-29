# Pi Runtime Adapter Implementation Plan

> **For executing agents:** implement this plan task-by-task. Each step uses checkbox (`- [ ]`) syntax. Do not skip steps. Do not batch commits across tasks.

**Goal:** Add pi (`@mariozechner/pi-coding-agent` from `badlogic/pi-mono`) as a fifth supported runtime for vibekit, delivering all 14 skills, the `/vibe` slash command, and using-vibekit priming via a small TypeScript pi-extension — without modifying any skill content.

**Architecture:** A new `.pi-plugin/` directory at the repo root holds pi-specific artifacts (manifest, prompts, extensions). Pi consumes the canonical `skills/` directory unchanged via a `pi` key in `package.json`. A pi extension registers a `before_agent_start` handler that reads `skills/using-vibekit/SKILL.md` once at load and appends it to the system prompt every turn. Cross-runtime parity is enforced by extending `vibekit-doctor` with three new checks before any artifact is created (TDD-shaped).

**Tech stack:** TypeScript (loaded by pi via jiti, no build step), JSON manifests, Markdown for prompts and docs. Existing vibekit conventions: `docs/specs/`, `docs/plans/`, `docs/verifications/`.

---

## File structure

**New:**
- `.pi-plugin/plugin.json` — internal manifest for parity checks
- `.pi-plugin/prompts/vibe.md` — `/vibe` slash command for pi (pi reads `$ARGUMENTS` natively)
- `.pi-plugin/extensions/vibekit-prime.ts` — priming injector via `before_agent_start`
- `docs/INSTALL.pi.md` — install instructions for pi users
- `docs/verifications/2026-04-29-pi-runtime-adapter.md` — final verification report (Task 10)

**Modified:**
- `package.json` — add `pi` key + `pi-package` to `keywords`
- `README.md` — add Pi install subsection, bump runtime count from four to five
- `AGENTS.md` — add `.pi-plugin/` to cross-runtime trigger list; bump runtime count language if any
- `skills/vibekit-doctor/SKILL.md` — add `.pi-plugin/plugin.json` to C3 required list; add three new checks C11–C13

**Reference (read-only, do not edit):**
- `commands/vibe.md` — source of truth for the `/vibe` body and `[N/7]` stage list
- `skills/using-vibekit/SKILL.md` — source of truth for priming body
- `external/pi-mono/packages/coding-agent/docs/extensions.md` — pi extension API
- `external/pi-mono/packages/coding-agent/docs/prompt-templates.md` — pi prompt syntax (`$ARGUMENTS` / `$1`)

---

## Task 1: Extend vibekit-doctor with pi-parity checks → verify: `skills/vibekit-doctor/SKILL.md` contains literal strings `pi-manifest-present`, `pi-extension-canonical-source`, `pi-prompt-stages-match`, and `.pi-plugin/plugin.json` appears in the C3 required-manifests list.

**Files:**
- Modify: `skills/vibekit-doctor/SKILL.md` (C3 required list, and new C11/C12/C13 sections)

- [x] **Step 1: Add `.pi-plugin/plugin.json` to C3 required list**

In `skills/vibekit-doctor/SKILL.md`, locate the `### C3 — Plugin manifest presence` section. Insert `.pi-plugin/plugin.json` into the **Required (committed to the repo)** bullet list, between `.codex-plugin/plugin.json` and `gemini-extension.json`:

```markdown
**Required (committed to the repo):**
- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `.codex-plugin/plugin.json`
- `.pi-plugin/plugin.json`
- `gemini-extension.json`
- `AGENTS.md`
- `.opencode/plugins/vibekit.js`
```

- [x] **Step 2: Add three new checks C11, C12, C13**

In `skills/vibekit-doctor/SKILL.md`, after the `### C10 — Git state` section and before the `## Discipline rules` heading, insert exactly:

````markdown
### C11 — pi-manifest-present

Existence and shape:
- `.pi-plugin/plugin.json` exists, parses as JSON, and contains keys `name`, `description`, `version`.
- `package.json` contains a top-level `pi` key (an object with at least `skills`, `prompts`, `extensions` arrays).

`critical` if either file is missing or malformed. `warn` if `package.json`'s `pi` key is missing required sub-keys.

### C12 — pi-extension-canonical-source

Drift guard for the pi priming extension:
- `.pi-plugin/extensions/vibekit-prime.ts` exists.
- The file contains the literal string `skills/using-vibekit/SKILL.md` (the canonical priming source path).

`critical` if the file is missing. `warn` if the file exists but the literal is absent — a sign the extension has been refactored to read from a different (potentially stale) source.

### C13 — pi-prompt-stages-match

Stage-list parity between the Claude/OpenCode `/vibe` command and the pi `/vibe` prompt:
- Extract every `[N/7]` token (e.g., `[1/7]`, `[2/7]` … `[7/7]`) from `commands/vibe.md`.
- Extract every `[N/7]` token from `.pi-plugin/prompts/vibe.md`.
- Both files must produce the identical set `{[1/7], [2/7], [3/7], [4/7], [5/7], [6/7], [7/7]}`.

`critical` if either file is missing. `warn` on any set mismatch (drift in pipeline-stage labeling between runtimes).
````

- [x] **Step 3: Verify the edit landed**

Run:
```bash
grep -c "pi-manifest-present\|pi-extension-canonical-source\|pi-prompt-stages-match" skills/vibekit-doctor/SKILL.md
```
Expected: `3` (each literal appears at least once).

Run:
```bash
grep -c "\.pi-plugin/plugin\.json" skills/vibekit-doctor/SKILL.md
```
Expected: `>= 1` (the C3 list entry; C11 also references it, so likely `2`).

- [x] **Step 4: Commit**

```bash
git add skills/vibekit-doctor/SKILL.md
git commit -m "doctor: add C11-C13 pi-parity checks"
```

---

## Task 2: Create `.pi-plugin/plugin.json` → verify: file exists, parses as JSON, has `name=vibekit`, `version=0.2.1`, `description` matching `.claude-plugin/plugin.json`.

**Files:**
- Create: `.pi-plugin/plugin.json`

- [x] **Step 1: Confirm canonical description from `.claude-plugin/plugin.json`**

Run:
```bash
jq -r '.description' .claude-plugin/plugin.json
```
Expected: `Token-efficient vibe-coding pipeline with hard guardrails: brainstorm, plan, isolate, exec, verify, review, integrate. Halts on 'Expected' mismatches instead of committing bad work.`

The new `.pi-plugin/plugin.json` will use the *shorter* description already used by `.opencode/plugin.json` and `gemini-extension.json` for parity (the long Claude-marketplace description is the marketplace-specific variant). Confirm with:
```bash
jq -r '.description' .opencode/plugin.json
```
Expected: `Token-efficient vibe-coding pipeline with hard guardrails: brainstorm, plan, isolate, exec, verify, review, integrate.`

- [x] **Step 2: Create the file**

Write `.pi-plugin/plugin.json` with exactly:

```json
{
  "name": "vibekit",
  "description": "Token-efficient vibe-coding pipeline with hard guardrails: brainstorm, plan, isolate, exec, verify, review, integrate.",
  "version": "0.2.1"
}
```

- [x] **Step 3: Verify shape**

Run:
```bash
jq '.name, .version, (.description | length > 20)' .pi-plugin/plugin.json
```
Expected output (each on its own line):
```
"vibekit"
"0.2.1"
true
```

Run:
```bash
diff <(jq -r '.description' .pi-plugin/plugin.json) <(jq -r '.description' .opencode/plugin.json)
```
Expected: no output (descriptions identical to opencode's).

- [x] **Step 4: Commit**

```bash
git add .pi-plugin/plugin.json
git commit -m "pi: add internal plugin manifest"
```

---

## Task 3: Create `.pi-plugin/extensions/vibekit-prime.ts` → verify: file exists, contains literal `skills/using-vibekit/SKILL.md`, default-exports an async function, registers `before_agent_start` handler.

**Files:**
- Create: `.pi-plugin/extensions/vibekit-prime.ts`

- [x] **Step 1: Create the extension file**

Write `.pi-plugin/extensions/vibekit-prime.ts` with exactly:

```typescript
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const SKILL_RELATIVE_PATH = "skills/using-vibekit/SKILL.md";

export default async function (pi: ExtensionAPI) {
  const here = dirname(fileURLToPath(import.meta.url));
  const skillPath = resolve(here, "..", "..", SKILL_RELATIVE_PATH);
  const skillBody = await readFile(skillPath, "utf8");

  const framed = `<EXTREMELY_IMPORTANT>\nYou have vibekit.\n\n**Below is the full content of the 'vibekit:using-vibekit' skill — your introduction to vibekit's auto-trigger discipline. For all other skills, use the 'Skill' tool:**\n\n${skillBody}\n</EXTREMELY_IMPORTANT>`;

  pi.on("before_agent_start", async (event) => {
    return { systemPrompt: `${event.systemPrompt}\n\n${framed}` };
  });
}
```

- [x] **Step 2: Verify the canonical-source literal is present**

Run:
```bash
grep -c "skills/using-vibekit/SKILL\.md" .pi-plugin/extensions/vibekit-prime.ts
```
Expected: `>= 1` (the `SKILL_RELATIVE_PATH` constant).

Run:
```bash
grep -c "before_agent_start" .pi-plugin/extensions/vibekit-prime.ts
```
Expected: `>= 1`.

Run:
```bash
grep -c "export default async function" .pi-plugin/extensions/vibekit-prime.ts
```
Expected: `1`.

- [x] **Step 3: Verify the path resolution would land on the canonical file**

The extension lives at `.pi-plugin/extensions/vibekit-prime.ts`. Resolution: `dirname(import.meta.url)` → `<repo>/.pi-plugin/extensions/`, `../../skills/using-vibekit/SKILL.md` → `<repo>/skills/using-vibekit/SKILL.md`. Confirm the target exists:

```bash
ls -la skills/using-vibekit/SKILL.md
```
Expected: file exists, non-empty.

- [x] **Step 4: Commit**

```bash
git add .pi-plugin/extensions/vibekit-prime.ts
git commit -m "pi: add vibekit-prime extension for using-vibekit injection"
```

---

## Task 4: Create `.pi-plugin/prompts/vibe.md` → verify: file exists, contains all seven `[N/7]` stage tokens matching `commands/vibe.md`, has `description` frontmatter.

**Files:**
- Create: `.pi-plugin/prompts/vibe.md`

- [x] **Step 1: Confirm pi accepts the same `$ARGUMENTS` syntax**

Already confirmed against `external/pi-mono/packages/coding-agent/docs/prompt-templates.md`: pi supports `$ARGUMENTS`, `$@`, `$1` … `$N`. The Claude Code body in `commands/vibe.md` uses `$ARGUMENTS`, which works in pi unchanged.

- [x] **Step 2: Create the prompt file**

Write `.pi-plugin/prompts/vibe.md` with exactly:

```markdown
---
description: Run the full vibe pipeline on a short intent — brainstorm, plan, exec, verify, review, integrate.
argument-hint: "<intent, e.g. \"add a dark mode toggle\">"
---

Invoke the `vibe` skill with the user's intent as input.

**User intent:** $ARGUMENTS

Follow the vibe skill's 7-stage pipeline exactly:

1. `[1/7] brainstorm` — invoke `brainstorm-lean` with the intent above. Wait for the user to answer clarifying questions and approve the spec.
2. `[2/7] plan` — invoke `plan-write` against the approved spec.
3. `[3/7] confirm execution mode` — ask the user: subagent-driven (recommended) or inline.
4. `[4/7] isolate` — invoke `isolate` to create a dedicated worktree or branch.
5. `[5/7] exec` — invoke `exec-dispatch` to run the plan task-by-task.
6. `[6/7] verify` — invoke `verify-gate` to confirm the work satisfies the spec.
7. `[7/7] result` — surface the final message from `vibe`.

Between stages, check the hard gates described in the `vibe` skill. Halt on any gate failure and offer the user concrete remedies. Do not auto-retry.

Never auto-merge, auto-push, or auto-PR. After `vibe: ready`, the user decides whether to run `review-pack` + `finish-branch`.

If the user's intent is missing or empty, do not start the pipeline. Ask for the intent in one sentence.
```

- [x] **Step 3: Verify stage-list parity with `commands/vibe.md`**

Run:
```bash
diff <(grep -oE '\[[0-9]+/7\]' commands/vibe.md | sort -u) <(grep -oE '\[[0-9]+/7\]' .pi-plugin/prompts/vibe.md | sort -u)
```
Expected: no output (sets identical: `[1/7]` … `[7/7]`).

Run:
```bash
grep -c '^description:' .pi-plugin/prompts/vibe.md
```
Expected: `1`.

Run:
```bash
grep -c '\$ARGUMENTS' .pi-plugin/prompts/vibe.md
```
Expected: `1`.

- [x] **Step 4: Commit**

```bash
git add .pi-plugin/prompts/vibe.md
git commit -m "pi: add /vibe prompt template"
```

---

## Task 5: Update `package.json` with `pi` key and keyword → verify: `package.json` has `pi.skills`, `pi.prompts`, `pi.extensions` arrays and `keywords` includes `"pi-package"`.

**Files:**
- Modify: `package.json`

- [x] **Step 1: Read current package.json**

Run:
```bash
cat package.json
```
Expected current content:
```json
{
  "name": "vibekit",
  "version": "0.2.1",
  "type": "module",
  "main": ".opencode/plugins/vibekit.js"
}
```

- [x] **Step 2: Rewrite `package.json` with the new keys**

Write `package.json` with exactly:

```json
{
  "name": "vibekit",
  "version": "0.2.1",
  "type": "module",
  "main": ".opencode/plugins/vibekit.js",
  "keywords": ["pi-package"],
  "pi": {
    "skills": ["./skills"],
    "prompts": ["./.pi-plugin/prompts"],
    "extensions": ["./.pi-plugin/extensions"]
  }
}
```

- [x] **Step 3: Verify shape**

Run:
```bash
jq '.pi.skills, .pi.prompts, .pi.extensions, .keywords' package.json
```
Expected output:
```
[
  "./skills"
]
[
  "./.pi-plugin/prompts"
]
[
  "./.pi-plugin/extensions"
]
[
  "pi-package"
]
```

Run:
```bash
jq '.name, .version' package.json
```
Expected:
```
"vibekit"
"0.2.1"
```

- [x] **Step 4: Commit**

```bash
git add package.json
git commit -m "pi: register vibekit as a pi package via package.json pi key"
```

---

## Task 6: Run vibekit-doctor against the repo → verify: doctor reports no `critical` rows and C11/C12/C13 are all `ok`. The two known-environmental warns C4 (`docs/reviews/`/`docs/verifications/` missing — Task 10 creates the latter; `docs/reviews/` is out of scope) and C7 (`external/` absent in the worktree because git worktrees do not check out gitignored content) are explicitly accepted and do not fail this gate.

**Files:**
- Read-only: `skills/vibekit-doctor/SKILL.md`, all artifacts created in Tasks 1–5.

This task has no code edits — it executes the doctor as a verification step. The executing agent invokes the `vibekit-doctor` skill in `check` mode and inspects the YAML report.

- [x] **Step 1: Invoke vibekit-doctor**

Use the `Skill` tool to invoke `vibekit:vibekit-doctor` with arg `check`. The skill produces a YAML report.

- [x] **Step 2: Confirm verdict**

Inspect the returned YAML. Expected:
- `verdict: ok` (or at worst `warn` with only `info`-level rows about optional gitignored files like `CLAUDE.md` / `GEMINI.md`).
- The three new check rows `C11 pi-manifest-present`, `C12 pi-extension-canonical-source`, `C13 pi-prompt-stages-match` all show `status: ok`.
- No row references missing `.pi-plugin/` files.

If `verdict` is `critical` or any C11–C13 row is non-`ok`, halt. Re-read the failing row's `evidence`, fix the artifact, return to Task 6 Step 1.

- [x] **Step 3: Commit doctor evidence**

If the doctor introduced any auto-fixed `docs/` subdirs as side effect (it shouldn't here), commit them:

```bash
git status --short
```
Expected: clean working tree (no changes since Task 5's commit).

If clean, no commit needed. Move to Task 7.

---

## Task 7: Create `docs/INSTALL.pi.md` → verify: file exists, mentions `pi install`, `git:github.com/rizukirr/vibekit`, `pi list`, `/vibe`, and a troubleshooting section.

**Files:**
- Create: `docs/INSTALL.pi.md`

- [ ] **Step 1: Read existing install docs as templates**

Run:
```bash
cat .opencode/INSTALL.md
```

Use the structure (numbered steps, verify section, troubleshooting) as the template.

- [ ] **Step 2: Create the install doc**

Write `docs/INSTALL.pi.md` with exactly:

```markdown
# Installing Vibekit for Pi

Enable vibekit skills, the `/vibe` slash command, and using-vibekit priming inside the [pi coding agent](https://github.com/badlogic/pi-mono).

## Prerequisites

- `@mariozechner/pi-coding-agent` installed globally:
  ```bash
  npm install -g @mariozechner/pi-coding-agent
  ```
- An API key or subscription configured for pi (`/login` or env var). See [pi's README](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md#providers--models).

## Install

Install vibekit as a pi package directly from the git repo:

```bash
pi install git:github.com/rizukirr/vibekit
```

For project-local installs (vibekit lives only inside the current project's `.pi/`), add `-l`:

```bash
pi install git:github.com/rizukirr/vibekit -l
```

Pi reads vibekit's `package.json` `pi` key and registers:

- All 14 skills under `skills/` (auto-discovered via the `pi.skills` path).
- The `/vibe` slash command from `.pi-plugin/prompts/vibe.md`.
- The `vibekit-prime` extension from `.pi-plugin/extensions/vibekit-prime.ts`, which injects the using-vibekit priming body into every agent turn's system prompt.

## Verify

1. Confirm vibekit is registered:

   ```bash
   pi list
   ```

   Expected: `vibekit` appears in the installed-packages list.

2. Start pi and confirm `/vibe` is available:

   ```bash
   pi
   ```

   In the editor, type `/vibe` — autocomplete should show the entry with the description "Run the full vibe pipeline on a short intent…".

3. (Optional) Confirm priming reaches the system prompt. Inside pi, run `/settings` or use a debug extension that calls `ctx.getSystemPrompt()`. The string `<EXTREMELY_IMPORTANT>\nYou have vibekit.` should appear in the system prompt.

## Troubleshooting

If `/vibe` does not appear in autocomplete or skills do not load:

1. Confirm the package installed cleanly:

   ```bash
   pi list
   ```

2. Update vibekit and pi together:

   ```bash
   pi update
   ```

3. Clear the pi package cache and reinstall:

   ```bash
   rm -rf ~/.pi/agent/git/github.com/rizukirr/vibekit
   pi install git:github.com/rizukirr/vibekit
   ```

4. If priming is missing from the system prompt, confirm the extension loaded:

   ```bash
   pi --verbose
   ```

   Expected: `vibekit-prime` appears in the extension-load log without errors.

## Uninstall

```bash
pi remove git:github.com/rizukirr/vibekit
```
```

- [ ] **Step 3: Verify required content tokens**

Run:
```bash
grep -c "pi install\|git:github.com/rizukirr/vibekit\|pi list\|/vibe\|Troubleshooting" docs/INSTALL.pi.md
```
Expected: `>= 5` (each token appears at least once).

- [ ] **Step 4: Commit**

```bash
git add docs/INSTALL.pi.md
git commit -m "pi: add install docs"
```

---

## Task 8: Update README.md with Pi install section and bumped runtime count → verify: README contains `## Pi` (or equivalent) install heading pointing at `docs/INSTALL.pi.md` and the supported-runtimes line lists pi.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Locate the runtimes line and existing install sections**

Run:
```bash
grep -n -E "Claude Code, OpenAI Codex|### OpenCode|### OpenAI Codex|### Gemini CLI" README.md
```
Note line numbers for the supported-runtimes sentence and the install-section anchors.

- [ ] **Step 2: Bump the supported-runtimes sentence**

Find the line near the top of `README.md` that reads:
```
Vibekit is a discipline-first vibe-coding plugin for Claude Code, OpenAI Codex, OpenCode, and Gemini CLI.
```

Replace it with:
```
Vibekit is a discipline-first vibe-coding plugin for Claude Code, OpenAI Codex, OpenCode, Gemini CLI, and Pi.
```

- [ ] **Step 3: Add a Pi install subsection**

After the existing `### Gemini CLI` install subsection (the one pointing at `INSTALL.gemini.md`), add a new subsection `### Pi` with content:

```markdown
### Pi

Tell Pi:

> Fetch and follow instructions from https://raw.githubusercontent.com/rizukirr/vibekit/refs/heads/main/docs/INSTALL.pi.md

Manual installation is also documented in `docs/INSTALL.pi.md`. Quick path:

```bash
npm install -g @mariozechner/pi-coding-agent
pi install git:github.com/rizukirr/vibekit
```
```

- [ ] **Step 4: Verify the edits landed**

Run:
```bash
grep -c "Claude Code, OpenAI Codex, OpenCode, Gemini CLI, and Pi" README.md
```
Expected: `1`.

Run:
```bash
grep -c "### Pi" README.md
```
Expected: `>= 1`.

Run:
```bash
grep -c "docs/INSTALL.pi.md" README.md
```
Expected: `>= 1`.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs(readme): add Pi install section, bump runtime count to five"
```

---

## Task 9: Update AGENTS.md cross-runtime trigger list → verify: AGENTS.md mentions `.pi-plugin/` in the cross-runtime-changes context, and skill-count language remains accurate.

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Locate the cross-runtime trigger context**

Run:
```bash
grep -n -E "cross-runtime|\.opencode|\.codex-plugin|\.claude-plugin|hooks/|GEMINI\.md" AGENTS.md
```

Note the section that lists the directories whose edits trigger cross-runtime verification (this exists in the `## Cross-runtime changes` discussion or equivalent — adapt to whatever AGENTS.md actually reads; do not invent a section name).

- [ ] **Step 2: Add `.pi-plugin/` to the trigger list**

In the section that enumerates the runtime-adapter directories whose changes require multi-runtime verification, add `.pi-plugin/` alongside the existing entries (`.claude-plugin/`, `.codex-plugin/`, `.opencode/`, `gemini-extension.json`, `hooks/`). Maintain alphabetical or grouped order as the existing list dictates.

- [ ] **Step 3: Verify skill count language is unchanged**

The skill count in AGENTS.md (`vibekit is an N-skill plugin`) MUST stay accurate. Run:
```bash
ls -d skills/*/ | grep -v '_authoring' | wc -l
```
Note the number. Then:
```bash
grep -oE "[0-9]+-skill plugin|skill plugin" AGENTS.md
```
If the count differs, halt — that is a separate defect, not part of this task. Otherwise no edit needed.

- [ ] **Step 4: Verify edit landed**

Run:
```bash
grep -c "\.pi-plugin/" AGENTS.md
```
Expected: `>= 1`.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): add .pi-plugin/ to cross-runtime trigger list"
```

---

## Task 10: Final verify-gate — full doctor run + spec coverage check → verify: `vibekit-doctor check --strict` returns no `critical` rows other than the explicitly-accepted environmental warns (C4: `docs/reviews/` only — `docs/verifications/` will exist after Step 1; C7: `external/` absent because gitignored content is not checked out into worktrees); C11/C12/C13 are `ok`; every "Goals" bullet from the spec maps to a delivered artifact.

**Files:**
- Read-only: all of the above.

- [ ] **Step 1: Run vibekit-doctor in strict mode**

Invoke the `vibekit:vibekit-doctor` skill with `check --strict`. Strict mode escalates `warn` to `critical` for verdict purposes. Capture the YAML report verbatim into `docs/verifications/2026-04-29-pi-runtime-adapter.md` (create the file).

Expected: `verdict: ok` OR `verdict: critical` strictly limited to C4 (`docs/reviews/` only — `docs/verifications/` will exist after this step writes the report) and C7 (`external/` absent in worktree — environmental, see Task 6 verify clause). Any other `critical`, or any non-`ok` on C11/C12/C13, halts.

- [ ] **Step 2: Spec-coverage cross-check**

Open `docs/specs/2026-04-29-pi-runtime-adapter-design.md`. For each bullet under `## Goals`, list the artifact(s) that satisfy it:

| Spec goal | Delivered by |
|---|---|
| `pi install git:…` works end-to-end | Task 5 (package.json `pi` key), Task 7 (INSTALL.pi.md) |
| `/vibe <intent>` works in pi | Task 4 (`.pi-plugin/prompts/vibe.md`), Task 5 (manifest mapping) |
| using-vibekit priming reaches every turn | Task 3 (`.pi-plugin/extensions/vibekit-prime.ts`) |
| Cross-runtime parity holds, doctor clean | Task 1 (C11–C13), Task 2 (manifest), Task 6 + Task 10 (doctor runs) |
| No skill content edited | Verified by `git diff main -- skills/` showing only `skills/vibekit-doctor/SKILL.md` changed |

Run:
```bash
git diff --name-only main -- skills/ | grep -v 'skills/vibekit-doctor'
```
Expected: no output (only `vibekit-doctor` SKILL.md was edited; the 14 functional skills are untouched).

- [ ] **Step 3: Append verification report**

Write the doctor's full YAML report and the spec-coverage table to `docs/verifications/2026-04-29-pi-runtime-adapter.md` with frontmatter:

```markdown
---
title: pi-runtime-adapter verification
date: 2026-04-29
plan: docs/plans/2026-04-29-pi-runtime-adapter.md
spec: docs/specs/2026-04-29-pi-runtime-adapter-design.md
verdict: <fill from doctor>
---

# Verification — pi-runtime-adapter

## vibekit-doctor (strict)

```yaml
<paste full doctor YAML report here>
```

## Spec coverage

<paste table from Step 2>

## Untouched skills (evidence)

`git diff --name-only main -- skills/` returned only `skills/vibekit-doctor/SKILL.md`. All 14 functional skills unchanged.
```

- [ ] **Step 4: Commit verification**

```bash
git add docs/verifications/2026-04-29-pi-runtime-adapter.md
git commit -m "verify: pi-runtime-adapter — doctor strict ok, spec coverage complete"
```

---

## Out of scope (explicit deferrals)

- **Live pi run.** The plan stops at static verification (doctor + spec coverage). A live `pi install` against a throwaway repo under `tests/eval/` is a manual ship-readiness step described in the spec's `## Testing` section. It is performed by the human reviewer before merging or shipping; it is NOT a task in this plan because it requires an external runtime install.
- **Cursor adapter.** Tracked in CLAUDE.md "Things that are not yet supported."
- **npm publication.** Distribution stays git-only at version 0.2.1.
