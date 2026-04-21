# vibekit — AGENTS.md

This file is read by Codex, Gemini CLI, and other AGENTS.md-aware tools. It is a thin pointer into the plugin's canonical instructions.

## Plugin purpose

`vibekit` is a 10-skill pipeline that turns a short user intent into a verified, user-approved feature. The orchestrator skill is `vibe`; the rest compose beneath it.

## Where to read

- **`CLAUDE.md`** (root) — project conventions and compression policy. Also applies to non-Claude agents working in this repo.
- **`skills/vibe/SKILL.md`** — orchestrator. Start here if you are running the pipeline.
- **`skills/*/SKILL.md`** — each skill is self-contained; no external references.
- **`docs/evals/`** — eval reports. The live eval documents the halt-and-report discipline that is the plugin's core guarantee.

## Non-Claude runtime notes

- **Codex:** skills under `skills/` are portable as prompt fragments. A `.codex/` adapter is planned; until it lands, Codex users invoke skills by reading their `SKILL.md` into context.
- **Gemini CLI:** `gemini-extension.json` + `GEMINI.md` scaffolding is planned. Until it lands, Gemini users read `CLAUDE.md` and the relevant `SKILL.md` files directly.
- **Cursor / Windsurf / Cline / Copilot:** rule-file adapters are deferred. Same manual route for now.

## Conventions

- Never edit anything under `external/` — reference only. It is excluded from the plugin via `.gitignore`.
- Never compress guardrail content (constraints, test output, file:line refs). Compress framing only.
- Halt and report on any "Expected" mismatch; do not improvise.

## License

MIT.
