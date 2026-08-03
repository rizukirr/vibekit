---
title: vibekit v2 architecture
date: 2026-08-03
status: draft
---

# vibekit v2 architecture — Design

## Problem

vibekit v1 (`@rizukirr/vibekit` 0.5.2) shipped 16 skills across five runtimes and
became hard to maintain. The cause was not the skills — it was that the *list* of
skills existed in many places at once.

Adding one skill in v1 required editing, by hand and in agreement with each other:

- `skills/<name>/SKILL.md`
- `package.json` → `files[]` (an explicit per-skill array)
- `CLAUDE.md` trigger table
- `AGENTS.md` trigger table
- `GEMINI.md`
- `README.md`
- `.opencode/commands/`
- `.pi-plugin/prompts/`
- `INSTALL.gemini.md`
- `plugins/vibekit/` — a full duplicate plugin tree

Six `check-*.mjs` scripts existed solely to detect when one of these fell out of
sync. They detected drift; they did not prevent it. The duplicate
`plugins/vibekit/` tree drifted anyway and sat at 12 of 16 skills.

The two pains that motivate this rewrite, in the maintainer's own ranking, are
**cross-runtime drift** and **registration duplication**. Both are the same
underlying defect: one fact stated in many places.

The repository was emptied (`d76a7b2 refactor: delete everything`) to rebuild
from a clean base. v1 remains available as reference in the installed plugin
cache; no v1 content is carried into v2.

## Goals

- Adding a skill touches exactly one directory and nothing else in the repo.
- Adding a runtime is one emitter file plus one config entry — no change to the
  generator core, no change to any skill.
- Every derived surface (manifests, trigger tables, command files, version
  fields) is generated from a single source and verified in CI.
- Zero dependencies — runtime and development both. Bare Node and bash only.
- Committed generated output, so installing the plugin never requires a build.
- Verification is one command.

## Non-goals

- **The pipeline redesign.** Which skills should exist and what each does is a
  separate spec, to be re-derived from the reference repositories in
  `external/`. This spec delivers only the machinery those skills are authored
  into.
- **Runtimes beyond Claude Code and Codex.** opencode, Cursor, Antigravity,
  Gemini and Pi are deliberately deferred. The emitter contract is designed for
  them; none are written here.
- **Per-skill runtime scoping.** Every skill goes to every runtime. No evidence
  yet that scoping is needed.
- **Any include or expansion mechanism for shared skill prose.** Skill content
  bloat was explicitly *not* selected as a pain point, and expanding includes
  would make `skills/` partly generated — recreating a two-tree problem to solve
  a problem that does not exist. Shared rules live in `skills/_shared/` as real
  files that skills link to.
- **Porting v1 skills forward.** Fixtures are written fresh as empty stubs.

## Constraints

- **Dependency free.** The reference repositories in `external/` are read for
  ideas only. Nothing depends on them, and no npm package is added.
- Node 24+ (already the CI baseline; needed for type-stripping in checks).
- Must work on Windows — the SessionStart hook is the entire integration, and
  its polyglot batch half can only be verified on a Windows runner.
- Generated files are committed. A user installing from the marketplace or from
  npm gets working output with no build step.
- `external/` and `.vibe-worktrees/` stay gitignored. `docs/` is tracked.

## Approach

### The single rule

Every file is either **hand-authored truth** or **generated**, never both — and
the few files that must mix carry explicit, marker-delimited generated regions.

