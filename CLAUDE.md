# CLAUDE.md

Claude Code-specific guidance for contributing to vibekit. This file is the Claude Code overlay on top of `AGENTS.md`. **Read `AGENTS.md` first** — it covers everything that applies to all runtimes (repo layout, the 14 skills, compression policy, guardrails, commit rules, eval workflow). This file only adds what is specific to working on vibekit *with Claude Code*.

## What auto-fires when you start a session

When you open this repo in Claude Code, vibekit's SessionStart hook (`hooks/session-start`, registered in `.claude-plugin/plugin.json`) injects `skills/using-vibekit/SKILL.md` into your context as `additionalContext`. That priming layer is non-negotiable: it carries the **1%-chance rule** (if there is even a 1% chance a vibekit skill applies, you MUST invoke it via the `Skill` tool) and the trigger map for the rest of the pipeline.

The hook fires on `startup | clear | compact`, so `/clear` re-loads the priming if you've drifted.

If `using-vibekit` is not in your context at the start of a session, the hook is broken — run `vibekit-doctor` to confirm and fix before continuing.

## Skill discovery in Claude Code

All vibekit skills appear in your available-skills list with the `vibekit:` prefix (e.g. `vibekit:vibe`, `vibekit:brainstorm-lean`). Invoke them via the `Skill` tool. **Never `Read` a `SKILL.md` file as a substitute for invoking it** — the Skill tool loads the skill body and registers that you are now operating under its constraints; reading the file does neither.

The auto-trigger map (which skill fires when) is in `skills/using-vibekit/SKILL.md` and mirrored in `AGENTS.md`. Do not skip it. The whole reason this plugin exists is to prevent silent skipping of guardrail steps.

## When you're contributing to vibekit (not using it on a downstream project)

Vibekit's skills are themselves the product. Editing one changes agent behavior for every downstream user. Because of that, the contribution workflow has stricter rules than ordinary code changes:

- **Edit only the canonical source.** Each skill is `skills/<name>/SKILL.md`. Do not copy a skill's content into another file. Cross-runtime adapters (`GEMINI.md` `@`-imports, the opencode plugin's bootstrap injection, the Claude Code SessionStart hook) all read from the canonical `SKILL.md` — there is one source, four delivery paths.
- **Read the skill in full before editing it.** Skills are behavior-shaping prompts. A small wording change can cascade into a different decision tree at runtime.
- **Keep skills self-contained.** A shipped skill must not reference `external/`, third-party plugin names, local paths, or any non-vibekit identifier. If you need a concept from elsewhere, inline the relevant text.
- **Verify before claiming done.** Any change that could affect runtime behavior routes through `verify-gate` with evidence quoted verbatim. "Looks right" is not evidence.
- **Eval after substantive skill changes.** See the eval workflow in `AGENTS.md` (`docs/evals/`, `tests/eval/`). Static eval at minimum; live eval if the change affects orchestration.

## Subagents you dispatch from inside this repo

If you delegate work via the `Agent` tool (e.g. exploring code, running a parallel investigation), apply the same discipline vibekit teaches downstream:

- Compile an RTCO brief first via `brief-compiler` rather than passing a free-form prompt.
- Run the return through `report-filter` before acting on it.
- Subagents read `using-vibekit`'s `<SUBAGENT-STOP>` carve-out and skip the priming themselves — they follow your brief, not the orchestration map. Do not pass the priming layer down; it would cause recursion and waste tokens.

## Tests and throwaway repos

When you need a real repo to dispatch into for live evals, create it under `tests/eval/<run-id>/`. That subtree is gitignored. Do not commit eval artifacts.

## Cross-runtime changes

If your change touches anything in `hooks/`, `.codex/`, `.opencode/`, `.pi-plugin/`, `GEMINI.md`, `gemini-extension.json`, or the `<runtime>` section of `using-vibekit/SKILL.md`, verify all five runtimes are still consistent:

- The same `using-vibekit` body is delivered by every runtime.
- Manifest descriptions in `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, `.pi-plugin/plugin.json`, `gemini-extension.json`, and `.opencode/plugin.json` agree on `name`, `version`, and pipeline-stage list.
- `vibekit-doctor` returns clean (C11/C12/C13 cover pi parity).

A consistency drift in one runtime adapter will surface as "the skill works on Claude Code but not Pi" reports from users — exactly the failure mode this plugin's portability layer exists to prevent.

## Things that are not yet supported

- Cursor adapter (`.cursor-plugin/`) — not shipped yet. The SessionStart hook script contains a Cursor branch as forward-compat scaffolding; it is dormant until a Cursor manifest exists.

## When in doubt

- Re-read `AGENTS.md` for repo-wide conventions.
- Re-read the relevant `SKILL.md` for skill-specific contracts.
- Halt and ask the human contributor over improvising. The plugin's reason to exist is preventing improvised guardrail bypasses.
