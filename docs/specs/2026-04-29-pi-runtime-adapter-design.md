---
title: pi-runtime-adapter
date: 2026-04-29
status: draft
---

# pi-runtime-adapter — Design

## Problem

Vibekit currently supports four runtimes: Claude Code, OpenAI Codex, Gemini CLI, OpenCode. Pi (`@mariozechner/pi-coding-agent`, from `badlogic/pi-mono`) is a fifth coding-agent harness with its own extension model and a growing user base. Vibekit is unavailable on pi, so pi users get none of the discipline (brainstorm gate, verify-gate, review-pack sign-off) that vibekit provides on the other runtimes.

The goal is a minimal, parity-preserving pi adapter that delivers the same skills, the same `/vibe` slash command, and the same auto-trigger priming pi users would get on Claude Code — without forking skill content or adding a manual sync step.

## Goals

- Pi users can `pi install git:github.com/rizukirr/vibekit` and immediately use all 14 vibekit skills.
- `/vibe <intent>` works in pi the same way it does in Claude Code / OpenCode.
- The `using-vibekit` priming body reaches pi's system prompt every agent turn, with no user-managed copy step.
- Cross-runtime parity holds: `vibekit-doctor` returns clean, manifest descriptions and versions agree across all four (now five) adapter manifests, and the canonical `using-vibekit/SKILL.md` is the single source of priming content.
- No edits to the 14 skills themselves. Pi consumes them unchanged.

## Non-goals

- A full pi-native UX (custom commands beyond `/vibe`, themes, custom tools). Out of scope; users can add those via their own pi packages.
- Auto-publishing the package to npm. Distribution is git-only at this stage, matching the existing runtime install docs.
- A Cursor adapter. Tracked separately under "things not yet supported" in `CLAUDE.md`.
- Backporting any pi-specific extension primitive into the other runtimes. Each adapter stays in its own dir.

## Constraints

- Pi extension API must support modifying the system prompt at runtime. Verified: `pi.on("before_agent_start", …)` returns `{ systemPrompt }` per `packages/coding-agent/docs/extensions.md` lines 463–489.
- Pi follows the Agent Skills standard for `SKILL.md` frontmatter — same as Claude Code, so skills are format-compatible without edits.
- Pi's prompt-template variable syntax (to be confirmed in plan-write) is `{{args}}`-style, not `$ARGUMENTS`. The pi-side prompt file therefore cannot be a copy of `commands/vibe.md`; it adapts the body.
- The repo's existing `.pi/` directory belongs to pi-mono itself (referenced in `external/`); the vibekit pi adapter must use a non-colliding name. Decision: `.pi-plugin/` mirroring `.claude-plugin/` and `.codex-plugin/`.
- Skills must remain self-contained per `AGENTS.md`. The pi extension code lives outside `skills/`.

## Approach

A new directory `.pi-plugin/` at the repo root holds pi-specific artifacts; pi consumes the canonical `skills/` directory unchanged via a `pi` key in `package.json`.

### Directory layout (additions only)

```
vibekit/
├── .pi-plugin/
│   ├── plugin.json                 # internal manifest for parity checks
│   ├── prompts/
│   │   └── vibe.md                 # /vibe slash command for pi
│   └── extensions/
│       └── vibekit-prime.ts        # priming injector
├── docs/
│   └── INSTALL.pi.md               # install instructions for pi
└── package.json                    # gains `pi` key + "pi-package" keyword
```

### `package.json` `pi` key

```json
{
  "keywords": ["pi-package"],
  "pi": {
    "skills": ["./skills"],
    "prompts": ["./.pi-plugin/prompts"],
    "extensions": ["./.pi-plugin/extensions"]
  }
}
```

This is the contract pi reads at install time. Pi auto-discovers from conventional dirs in the absence of a manifest, but vibekit's `skills/` is at the root and the prompts/extensions are namespaced — explicit mapping is required.

### `.pi-plugin/plugin.json`

Mirrors the shape of `.claude-plugin/plugin.json`, `.opencode/plugin.json`, and `gemini-extension.json`:

```json
{
  "name": "vibekit",
  "description": "Token-efficient vibe-coding pipeline with hard guardrails: brainstorm, plan, isolate, exec, verify, review, integrate.",
  "version": "0.2.1"
}
```

Pi itself does not consume this file. It exists so vibekit-doctor's existing "manifest descriptions agree across runtimes" and "version numbers agree" checks have a fourth file to compare against, keeping the parity-by-grep contract symmetric.

### `.pi-plugin/prompts/vibe.md`

A new prompt file whose body adapts `commands/vibe.md` to pi's variable syntax (e.g., `{{args}}` instead of `$ARGUMENTS`, to be confirmed in plan-write step 1). Frontmatter: `description:` only — pi ignores `argument-hint`. Pipeline-stage list (`[1/7]…[7/7]`) matches `commands/vibe.md` exactly so vibekit-doctor's `pi-prompt-stages-match` check passes.

### `.pi-plugin/extensions/vibekit-prime.ts`

A small TypeScript extension. Default export is an async factory:

```typescript
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export default async function (pi: ExtensionAPI) {
  const here = dirname(fileURLToPath(import.meta.url));
  const skillPath = resolve(here, "../../skills/using-vibekit/SKILL.md");
  const skillBody = await readFile(skillPath, "utf8");

  pi.on("before_agent_start", async (event) => {
    const framed = `<EXTREMELY_IMPORTANT>\nYou have vibekit.\n\n${skillBody}\n</EXTREMELY_IMPORTANT>`;
    return { systemPrompt: event.systemPrompt + "\n\n" + framed };
  });
}
```

