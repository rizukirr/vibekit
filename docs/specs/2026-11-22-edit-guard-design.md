---
title: edit guard
date: 2026-11-22
status: approved
---

# edit guard: Design

## Problem

vibekit's gates live only in skill text. The trigger table tells the model to invoke `quick` before implementation work, and the `brainstorm-precedes-code` eval measures how often it does, but nothing stops a session from editing files without entering the pipeline at all. A gate the model can talk itself out of is the failure `using-vibekit` names.

## Goals

1. A Claude Code PreToolUse hook guards edits. Observable: the generated `hooks/hooks.json` has a `PreToolUse` entry with matcher `Write|Edit|NotebookEdit` whose command is `"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" edit-gate <list>`, and `hooks/edit-gate` exists and is executable.
2. The skill list is derived, not hand-kept. Observable: `<list>` is the names of every skill whose frontmatter has `gate: hard` or `command: true`, sorted and comma-joined, and a test in `tests/claude-code.test.mjs` asserts it against the skills on disk.
3. A main-session edit with no working skill in the session record is blocked. Observable: run through `run-hook.cmd` with a fixture record holding no matching skill, the hook exits 2 and its stderr contains `invoke vibekit:quick` (case-insensitive) and `VIBEKIT_GATE=off`.
4. A working skill unlocks edits in both recorded forms. Observable: the hook exits 0 for a fixture record containing `"name":"Skill","input":{"skill":"vibekit:quick"}`, and for one containing `<command-name>/vibekit:quick</command-name>`.
5. Mentions and modifiers do not unlock. Observable: the hook exits 2 for a fixture record holding only `"name":"Skill","input":{"skill":"vibekit:lazy"}`, and for one holding only the prose text `/vibekit:quick`.
6. Subagent edits pass. Observable: the hook exits 0 when its stdin JSON carries an `agent_id` field, even with a record holding no working skill.
7. The off switch works. Observable: the hook exits 0 with `VIBEKIT_GATE=off` in its environment and a record holding no working skill.
8. The hook fails open on a missing record. Observable: the hook exits 0 when `transcript_path` is absent from stdin, and when it names a file that does not exist.
9. Users can find the guard. Observable: `README.md` prose names the edit guard and `VIBEKIT_GATE=off`.
10. `npm run check` exits 0 and `npm test` exits 0.

## Non-goals

- Edits made through the shell (`sed -i`, redirects, scripts). The guard covers Write, Edit and NotebookEdit only.
- The git guard (blocking force-push and `--no-verify`). Its own spec, built second.
- The order guard (a skill refused unless the right one ran before it). Its own spec, built third.
- Runtimes other than Claude Code. Codex reads the same `hooks.json`, but its edit tools do not match the matcher, so the hook never fires there.
- Checking that a parent session ran a skill before letting a subagent edit.

## Constraints

- No new dependency. The hook is bash and standard tools only, no `jq`, no `node`.
- Generated files are regenerated with `npm run generate`, never hand-edited.
- Every edited string obeys `plain`'s rules, which `npm test` checks.
- No shipped file names an outside source, as `tests/no-external-references.test.mjs` requires.
- `run-hook.cmd` forwards at most 8 arguments on Windows, so the skill list is one comma-joined argument.
- Run limits: at most 3 verify rounds, at most $0 on paid runs

## Approach

A bash script `hooks/edit-gate`, run through the existing `run-hook.cmd`, registered by `runtimes/claude-code.mjs` in the generated `hooks.json`.

The script reads stdin. If the input has an unescaped `"agent_id"` key, or `VIBEKIT_GATE=off` is set, it exits 0. It extracts `transcript_path` with `sed`. If the path is empty or the file is unreadable, it exits 0. Otherwise one `grep -E` searches the record for `"name":"Skill","input":{"skill":"vibekit:NAME"` or `<command-name>/vibekit:NAME</command-name>`, with NAME drawn from the list in its first argument. A match exits 0. No match prints to stderr "No vibekit gate has run in this session. Invoke vibekit:quick first, then retry. To turn this check off, set VIBEKIT_GATE=off." and exits 2.

Decisions made with the user before `repl` took over: the guard covers Write, Edit and NotebookEdit only. Any call with `agent_id` passes. Edits unlock after any skill marked `gate: hard` or `command: true`. Approach A over a one-line inline grep or a Node script.

Pushback outcome: the smaller version, a reminder that lets the edit through, was offered. The user chose the larger framing: the hook blocks.

Decisions made under `repl`: match only the two exact record forms, because the bare text `/vibekit:<name>` appears in skill descriptions in every session (9 hits in the session that designed this). Fail open on a missing or unreadable record, because failing closed would block every edit if the field changes.

## Alternatives considered

- B, a one-line grep inline in `hooks.json`. No script, but it skips the Windows wrapper, cannot be tested like `session-start`, and the skill list is hand-kept.
- C, a Node script. Easier JSON parsing, but no existing hook uses Node, and a Claude Code install does not promise `node` on PATH.
- Also guarding shell commands that look like file writes. Rejected by the user: guesswork on command text, false blocks, and still leaky.
- Gating subagents on the parent's record. Rejected by the user: the docs do not say where a subagent's hook finds the parent record.

## Testing

- New tests in `tests/hook.test.mjs` run `hooks/run-hook.cmd edit-gate <list>` the same way the existing `session-start` tests run, with stdin JSON and fixture records written to a temporary directory, one test per goal 3 to 8.
- A test in `tests/claude-code.test.mjs` for goals 1 and 2.
- `npm run generate`, `npm run check`, `npm test`.
- Not run here: a live Claude Code session showing a real edit blocked and then allowed after `quick`. It is a paid run over this run's $0 budget, so it goes to the user.

## Open questions

N/A: every question was answered during brainstorm.
