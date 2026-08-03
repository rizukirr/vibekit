# Verification Report — vibekit v2 architecture

**Date:** 2026-08-03
**Spec:** docs/specs/2026-08-03-vibekit-v2-architecture-design.md
**Plan:** docs/plans/2026-08-03-vibekit-v2-architecture.md
**Commit verified:** 0818637 (branch `vibe/vibekit-v2-architecture`, base `v2`@0272053)

**Rigor:** critical-requirements-only three-pass, chosen by the user. Seven
requirements received three independent passes; nine received a single pass and
are marked `[single-pass]` below — weaker evidence, but a single-pass `no` or
`partial` still blocks the verdict.

## Repo-level checks

- Tests: **pass** — `npm test` → exit 0

  ```
  ℹ tests 59
  ℹ suites 0
  ℹ pass 59
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 258.279087
  ```

- Drift check / build: **pass** — `npm run check` → exit 0

  ```
  npm notice run @rizukirr/vibekit@2.0.0 check
  npm notice run node bin/generate.mjs --check
  up to date
  ```

- Hook smoke test: **pass** — `npm run check:hook` → exit 0

  ```
  ✔ emits Claude Code shaped context containing the bootstrap skill (16.824677ms)
  ✔ emits the SDK-standard shape when no platform variable is set (12.507912ms)
  ℹ tests 2
  ℹ suites 0
  ℹ pass 2
  ℹ fail 0
  ```

- Type checker: N/A — no TypeScript in this repo.
- Linter: N/A — none configured (zero dependencies).

- `git status --porcelain`:

  ```
  ```
  (empty)

- `git log --oneline 0272053..HEAD`:

  ```
  0818637 chore: complete Task 12 — CI wiring
  2a9c820 ci: run drift check, unit tests, and two-OS hook smoke test
  10f3e00 chore: complete Task 11 — SessionStart hook
  76e964e feat: add SessionStart hook and polyglot windows wrapper
  18cd017 chore: complete Task 10 — Generator CLI and first generation
  f8fa402 feat: add generator CLI and commit first generated output
  763975b chore: complete Task 9 — Driver core
  a36aec3 feat: add driver core with collision detection and drift planning
  f85fd06 chore: complete parallel-group emitters
  0713022 feat: add codex emitter
  3f3edb0 feat: add claude-code emitter
  97425c0 feat: add core emitter for package.json and README skill list
  73bd328 chore: complete Task 5 — Shared table rendering
  bf9353e feat: add shared trigger-table and skill-list renderers
  650b691 chore: complete Task 4 — Marker regions
  4e932c0 feat: add marker-region replacement for mixed markdown files
  a2db88f chore: complete Task 3 — Skill discovery and validation
  c14f904 feat: discover and validate skills into a single model
  cf42ee2 chore: complete Task 2 — Frontmatter parser
  83cc8d2 feat: add restricted-subset frontmatter parser
  1e0eab7 chore: complete Task 1 — Repo skeleton and config
  ec03681 feat: repo skeleton, config, and three fixture skills
  ```

- Surgical-diff pass: **clean** — zero orphans across all 40 changed files.

## Requirements

### R1. "Adding a skill touches exactly one directory and nothing else in the repo."
- Passes: partial / no / partial
- Verdict: **disagreement: escalate**
- Evidence:
  - `lib/model.mjs:14` — discovery is a glob, not a list:
    ```
    const dirs = readdirSync(skillsDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
    ```
  - `package.json` `files` names directories only:
    `[".claude-plugin/", ".codex-plugin/", "commands/", "hooks/", "skills/", "AGENTS.md", "CLAUDE.md", "LICENSE", "README.md"]`
  - Live probe — one directory created, nothing else hand-edited:
    ```
    $ npm run check
    generated files are out of date:
      stale: README.md
      stale: CLAUDE.md
      stale: AGENTS.md
    run: npm run generate
    (exit 1)
    $ npm run generate
    $ git status --porcelain
     M AGENTS.md
     M CLAUDE.md
     M README.md
    ?? skills/probe-verify/
    ```
- See §Disagreements.