(Exact API signatures confirmed in plan-write step 1; the read-once-at-load-time pattern keeps per-turn cost to a string concat.)

The literal string `skills/using-vibekit/SKILL.md` appears in this file so the doctor's `pi-extension-canonical-source` grep check passes.

### `docs/INSTALL.pi.md`

Install instructions. Two steps:

1. `pi install git:github.com/rizukirr/vibekit`
2. Verify with `pi list` and `/vibe` autocomplete.

Plus a troubleshooting section mirroring `.opencode/INSTALL.md`'s shape (cache-clear command, restart instructions).

### vibekit-doctor extensions

Three new check rows added to `skills/vibekit-doctor/SKILL.md` per the agreed parity scope:

- **`pi-manifest-present`** — assert `.pi-plugin/plugin.json` exists and `package.json` has a `pi` key.
- **`pi-extension-canonical-source`** — grep `.pi-plugin/extensions/vibekit-prime.ts` for the literal `skills/using-vibekit/SKILL.md`.
- **`pi-prompt-stages-match`** — extract `[N/7]` stage names from both `commands/vibe.md` and `.pi-plugin/prompts/vibe.md`, compare as sets, fail on mismatch.

The existing "manifest descriptions agree" and "versions agree" checks already iterate over the runtime-manifest list; that list gains `.pi-plugin/plugin.json` automatically.

### Data flow at runtime

```
user: pi
  └─ pi loads vibekit package via `pi` key in package.json
       ├─ scans .pi-plugin/extensions/ → loads vibekit-prime.ts
       │    └─ factory reads skills/using-vibekit/SKILL.md once
       │    └─ registers before_agent_start handler
       ├─ scans skills/ → registers all 14 skills
       └─ scans .pi-plugin/prompts/ → registers /vibe
user: /vibe add a dark mode toggle
  └─ pi expands prompt template
  └─ before_agent_start fires
       └─ handler appends framed using-vibekit body to systemPrompt
  └─ agent loop starts with full priming
```

### README + AGENTS.md updates

- README install section gains a "Pi" subsection pointing at `docs/INSTALL.pi.md`, alongside the existing OpenCode / Codex / Gemini blocks.
- AGENTS.md "Cross-runtime changes" trigger list adds `.pi-plugin/` to the touched-files set so future contributors know to verify all five runtimes after edits.
- Top-level README's "supported runtimes" line bumps from four to five.

## Alternatives considered

**Static `APPEND_SYSTEM.md`, user-installed.** Ship a top-level `APPEND_SYSTEM.md` with the using-vibekit body baked in; install instructions tell the user to copy/symlink it to `~/.pi/agent/APPEND_SYSTEM.md`. Rejected: requires a manual user copy step, drifts on `pi update`, and forces a sync script to keep the static file aligned with `using-vibekit/SKILL.md`. The extension approach reads the canonical file directly, eliminating the drift class entirely.

**AGENTS.md only, no priming layer.** Pi auto-loads `AGENTS.md`, and vibekit's AGENTS.md already covers the discipline. Skip the priming entirely. Rejected: AGENTS.md is repo guidance, not the using-vibekit priming. The 1%-chance rule, the trigger map, and the `<EXTREMELY_IMPORTANT>` framing all live in `using-vibekit/SKILL.md`. Without injecting that body, pi users get weaker auto-trigger discipline than other runtimes — exactly the cross-runtime drift the doctor exists to prevent.

**Pi extension registers `/vibe` programmatically (skipping the prompt file).** The same extension calls `pi.registerCommand("vibe", …)`. Rejected: diverges from the file-based command pattern other runtimes use, makes the doctor's `pi-prompt-stages-match` check meaningless, and harder for users to inspect or override.

## Testing

- **Static, always:** `vibekit-doctor --strict` returns clean. The three new checks pass; the existing manifest-parity and version checks now include `.pi-plugin/plugin.json`.
- **Live, before declaring ship-ready:** install `@mariozechner/pi-coding-agent` globally, run `pi install git:<branch>` against this branch in a throwaway repo under `tests/eval/`, run `pi list` to confirm registration, run `/vibe add a hello endpoint`, observe priming body in `ctx.getSystemPrompt()` via a debug extension or pi's session inspector. Confirm at least `brainstorm-lean` auto-fires.
- **No automated test suite for the extension itself.** Vibekit has none today, and adding one for a ~30-line file is YAGNI. The doctor catches the only failure mode worth automating (canonical-source drift).

## Open questions

- **Pi extension package metadata.** Pi may require `.pi-plugin/extensions/vibekit-prime.ts` to live alongside its own `package.json` or to declare a specific export shape beyond the default-export factory. Resolved in plan-write step 1 by re-reading `pi-mono/packages/coding-agent/docs/extensions.md` lines 160–200.
- **Path resolution from the extension to `skills/using-vibekit/SKILL.md`.** Pi may expose `ctx.packageDir` or similar; if not, `import.meta.url`-based resolution as sketched above is the fallback. Affects ~3 lines of code. Resolved in plan-write step 1.
- **Pi prompt-template variable syntax for `{{args}}`-style expansion.** To be confirmed against `pi-mono/packages/coding-agent/docs/prompt-templates.md` in plan-write step 1. Affects only `.pi-plugin/prompts/vibe.md` content.
