---
title: antigravity runtime
date: 2026-08-25
status: approved
---

# antigravity runtime: Design

## Problem

Gemini CLI is no longer used. Running `gemini` now redirects the user to Antigravity CLI (`agy`), so `runtimes/gemini.mjs` targets a host nobody runs, and the README already marks that runtime unverified because the tool was never installed.

`agy plugin install https://github.com/rizukirr/vibekit` already succeeds against vibekit 0.6.2, but the result is broken in four measured ways. Probes were run against agy 1.1.20 on 2026-08-25.

1. Eight of eleven skills fail to load. agy parses `SKILL.md` frontmatter with a spec-strict YAML parser, and a plain scalar may not contain a colon followed by a space. Every description written as `Use when X: does Y` is rejected with `failed to parse frontmatter: yaml: line 2: mapping values are not allowed in this context`. All five hard gates are among the eight. A ninth value, `debug.trigger`, carries the same defect. vibekit's own parser splits on the first colon and so has never noticed.
2. The session-start hook never runs. agy rejects the Claude-shaped `hooks.json` with `invalid hook "hooks": command hook must specify 'command'`, and agy has no session-start event at all. Its five events are PreToolUse, PostToolUse, PreInvocation, PostInvocation and Stop.
3. The auto-trigger map never reaches the model. A plugin's own `GEMINI.md`, `CLAUDE.md` and `AGENTS.md` are not read. A print-mode probe answered `NO TABLE`.
4. The importer destroys two skills. Because `gemini-extension.json` is present, agy takes the legacy Gemini path, which converts `commands/*.toml` into skills without namespacing and overwrites `skills/vibe/SKILL.md` and `skills/quick/SKILL.md` with the command prompt body, deleting the handoff to `brainstorm`.

## Goals

1. `agy plugin install https://github.com/rizukirr/vibekit` reports `skills: 11 processed`, and after a subsequent print-mode session `~/.gemini/antigravity-cli/cli.log` contains zero `Failed to parse skill file` lines for vibekit. Parse errors surface when a session loads the skills, not at install time.
2. The auto-trigger map is present in an agy session's context, verifiable by asking a print-mode session to reproduce a row from it.
3. Every description and trigger, as parsed, is byte-identical before and after the change, so no measurement of firing rates is owed. The `SKILL.md` files themselves change, by exactly one pair of quote characters per affected value.
4. `npm run check` passes, and `npm test` passes including new tests for quote stripping and for the antigravity emitter.
5. A skill author who writes an unquoted colon-space in any frontmatter value gets a named error from `npm run generate` naming the skill and the key, rather than a skill that silently vanishes inside agy.
6. `gemini-extension.json` and `GEMINI.md` no longer exist in the repo or in the published npm package.

## Non-goals

- Porting the session-start hook to agy. There is no session-start event, `PreInvocation` fires every turn, and hook stdout must be protojson. The trigger table arrives through `rules/AGENTS.md` instead.
- Keeping any Gemini CLI compatibility. The runtime is deleted, not deprecated.
- Rewording any description or trigger. Approach A was chosen precisely to avoid prose changes.
- Adding an eval instrument for agy. None exists and building one is its own project.
- `mcp_config.json` and `agents/`, which vibekit does not use.

## Constraints

- Install must work from the bare repo URL, so agy reads `skills/` at the repo root and the frontmatter must be strict-YAML valid at source. There is no isolating the fix in a generated directory.
- Generated files are never hand-edited. `plugin.json` and the trigger table inside `rules/AGENTS.md` are generated, and their prose containers are not.
- `applyRegions` throws when a file with a generated region does not exist, so `rules/AGENTS.md` must be committed with its marker before `npm run generate` runs.
- A rules file is capped at 12,000 characters by agy. The current file is 1,209 bytes, so there is headroom, but the cap is real.
- `plain` applies to `rules/AGENTS.md`, which today is hard-wrapped at column 72 as `GEMINI.md` and must be unwrapped when moved.

## Approach

Approach A of three, chosen by the user after a pushback turn.

The pushback challenged whether any new runtime was needed, on the evidence that superpowers ships no `rules/` directory, no `plugin.json`, and a hook that does not run on agy, yet bootstraps correctly because its skills load and `using-superpowers` sits in the skills list. The user chose the larger framing. The reasoning recorded at the time: on Claude Code the pipeline gets two always-on channels, the trigger table in `CLAUDE.md` and a SessionStart hook, and agy has neither. There is no eval instrument pointed at agy, so `rules/AGENTS.md` is bought as cheap insurance rather than claimed as a measured win.

The chosen approach quotes the nine offending frontmatter values rather than rewording them. agy accepts both quote styles and returns the value with the colon intact, verified by probe. Because the prose does not change, the question of whether firing rates moved never arises, and no eval run is owed. The two rejected approaches, mechanical reword and editorial reword, both cost an A/B run at n of 10 or more on the Claude Code harness to show no regression, which is the expensive part rather than the edit.