### R2. "Adding a runtime is one emitter file plus one config entry — no change to the generator core, no change to any skill."
- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence:
  - `lib/build.mjs:62-69` — emitters resolved by name from config, no per-runtime branching:
    ```
    for (const id of ['core', ...config.runtimes]) {
      module = await import(new URL(`../runtimes/${id}.mjs`, import.meta.url))
      if (module.id !== id) throw new Error(`runtimes/${id}.mjs exports id '${module.id}'`)
    ```
  - `vibekit.config.json`: `"runtimes": ["claude-code", "codex"],`
  - Tests: `✔ loads core plus every configured runtime, in that order`, `✔ throws when the config names an emitter that does not exist`, `✔ throws naming both emitters when two claim the same path`
  - Both runtime emitters were authored concurrently against the interface with zero changes to `lib/build.mjs` (commits 3f3edb0, 0713022).

### R3. "Every derived surface (manifests, trigger tables, command files, version fields) is generated from a single source and verified in CI."
- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence:
  - `.vibekit-manifest` lists every generated path (10 entries).
  - Version stamping across all three manifests: `version ok: 2.0.0`
  - `.github/workflows/ci.yml:27` — `run: npm run check`
  - Generated `CLAUDE.md` region:
    ```
    | Trigger condition | Skill | Gate |
    |---|---|---|
    | Never — this is a build fixture | `example-command` | none |
    | Never — this is a build fixture | `example-plain` | hard |
    | Session start | `using-vibekit` | none |
    ```

### R4. "Zero dependencies — runtime and development both. Bare Node and bash only."
- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence:
  - `deps: {} devDeps: {}` — package.json declares neither key.
  - `ls node_modules` → `no node_modules`; `ls package-lock.json` → `no lockfile`
  - Test runner is built-in `node:test` / `node:assert/strict`.
  - Test: `✔ no dependency install step is needed`

### R5. "Committed generated output, so installing the plugin never requires a build." `[single-pass]`
- Verdict: **satisfied**
- Evidence: all generated paths tracked by `git ls-files`; `npm run check` → `up to date`; package.json declares no `prepare`/`prepublish`/`prepack`/`postinstall` script.

### R6. "Verification is one command."
- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence:
  - `"check": "node bin/generate.mjs --check"` — validation runs inside generation, so one command covers frontmatter validity, name/directory match, gate values, missing SKILL.md, unknown emitters, path collisions and marker balance.
  - v1's six check scripts (check:json, check:versions, check:manifests, check:skills, check:code, check:pack) have no successor.
  - All three passes read the requirement in its stated context — the validation surface — and noted `npm test` / `check:hook` are test execution rather than validity checking.

### N1. "The pipeline redesign... This spec delivers only the machinery." `[single-pass]`
- Verdict: **satisfied** (correctly not delivered)
- Evidence: `skills/` contains exactly example-command, example-plain, using-vibekit. None of v1's 16 pipeline skills exists.

### N2. "Runtimes beyond Claude Code and Codex... none are written here."
- Passes: yes / yes / yes
- Verdict: **satisfied** (correctly not delivered)
- Evidence: `runtimes/` = `claude-code.mjs`, `codex.mjs`, `core.mjs`. No `.opencode/`, `.cursor-plugin/`, `.pi/`, `gemini-extension.json`, or Antigravity artifact anywhere in the tracked tree.

### N3. "Per-skill runtime scoping." `[single-pass]`
- Verdict: **satisfied** (correctly not delivered)
- Evidence: `grep -rn "runtimes" skills/ lib/model.mjs` → no matches. Model fields are exactly name, description, trigger, command, gate, dir.

### N4. "Any include or expansion mechanism for shared skill prose." `[single-pass]`
- Verdict: **satisfied** (correctly not delivered)
- Evidence: no include/expansion machinery in lib/, bin/ or runtimes/. `skills/_shared/` does not exist, as the spec's premortem intended.

### C1. "Dependency free. The reference repositories in `external/` are read for ideas only." `[single-pass]`
- Verdict: **satisfied**
- Evidence: no deps/devDeps, no lockfile, `external/` gitignored, no source file imports from it.

