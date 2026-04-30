---
name: vibekit-doctor
description: Use to diagnose vibekit installation health — skill file integrity, runtime registration parity, `.vibekit/` directory health, `docs/` subdir presence, authoring-contract alignment. Reports verdict only by default; `--fix` auto-repairs safe items. Cross-runtime portable.
---

# vibekit-doctor

A read-mostly health check for the vibekit plugin and the repo it lives in. Answers one question: **does vibekit actually work here, end to end?**

The doctor does not install, upgrade, or migrate. It diagnoses. It writes only when the user passes `--fix`, and even then only to safe, deterministic targets (rebuild an index, recreate a `docs/` subdir).

## When to invoke

- The user reports vibekit "isn't working" / "skill not found" / "AGENTS.md is wrong".
- After pulling a new vibekit version, before the first run.
- After hand-editing `skills/`, `.vibekit/`, or a runtime registration file.
- Periodically as a hygiene check on long-lived projects.

Do NOT invoke for:
- Diagnosing a *feature* failure (failed verify-gate, broken plan). That is the relevant skill's failure path, not a doctor concern.
- Diagnosing a Claude Code / Codex / Gemini / opencode runtime bug. The doctor checks vibekit's contracts; runtime bugs are out of scope.

## Operations

### `check`

Run every check below in order. Output a single YAML report. **Read-only.**

```yaml
verdict: ok | warn | critical
checks:
  - name: <check name>
    status: ok | info | warn | critical
    detail: <one-line, verbatim>
    evidence: <path / line / command output, optional>
summary:
  ok: <int>
  info: <int>
  warn: <int>
  critical: <int>
```

`verdict` is the worst status across all checks. Any `critical` → `critical`. Any `warn` and no `critical` → `warn`. Otherwise `ok`. `info` rows are recorded but never escalate the verdict — they exist for optional/gitignored files (CLAUDE.md, GEMINI.md) that may legitimately be absent.

### `check --fix`

Run all checks, then auto-repair the items below. Other findings remain in the report; only the safe set is touched.

| Finding | Auto-fix |
|---|---|
| `docs/specs|plans|reviews|verifications/` missing | `mkdir -p` |
| `.vibekit/memory/INDEX.md` drifted from disk | rebuild INDEX from existing files |
| `.vibekit/wiki/index.md` drifted from disk | rebuild from existing pages |
| `.vibekit/wiki/log.md` missing | create empty log |
| Stale `.vibekit/notepad.md` Working entries (>7d) | prune (delegate to `memory-dual audit`) |

Anything else — registration mismatches, missing skills, broken `[[links]]`, contract drift — is reported but **never auto-fixed**. Those changes touch user intent (which skills exist, what AGENTS.md should say) and require human judgment.

### `check --strict`

Same as `check`, but treats `warn` as `critical` for the verdict. Useful in CI.

## Checks

Each check produces one row in the report.

### C1 — Skill file integrity

For each directory under `skills/` (excluding `_authoring/`):
- A `SKILL.md` exists.
- `SKILL.md` has YAML frontmatter with `name:` and `description:` keys.
- `name:` matches the directory name.

`critical` if any skill directory lacks a parseable SKILL.md. `warn` if `name` mismatches dir.

### C2 — Runtime registration parity

For every skill directory under `skills/` (excluding `_authoring/`):
- **AGENTS.md** lists the skill in the skill table.
- **GEMINI.md** has an `@./skills/<name>/SKILL.md` line — **only if `GEMINI.md` exists**. GEMINI.md is gitignored as a per-user local context file (parity with `CLAUDE.md`); a missing GEMINI.md is not a defect.

Reverse: every skill referenced in AGENTS.md (and GEMINI.md when present) exists on disk.

Claude Code (`.claude-plugin/plugin.json`) and Codex (`.codex-plugin/plugin.json`) declare `"skills": "./skills/"` directory globs; they auto-discover by scan and need no per-skill row. opencode (`.opencode/plugins/vibekit.js`) adds the skills directory to `config.skills.paths`; same auto-discovery.

`warn` on any one-sided registration; `critical` if a *required* runtime entry doc is missing (see C3).

### C3 — Plugin manifest presence

Existence check.

**Required (committed to the repo):**
- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `.codex-plugin/plugin.json`
- `.pi-plugin/plugin.json`
- `gemini-extension.json`
- `AGENTS.md`
- `.opencode/plugins/vibekit.js`

**Optional (gitignored, per-user local context):**
- `CLAUDE.md` — Claude Code project-level context.
- `GEMINI.md` — Gemini CLI context file (declared as `contextFileName` in `gemini-extension.json`). Users running on Gemini author this locally; the C2 GEMINI.md parity check only fires when this file exists.

`critical` for any missing **required** file. `info` (not warn) when an optional file is absent. The doctor does not parse contents beyond what C2 needs; deeper schema validation is the runtime's job.

### C4 — `docs/` subdirectory presence

The pipeline writes to `docs/specs/`, `docs/plans/`, `docs/reviews/`, `docs/verifications/`. Each must exist as a directory.

