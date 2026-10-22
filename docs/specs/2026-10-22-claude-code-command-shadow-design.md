---
title: claude-code command shadow
date: 2026-10-22
status: approved
---

# claude-code command shadow: Design

## Problem

On Claude Code, every skill with `command: true` (`quick`, `vibe`, and `retro` on its branch) never delivers its body when invoked through the Skill tool. `runtimes/claude-code.mjs:69-71` emits `commands/<name>.md` for each such skill, and `Skill("vibekit:<name>")` returns that wrapper (`"commandName":"vibekit:retro"` in the tool result), whose body is only "Invoke the `<name>` skill and follow it exactly" (`runtimes/claude-code.mjs:19-30`). The repeat call is deduplicated as already loaded, so the SKILL.md body never reaches the model.

Evidence from `debug`, refuter verdict `holds`:

- Eval `retro-proposes-and-waits` scored 0.20 against a floor of 0.8. All 8 failing sessions reported that the skill's instructions never loaded.
- One `claude -p` haiku session each: `vibekit:retro` and `vibekit:quick` returned no body, `vibekit:debug` returned `# debug`.
- A copy of the plugin with `commands/retro.md` and `commands/retro.toml` deleted returned `# retro`.
- `/vibekit:retro` as a slash prompt in `-p` mode follows the skill's rules with the wrapper deleted.
- opencode loads `quick`'s body and emits no wrappers. codex `exec` returned `NONE` for `debug`, which has no wrapper, so codex shows nothing wrapper-specific.

## Goals

1. The Claude Code emitter writes no `commands/*.md` file. Observable: a test in `tests/claude-code.test.mjs` asserts that `emit` returns no key matching `^commands/.*\.md$` for a model containing a `command: true` skill, and that test fails against `runtimes/claude-code.mjs` at BASE and passes at HEAD.
2. The generated wrappers are gone. Observable: `commands/quick.md` and `commands/vibe.md` do not exist at HEAD, and `commands/quick.toml` and `commands/vibe.toml` do.
3. `runtimes/claude-code.mjs` carries a comment at the former loop's place naming why no command file is emitted. Observable: the file contains the word `shadow` or `hides` in a comment, and no `commandFile` function.
4. `quick`'s body loads through the Skill tool. Observable: `npm run eval -- --scenarios quick-discloses` meets the default `minFiringRate` of 0.8 when run.
5. `npm run check` exits 0 and `npm test` exits 0.

## Non-goals

- No change to the codex emitter or its `.toml` wrappers.
- No change to the opencode, antigravity or pi emitters.
- No change to the `command` frontmatter field or its validation in `lib/model.mjs`.
- No version bump. Release is a separate step.

## Constraints

- Every edited string obeys `plain`'s rules, which `npm test` checks.
- Generated files are regenerated with `npm run generate`, never hand-edited.

## Approach

Pushback: no simpler framing, the requirement is already minimal. The user chose approach A after scoping the fix to Claude Code only, once codex and opencode showed no wrapper-specific failure.

Delete the command loop and `commandFile` from `runtimes/claude-code.mjs`, and leave a comment in their place in the style of the existing hooks comment: a plugin command named like a skill is what the Skill tool returns, so emitting one hides the skill's body, and plugin skills are already slash commands on Claude Code.

In `tests/claude-code.test.mjs`, replace the three tests that expect `commands/alpha.md` (emits one markdown command, carries the description, round-trips the description) with the single guard test in Goal 1.

Run `npm run generate`. A throwaway worktree showed that it deletes `commands/quick.md` and `commands/vibe.md` and updates `.vibekit-manifest`, touching nothing else.

## Alternatives considered

- Keep the wrappers and make their body read `${CLAUDE_PLUGIN_ROOT}/skills/<name>/SKILL.md`. Keeps the slash menu's argument hint, but the Skill tool still returns the wrapper, every skill call costs an extra read, and the agent must follow a pointer to reach the text. Rejected by the user for approach A.
- Fix codex in the same spec. No evidence codex is affected. Rejected at the scope question.

## Testing

`npm test` runs the guard test, which is shown red at BASE by running the new test file against the BASE emitter. `npm run check` confirms the generated files match. The `quick-discloses` eval (10 sessions) is a manual gate because it costs money, and `verify` reports it unobserved if it was not run.

Interactive slash use of `/vibekit:quick` was only checked in `-p` mode and is reported unobserved. Once this merges and the `retro` branch is rebased onto it, `retro-proposes-and-waits` gives a second confirmation there.

## Open questions

N/A: every question raised during design was answered.