`runtimes/antigravity.mjs` mirrors the `runtimes/gemini.mjs` it replaces, one method at a time. `emit()` returns `plugin.json` where Gemini returned `gemini-extension.json`. `regions()` returns the trigger table for `rules/AGENTS.md` where Gemini returned it for `GEMINI.md`. `ships()` returns both paths. A first draft generated `rules/AGENTS.md` whole, including a preamble written as a string literal in the emitter. That was corrected: prose in an emitter duplicates what `CLAUDE.md` and `AGENTS.md` already say, which is the drift the generator exists to prevent.

The full change set:

- `vibekit.config.json`: replace `"gemini"` with `"antigravity"` in `runtimes`.
- `runtimes/gemini.mjs`: delete.
- `runtimes/antigravity.mjs`: add, mirroring the table above.
- `GEMINI.md`: move to `rules/AGENTS.md`, retitle, unwrap the prose, keep the region markers.
- `lib/frontmatter.mjs`: strip a matched pair of surrounding quotes from a value, and reject an unquoted value containing colon-space.
- Nine `SKILL.md` frontmatter values: wrap in double quotes. Eight descriptions plus `debug.trigger`.
- `runtimes/claude-code.mjs` line 22: quote the description written into `commands/*.md`.
- `README.md`: replace the Gemini CLI install block with `agy plugin install https://github.com/rizukirr/vibekit`, and replace the Gemini row of the runtime table with an Antigravity row marked verified.

`gemini-extension.json` and `GEMINI.md` need no explicit deletion step. Both are listed in `.vibekit-manifest`, so `planChanges` reports them as orphans and `bin/generate.mjs` removes them.

Deleting `gemini-extension.json` also fixes defect 4 at no cost. With only `.claude-plugin/plugin.json` present, agy detects the source as `claude-code` and namespaces a converted command as `<plugin>-cmd-<name>` instead of overwriting the authored skill. This was verified with a throwaway plugin: the authored body survived intact alongside a namespaced duplicate.

## Alternatives considered

- **Reword the descriptions to drop the colon.** Zero code and the laziest rung that works, and it is what superpowers does, since zero of their fourteen descriptions contain colon-space. Rejected because the prose would change and `stated-rules-do-not-bind` requires an A/B, which costs a full Claude Code eval run at n of 10 or more.
- **Editorial rewrite of the nine values.** Best prose, largest semantic delta, same eval obligation plus more risk. Rejected for the same reason.
- **Ship no `plugin.json` and no `rules/AGENTS.md`.** The true minimum, and superpowers proves it can work. Rejected by the user in the pushback turn.
- **Port the hook to `PreInvocation`.** Technically possible: the probe hook did fire, failing only because it wrote plain text where protojson was expected. Rejected because it fires every turn rather than once, and `rules/AGENTS.md` is always-on for free.
- **Keep `runtimes/gemini.mjs` alongside the new runtime.** Rejected by the user. Keeping it would also leave `gemini-extension.json` in place, which is what routes agy down the skill-destroying importer path.

## Testing

Unit, in `tests/`:

- `parseFrontmatter` strips double quotes and single quotes, returning the value with an interior colon intact.
- `parseFrontmatter` throws a named error for an unquoted value containing colon-space, and the message names the key.
- `parseFrontmatter` accepts a quoted value containing colon-space.
- The antigravity emitter returns `plugin.json` with name, description and version from config, and a `regions()` entry for `rules/AGENTS.md`.
- `npm run check` reports up to date after `npm run generate`.

Integration, run by hand against the real CLI and recorded in the verification report:

- `agy plugin install <repo>` reports `skills: 11 processed`.
- `grep "Failed to parse skill" ~/.gemini/antigravity-cli/cli.log` returns nothing for vibekit after a print-mode session.
- A print-mode session reproduces a row of the auto-trigger map on request.
- `skills/vibe/SKILL.md` and `skills/quick/SKILL.md` in the installed plugin still contain their authored bodies.
- `agy plugin uninstall vibekit` afterwards, so the probe leaves no state.

This integration probe is the reason the README row can say verified. Four integration defects have previously hidden behind passing unit tests, which assert what we decided to emit and say nothing about whether a host accepts it.

## Open questions

1. Does shipping our own root `plugin.json` flip agy's detection from `claude-code` to native. If it does, the command converter may not run at all, and the two namespaced duplicates disappear. Answered by the install probe, not by discussion.
2. If detection stays on the claude-code path, are `vibekit-cmd-quick` and `vibekit-cmd-vibe` acceptable noise in agy's skill list, or worth suppressing. Deferred until question 1 is answered, since it may be moot.