```
vibekit.config.json        TRUTH — identity, version, runtime list, hook config
skills/<name>/SKILL.md     TRUTH — frontmatter (registration) + body (behavior)
skills/_shared/*.md        TRUTH — shared rules, stated once, linked by skills
docs/                      TRUTH — specs, plans, porting guide
bin/generate.mjs           TRUTH — driver
runtimes/*.mjs             TRUTH — one pure emitter per runtime
hooks/session-start        TRUTH — bootstrap injector
hooks/run-hook.cmd         TRUTH — polyglot wrapper

.claude-plugin/plugin.json       GENERATED
.claude-plugin/marketplace.json  GENERATED
.codex-plugin/plugin.json        GENERATED
commands/*                       GENERATED (.md for Claude Code, .toml for Codex)
hooks/hooks.json                 GENERATED
package.json                     GENERATED (files[], version, pi keys)
CLAUDE.md                        MIXED (generated trigger-table region)
AGENTS.md                        MIXED (generated trigger-table region)
README.md                        MIXED (generated skill-list region)
```

Three consequences are the whole point of the design:

**No skill is registered anywhere but its own directory.** The generator
discovers skills by globbing `skills/*/SKILL.md` and reading frontmatter. There
is no skill list in `vibekit.config.json`, no `files[]` to extend, no trigger
table to edit. The v1 failure mode is impossible because the list does not exist
in more than one place.

**No duplicate plugin tree.** v1's `plugins/vibekit/` has no successor. Every
runtime reads the one `skills/` directory.

**Mixed files are marker-delimited, not wholly generated.** Prose stays
authored; only the table inside the markers is owned by the machine:

```markdown
<!-- vibekit:generated:trigger-table -->
| Trigger condition | Skill |
|---|---|
| ...rows derived from every skill's frontmatter... |
<!-- /vibekit:generated -->
```

The driver replaces only the region between markers, and fails loudly on a
missing, duplicated, or unbalanced marker.

### Skill authoring contract

A skill is a directory containing `SKILL.md`. Its frontmatter is the complete
registration:

```yaml
---
name: verify-gate          # MUST equal the directory name
description: Use when...   # shown in runtime skill listings
trigger: About to claim work is done   # becomes one row in the trigger table
command: false             # true → also emit a slash command for this skill
gate: hard                 # hard | soft | none — drives the "hard gates" section
---
```

`name`, `description`, and `trigger` are required. `command` defaults to
`false`; `gate` defaults to `none`. Everything else about a skill is body prose.

Adding a skill is: create the directory, write frontmatter, write the body, run
`generate`. No other file in the repository is edited by hand.

### Emitter contract

Each runtime is one ES module in `runtimes/`:

```js
export const id = 'codex'

export function emit(model) {
  // model = {
  //   config,                       // parsed vibekit.config.json
  //   skills: [                     // sorted by name, from skills/*/SKILL.md
  //     { name, description, trigger, command, gate, dir }
  //   ]
  // }
  return {
    'AGENTS.md': '…',
    '.codex-plugin/plugin.json': '…',
    'commands/<skill-name>.toml': '…',   // one per skill with `command: true`
  }
}
```

Emitters are **pure**: no `fs`, no writes, no side effects. They return a
path→contents map. This is what makes the design testable and what makes
`--check` free.

### Driver

`bin/generate.mjs`:

1. Read and validate `vibekit.config.json`.
2. Glob `skills/*/SKILL.md`, parse frontmatter, build the model.
3. Validate the model (see below); abort on any failure.
4. Load each emitter named in `config.runtimes` and call `emit(model)`.
5. Merge the returned maps. Two emitters claiming the same path is an **error**,
   not last-write-wins.
6. Apply marker regions for mixed files.
7. Either **write** (default) or **compare and report** (`--check`).

Because both modes operate on the same in-memory map, `--check` cannot disagree
with what `generate` would produce.

### Validation lives inside generation

v1 had six check scripts encoding the duplication as external rules. Here the
rules run during generation, so a malformed skill can never reach a manifest:

- frontmatter `name` equals the directory name
- required fields present and non-empty
- no duplicate skill names
- no two emitters writing the same path
- markers in mixed files present, balanced, and unique
- `vibekit.config.json` names only emitters that exist

`npm run check` is `node bin/generate.mjs --check`. One command.

### Hook and bootstrap

