---
title: windows start skills
date: 2026-11-23
status: approved
---

# windows start skills: Design

## Problem

A Windows test run of `main` at 3f800da (results in `windows-test-results.md`, uncommitted) found six failures:

1. The root `hooks.json` runs `./hooks/run-hook.cmd`. Under `cmd /c` that fails with `'.' is not recognized as an internal or external command`. Live in agy 1.5.15 there is no start-up text, and the `PreToolUse` guard hook exits 1, so agy refuses every `write_file`.
2. With `core.autocrlf=true` and no `.gitattributes`, every file is checked out with CRLF. `lib/frontmatter.mjs` matches `^---\n`, so `npm run check` fails with `brainstorm: missing frontmatter block` and `npm test` fails 32 of 309 tests.
3. The CRLF checkout leaks `\r\n` into the injected start-up text and the OpenCode skill text.
4. OpenCode 2.3.2 does not load the plugin from a local checkout through the `plugin` array of `opencode.json`. A one-line re-export in a `.opencode/plugins/` folder does load it. `.opencode/INSTALL.md` documents neither working form.
5. Codex on Windows runs hook commands in Windows PowerShell (measured with a probe plugin: `%CD%` stays literal, `$PWD` expands, `echo` prints one argument per line). It ignores `"shell": "bash"`, so `"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" session-start` is a PowerShell parse error, exit 1, and no start-up text arrives.
6. On Windows, Codex wrote a file through its shell tool (`tool_name: "Bash"`, `Set-Content ...`), which the edit guard's matcher does not cover.

The user decided to remove the edit guard entirely and instead load `quick`, `lazy`, `plain` and `terse` into every session at start. `using-vibekit` is deleted.

## Goals

1. Every runtime starts a session with the bodies of `quick`, `lazy`, `plain` and `terse` in context. Observable: on Claude Code, Codex (Windows), OpenCode, pi and Antigravity on this Windows machine, the prompt `do you have vibekit? quote the first line of what you were given about it` gets an answer quoting start-up text, and a follow-up question about any one of the four skills is answered from that text without a skill load.
2. The start-up skill list is derived, not kept by hand. Observable: a unit test adds a skill whose description ends `Stays on after.` to a model and finds it in `startSkills` output and in every emitter's start-up output.
3. Each start-up block on Claude Code and Codex arrives inline. Observable: one hook entry per start skill, each under 10,000 characters of context, and the Claude Code live check shows no file-reference preview.
4. No edit guard remains. Observable: `git grep -i -E 'edit-gate|denyReason|missingSkills|VIBEKIT_GATE|PreToolUse'` over tracked files outside `docs/` and `tests/` returns nothing (tests may name `PreToolUse` to assert it is absent), `hooks/edit-gate` is gone, and `create hello.txt containing the word hi` succeeds on the first try on every runtime, agy included.
5. `using-vibekit` is gone. Observable: `skills/using-vibekit/` does not exist, `config.bootstrap` is `quick`, and `git grep using-vibekit` outside `docs/` and `windows-test-results.md` returns nothing.
6. CRLF no longer breaks anything. Observable: a `.gitattributes` with `* text=auto eol=lf` exists, a unit test parses a CRLF skill file, `npm test` and `npm run check` exit 0 on this Windows checkout, and no start-up block contains `\r`.
7. Codex on Windows runs the start hook. Observable: `hooks/hooks.json` has `commandWindows: & "$env:PLUGIN_ROOT/hooks/run-hook.cmd" session-start <name>` on each start hook, an interactive Codex session shows no `Hook failed`, and its session record contains the start-up text.
8. Antigravity on Windows runs the start hook. Observable: the root `hooks.json` command form, chosen by a measurement of how agy launches hooks, passes in `tests/hook.test.mjs` when launched the way agy launches it, and live agy quotes the start-up text.
9. `.opencode/INSTALL.md` documents a local-checkout install that loads the plugin. Observable: following its steps from an empty folder gives a session whose answer quotes the start-up text.
10. The `hook (windows-latest)` CI job passes on the pushed branch.

## Non-goals

- Guarding writes in any form, including Codex shell writes. The guard is removed, not replaced.
- A PowerShell implementation of `session-start`. Windows keeps Git for Windows as a requirement.
- Changing what `quick`, `lazy`, `plain` or `terse` say.
- Releasing or bumping the version.

## Constraints

- Run limits: at most 3 verify rounds, at most $0 on paid runs
- Generated files are never hand-edited. Every change to `hooks/hooks.json`, the root `hooks.json`, `.opencode/`, `.pi/`, `CLAUDE.md`, `AGENTS.md`, `rules/AGENTS.md` and `.opencode/INSTALL.md` goes through `runtimes/*.mjs` and `npm run generate`.
- `run-hook.cmd` forwards at most 8 arguments on Windows, and cmd.exe splits an argument at a comma.
- cmd.exe behaviour is measured before a fix is built on it (CLAUDE.md rule). This machine is Windows, so local measurement counts, and the CI job confirms it.
- A change under `hooks/` is not done until the `hook (windows-latest)` CI job passes.
- Measured on Claude Code 2.1.330: one `SessionStart` hook whose context is 19,956 characters arrives as a file reference with a 2 KB preview. Three hooks of 9,017, 9,017 and 6,209 characters all arrive inline. Claude Code accepts a `commandWindows` field and runs `command`.
- Measured on Codex 0.171.0 (Windows): hooks run in Windows PowerShell, cwd is the project folder, `PLUGIN_ROOT` and `CLAUDE_PLUGIN_ROOT` are set. The Codex docs define `commandWindows` as "an optional Windows-only command override".
- Start-up never blocks a session. A missing file, a missing bash or a plugin exception skips that block.
- Installing a probe into agy changes `~/.gemini`, so the user is asked first.