### C2. "Node 24+ (already the CI baseline; needed for type-stripping in checks)." `[single-pass]`
- Verdict: **partial**
- Reason: CI pins `node-version: '24'` in both jobs, but `package.json` declares no `engines` field, so the constraint is unenforced for consumers installing from npm. Local runs used Node v26.4.0; Node 24 itself was never exercised.
- Evidence: `grep -n "engines" package.json` → `(no engines field declared)`

### C3. "Must work on Windows — the SessionStart hook is the entire integration, and its polyglot batch half can only be verified on a Windows runner." `[single-pass]`
- Verdict: **partial**
- Reason: the `windows-latest` matrix leg is configured but has never executed. The branch has never been pushed, so CI has not run at all against this work.
- Evidence:
  - `.github/workflows/ci.yml` defines `matrix: os: [ubuntu-latest, windows-latest]` running `npm run check:hook`.
  - `hooks/run-hook.cmd` committed with mode 100755, byte-identical to the plan's polyglot block.
  - Remote branches present: `main`, `exec-dispatch-defers`, `remove-duplicate-plugin-tree`, `windows-polyglot-hook`. `vibe/vibekit-v2-architecture` is absent, as is `v2`.
- Proxy check available: push the branch and let the `hook (windows-latest)` job run; it is the only machine-executed proof of the batch half.

### C4. "Generated files are committed. A user installing... gets working output with no build step." `[single-pass]`
- Verdict: **satisfied**
- Evidence: same artifacts as R5, plus package.json `files` ships the generated directories.

### C5. "`external/` and `.vibe-worktrees/` stay gitignored. `docs/` is tracked." `[single-pass]`
- Verdict: **satisfied**
- Evidence: `.gitignore` contains exactly `external/` and `.vibe-worktrees/`; `git ls-files docs/` returns the spec and the plan.

## Disagreements

### R1 — "Adding a skill touches exactly one directory and nothing else in the repo."

- Pass 1: **partial** — "No hand edits outside skills/... but the probe shows adding a skill still mutates three tracked root files (README/CLAUDE/AGENTS) via npm run generate, so the requirement holds only under the hand-edited reading and fails under the literal all-changed-files reading."
- Pass 2: **no** — "Live probe shows adding one skill dir also leaves AGENTS.md, CLAUDE.md and README.md modified (and `npm run check` fails until `npm run generate` is run), so the commit touches four paths, not one directory — hand-edits are confined to one directory, but the requirement as written says nothing else in the repo changes."
- Pass 3: **partial** — "No hand-edits outside skills/ are needed... but the live probe shows adding a skill still leaves three tracked root files modified via a mandatory `npm run generate`, so the literal 'nothing else in the repo' claim holds only under a hand-edited-files reading."

**Action required.** The three passes agree on the facts and disagree on the wording. The engineering outcome is exactly what was designed — the author edits one directory, the machine updates the rest, and CI catches it if they forget. But the spec sentence says "nothing else in the repo," and three generated files do change. The user must decide:

1. Amend the spec sentence to say what was actually built, e.g. *"Adding a skill requires editing exactly one directory; every other affected file is regenerated by `npm run generate` and enforced by `npm run check`."* — then this requirement is satisfied as written.
2. Accept the requirement as satisfied under the hand-edited reading and record that interpretation.
3. Treat it as a genuine miss and change the design (no viable option exists that keeps static manifests and committed output).

## Overall verdict

**not ready**

Blockers:

- **R1** — three passes disagree (partial / no / partial). Spec wording ambiguity, not an implementation defect. Requires a user decision.
- **C2** — `partial`. `package.json` declares no `engines` field, so the documented Node 24+ constraint is unenforced for consumers.
- **C3** — `partial`. The Windows CI leg has never executed because the branch has never been pushed; the polyglot batch half is unverified on a real Windows runner.

Everything else passed, including all repo-level checks and a clean surgical-diff audit.

Suggested next step: resolve R1 by amending the spec sentence (option 1 above), add an `engines` field for C2, and push the branch so the `hook (windows-latest)` job supplies the missing C3 evidence. Then re-run verify-gate.