The SessionStart hook is the entire integration: if it fails, every skill is
inert with no visible error. It is carried forward as architecture (not as v1
content) — `hooks/session-start` reads the bootstrap skill and injects it as
session context, wrapped by `hooks/run-hook.cmd`, the polyglot batch/bash
wrapper needed for Windows. `hooks/hooks.json` is generated from
`vibekit.config.json`.

The bootstrap skill is `using-vibekit`. It is required by the architecture
regardless of what the pipeline redesign decides, so it is a real skill, not a
throwaway fixture.

### Fixtures

Three empty stub skills, written fresh, each existing only to exercise one
emission path:

| Stub | Path exercised | Fate |
|---|---|---|
| `using-vibekit` | bootstrap injection via SessionStart hook | permanent |
| `example-command` | `command: true` → slash-command emission on both runtimes | deleted in spec 2 |
| `example-plain` | the common case: trigger-table row only | deleted in spec 2 |

Three is the minimum that covers every distinct emission path. No v1 content is
copied into any of them.

### Distribution

`vibekit.config.json` holds the version. The generator stamps it into
`package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`,
and `.codex-plugin/plugin.json`. A version mismatch between the npm package and
the marketplace entry becomes structurally impossible rather than something a
check script catches afterward.

Both channels ship, as in v1: the Claude plugin marketplace (git-based) for
Claude Code, and npm for package-consuming runtimes.

## Alternatives considered

**Declarative templates — runtimes as data, not code.** Runtimes would be
JSON/template descriptors rendered by one generic engine, making a new runtime
pure data entry. Rejected because the output formats differ in kind, not merely
in shape: nested JSON manifests, TOML command files, long-form Markdown with an
embedded generated table, and JS plugin shims. A dependency-free template engine
spanning all of those becomes a small home-grown programming language — strictly
harder to maintain than four short pure functions. It trades explicit code for
implicit code.

**Monolithic generator — one file, a branch per runtime.** Everything visible in
one place, easiest to trace at small scale. Rejected because it is v1's coupling
in a new form: at five runtimes it is a large file where a change to Codex output
sits three lines from a change to Claude Code output. It scales badly in exactly
the direction this project is heading.

**Minimal framing — delete the duplicate tree, glob everything, generate almost
nothing.** Raised as the pushback turn: most v1 drift came from the duplicate
`plugins/vibekit/` tree and hand-written tables, and both die from plain deletion
plus one glob, so a full generator may earn less than it costs at two runtimes.
The maintainer considered this and chose the larger framing explicitly, on the
grounds that runtimes 3–5 are a real near-term goal and should be pure config
rather than fresh hand-written surfaces.

**Runtime discovery instead of generation.** Adapters glob `skills/` at load time
and derive everything dynamically. Rejected because static manifests —
`package.json` `files[]`, marketplace version fields — cannot be derived at
runtime, so duplication would survive in exactly the places that broke v1.

## Testing

- **Drift:** `npm run check` on a clean tree produces no diff. This is the
  primary guarantee and runs on every push and PR.
- **Emitters:** each is a pure function, so tests call `emit(model)` with a
  fixed model and compare the returned map. No temp directories, no fixtures on
  disk.
- **Validation:** each validation rule gets a failing-input test proving
  `generate` aborts — malformed frontmatter, name/directory mismatch, duplicate
  names, colliding output paths, unbalanced markers.
- **Hook:** smoke-tested on `ubuntu-latest` and `windows-latest`. The Windows leg
  is the only machine-executed proof that the polyglot wrapper's batch half
  works; nothing on a Unix box can verify it.
- **Acceptance:** a clean Claude Code session loads the `using-vibekit`
  bootstrap at session start, without the user opting in.

The existing `.github/workflows/ci.yml` already has the right shape — a
`validate` job calling `npm run check` and a two-OS `hook` job. Both are
currently broken because the scripts they call were deleted; this spec restores
them.

## Open questions

None. Deferred items are listed under Non-goals and are the subject of spec 2.