## Approach

Pushback given: injecting `quick` costs about 1,000 tokens in every session, including ones that only ask questions, and is repeated on `/clear` and compaction. The smaller version was to inject only the three modifiers. The user chose the larger framing, with `quick` replacing `using-vibekit`, and then chose to delete `using-vibekit`.

The start-up list is `[config.bootstrap, ...modifierSkills(skills)]`, built by `startSkills` in `lib/start.mjs` (renamed from `lib/gate.mjs`, which keeps `modifierSkills` and `startText` and loses `pipelineSkills`, `missingSkills` and `denyReason`). `config.bootstrap` becomes `"quick"`.

1. `hooks/session-start` takes the skill name as an argument (after `antigravity` when that runtime passes it) instead of reading the config with `sed`. It reads `skills/<name>/SKILL.md`, strips the frontmatter, deletes `\r`, wraps the body with the existing `<EXTREMELY_IMPORTANT>` text, and prints the runtime's JSON shape through the existing `printf` branches. Only the first skill's block carries the `You have vibekit.` line. A missing file prints nothing and exits 0.
2. `runtimes/claude-code.mjs` emits one `SessionStart` hook per start skill: `command` `"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" session-start <name>` with `shell: bash`, and `commandWindows` `& "$env:PLUGIN_ROOT/hooks/run-hook.cmd" session-start <name>`. No `PreToolUse`. Codex reads this same file.
3. `runtimes/antigravity.mjs` emits one `SessionStart` hook per start skill in the form measured in the first exec task, either the quoted `"./hooks/run-hook.cmd"` or a per-OS field if agy supports one. No `PreToolUse`.
4. `runtimes/opencode.mjs` and `runtimes/pi.mjs` push one block per start skill and drop every guard part: loaded-skill tracking, the `permission` and `tool_call` handlers, `VIBEKIT_GATE`.
5. `hooks/edit-gate` and `skills/using-vibekit/` are deleted. `lib/submission.mjs` and `submission/README.md` name `config.bootstrap` (`quick`) as the skill to activate by hand. `skills/vibe/SKILL.md` drops its reference to `using-vibekit`. The eval fixtures that name `using-vibekit` switch to `quick`.
6. `.gitattributes` gets `* text=auto eol=lf`. `lib/frontmatter.mjs` matches `^---\r?\n([\s\S]*?)\r?\n---\r?\n?` and splits on `\r?\n`.
7. `runtimes/opencode.mjs`'s `installDoc` replaces the local-checkout section with the one-line re-export placed in a project's or the user's `.opencode/plugins/`, verifies with `quick`, and notes that `opencode plugin list` can print `No plugins found` while the plugin loads.
8. `README.md` replaces the guard paragraph with one line saying `quick`, `lazy`, `plain` and `terse` load at session start, and states that Windows needs Git for Windows.
9. `HANDOFF.md` describes the start skills in place of the edit guard (its "Two things must work" list, wiring table and step 1.5), so the second Windows round tests the new behaviour.

## Alternatives considered

- Leave the guard and fix it. Rejected by the user: the guard is not needed once the skills are injected.
- Inject only `quick` by setting `bootstrap` to `quick` and nothing else. The smallest change, about 984 tokens, but nothing would load `plain` or `terse`, which is the skipping the guard existed to fix.
- Make `bootstrap` a list in `vibekit.config.json`. Explicit, but a hand-kept list drifts when a modifier is added, and `session-start` would have to parse a JSON array in bash.
- One start hook carrying all four skills. Measured on Claude Code: about 18,300 characters arrive as a file reference with a 2 KB preview.
- Inject only the three modifiers and leave `quick` to trigger. Cheaper by about 1,000 tokens per session, offered in the pushback and declined.
- Keep `using-vibekit` as an on-demand skill, or inject it as a fifth block. Declined: `quick` already routes big work to `brainstorm` or `repl`.
- A PowerShell `session-start` for Codex on Windows, avoiding the Git for Windows requirement. Two implementations of the same script to keep in step.

## Testing

1. Unit tests (`npm test`): CRLF frontmatter parses. `startSkills` returns `quick` then the modifiers, and a new "Stays on after." skill joins. Each emitter yields one start block per start skill and no `PreToolUse` or guard code. The Claude Code hooks file carries `commandWindows` with `$env:PLUGIN_ROOT`. Guard tests are deleted.
2. `tests/hook.test.mjs` (run by the `hook (windows-latest)` CI job): `session-start <name>` through `run-hook.cmd` for each start skill gives valid JSON holding that skill's body and no `\r`. The Antigravity form is run the way agy runs it.
3. `npm run check` exits 0.
4. Live, on this Windows machine, the handoff's step 2 per runtime, results added to `windows-test-results.md` as a second round. Goals 1, 3, 4, 7, 8 and 9 are checked here.
5. Cleanup: remove the `vkprobe` Codex plugin and marketplace and any agy probe.

## Open questions

1. How agy launches a hook command on Windows (`cmd /c`, `cmd /s /c`, or PowerShell), and whether its `hooks.json` has a per-OS field. Settled by measurement in the first exec task, after the user approves installing a probe into agy.