`warn` for any missing dir (not `critical` — fresh repos won't have them yet, and `--fix` creates them).

### C5 — `.vibekit/` directory health (if present)

If `.vibekit/` does not exist, status is `ok` (clean repo, no memory yet).

If `.vibekit/memory/` exists:
- `INDEX.md` exists; every `<key>.md` is in INDEX; every INDEX row has a file. `warn` on drift; `--fix` rebuilds.
- Every `<key>.md` parses with required frontmatter (`key`, `type`, `scope`, `created`, `updated`, `confidence`). `warn` on malformed entries.

If `.vibekit/wiki/` exists:
- `index.md` and `log.md` exist. `warn` if missing; `--fix` rebuilds.
- Every page has frontmatter (`title`, `slug`, `category`, `tags`, `created`, `updated`, `status`). `warn` on malformed.
- Every `[[slug]]` cross-link resolves. `warn` per broken link, listing source page + target.

If `.vibekit/notepad.md` exists:
- Has the three sections (`## Priority Context`, `## Working Memory`, `## Manual`). `warn` on missing section.
- Priority Context ≤ 500 chars. `warn` on overflow.

### C6 — Authoring contract alignment

`skills/_authoring/peg-cheatsheet.md` and `skills/_authoring/karpathy-principles.md` exist. `critical` if either is missing — they are the source of truth for skill authoring.

The Karpathy principles file declares an injection map (which principles are enforced by which skills). For each principle row, every named enforcing skill must exist on disk. `warn` on mismatch.

### C7 — `external/` integrity

`external/` is the read-only references dir.
- It exists. `warn` if missing; the references inform skill authoring.
- It is gitignored. `warn` if not (would commit a large external tree by accident).
- The expected sub-references exist if referenced in CLAUDE.md (caveman, superpowers, oh-my-claudecode, oh-my-codex, Prompt-Engineering-Guide, andrej-karpathy-skills). `warn` per missing sub-tree.

### C8 — Skill count consistency

`AGENTS.md` opens with a skill count ("vibekit is an N-skill plugin"). The number must match the count of skill directories under `skills/` (excluding `_authoring/`).

`warn` on mismatch. The doctor does NOT auto-edit AGENTS.md prose; the user edits it.

### C9 — Hooks/sessions hygiene

If `hooks/` directory contains any files, they exist as committed code (not stray artifacts). The vibekit `hooks/` is reserved but currently empty; any unexpected file is `warn`.

### C10 — Git state

- The repo is a git repo. `critical` if not (vibekit assumes git for `isolate`, `finish-branch`, commit-based plan resolution).
- The current branch and worktree state are reported as informational, not graded.

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

## Discipline rules

- **Read-mostly.** `check` never writes. `check --fix` writes only to the auto-fix table above.
- **Evidence first.** Every non-`ok` row carries `evidence` — the path, the line, the command output. No "trust me."
- **Verbatim output.** Check names and statuses are byte-identical across runs. Tools and CI parse this report.
- **Never auto-edit user intent.** AGENTS.md skill counts, skill registrations, ship-order phases — these are decisions, not state. Report them; do not rewrite them.
- **No network.** No npm view, no remote version checks. The repo is the source of truth.

## Karpathy alignment

- **Surgical Changes.** `--fix` touches only the safe set; it never reorganizes. Any non-safe finding requires user action.
- **Simplicity First.** Plain-text checks against plain-text artifacts. No daemons, no caches, no introspection beyond `ls` / `cat` / `git`.
- **Goal-Driven.** Every check has a checkable success criterion (file exists; frontmatter parses; row matches).
- **Think Before Coding.** `check` defaults to read-only; the user must opt into `--fix`. The doctor never assumes its judgment beats the user's.

## Compression policy

| Region | Policy |
|---|---|
| Check names + statuses | Verbatim |
| `detail` strings | Terse one-liners, compressed narration OK |
| `evidence` strings | Verbatim — paths, line numbers, command output |
| `verdict` and `summary` | Verbatim |
| Auto-fix announcements | Compress |

The full report is YAML for parseability. Every finding is one row; no nested prose.

## Pipeline integration

`vibekit-doctor` is utility, not pipeline. `vibe` does NOT call it; `verify-gate` does NOT call it. It runs only when the user invokes it.

The doctor MAY be invoked by:
- A pre-flight check before a long vibe run.
- CI as a `--strict` health gate.
- The user, ad hoc, when something feels off.

## Cross-runtime portability

All operations are file I/O and `git` shell-outs. Verified portable to:

- **Claude Code** — auto-discovers via `.claude-plugin/plugin.json`.
- **Codex** — auto-discovers via `.codex-plugin/plugin.json`.
- **Gemini CLI** — referenced from `GEMINI.md` via `@./skills/vibekit-doctor/SKILL.md`.
- **opencode** — auto-discovers via `.opencode/plugins/vibekit.js` (skills directory scan).
- **Pi** — auto-discovers via `.pi-plugin/plugin.json` and the `pi` key in `package.json`.

No runtime-specific logic. The doctor does not introspect the runtime it is running under.

## Anti-patterns

- Auto-fixing a missing skill registration. The user wrote the registrations; doctor reporting drift is the contract.
- Running `check --fix` without first running `check`. The user should see what would change before opting in.
- Treating `warn` as `critical` outside `--strict`. Inflated severity erodes trust in the report.
- Network calls for "latest version" comparisons. The repo is the source of truth; this is not an installer.
- Silently rewriting AGENTS.md prose to match disk. That is user intent; the user fixes it.
- Caching results. Each `check` is independent; the cost is small and freshness matters.

## Output of this skill

For `check` and `check --strict`: the YAML report exactly as specified above, then exit.
For `check --fix`: the YAML report, then a `fixes_applied:` block listing each safe-set repair, then exit.

No conversational narration around the report. The skill is a diagnostic, not a chat partner.
