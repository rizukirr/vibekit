---
title: runtime guard
date: 2026-11-23
status: approved
---

# runtime guard: Design

## Problem

On Claude Code, vibekit loads `using-vibekit` at session start and its edit guard denies the first file edit until `quick` (or another pipeline skill) and the modifiers `lazy`, `terse` and `plain` have run. Real sessions on 0.10.1 and 0.10.2 showed models skipping these skills when only instructions asked for them. The other runtimes have no guard, and three of them (OpenCode, pi, Antigravity) do not even load `using-vibekit` at session start. Live probes on this machine (Codex 0.171.0, OpenCode v2.0.32, pi 1.4.0 with gpt-6-luna, agy 1.5.14) confirmed each runtime can inject start-up text and deny a tool call with a reason the model reads.

## Goals

1. One rule everywhere. A file edit in a main session is denied until a pipeline skill (every skill with `gate: hard` or `command: true`) and every modifier (every skill whose description ends `Stays on after.`) has been loaded in that session. Subagents pass. `VIBEKIT_GATE=off` turns the check off. A guard that cannot read its session state allows the edit. The deny reason is one text, built in one place in `lib/`, naming the missing skills in order. Observable: a test asserts the reason each adapter produces equals the `lib/` text for the same missing list.
2. Codex. The shared `hooks/edit-gate` counts a skill as loaded when a record line that is a tool call (`custom_tool_call` or `function_call`) names `<skill>/SKILL.md`. Observable: tests feed fixture records shaped like the probed Codex rollout lines and get allow or deny as expected, and a record that only lists skill paths outside a tool call is denied.
3. Antigravity. `runtimes/antigravity.mjs` emits a root `hooks.json` with a `SessionStart` hook that injects `using-vibekit` as `injectSteps` and a `PreToolUse` hook on `write_file|edit_file` that runs `hooks/edit-gate`. `hooks/edit-gate` reads agy's camelCase input (`transcriptPath`, `toolCall`), counts a `read_file` tool call naming `<skill>/SKILL.md`, and denies with `{"decision":"deny","reason":...}`. Observable: generator tests on `hooks.json`, edit-gate tests with agy-shaped fixtures, a session-start test for the `injectSteps` shape, and `agy plugin validate . --json` reporting at least 1 hook.
4. OpenCode. The generated `.opencode/plugins/vibekit.js` pushes `using-vibekit` into the system prompt through `ctx.session.hook("context")`, tracks loaded skills per session from `skill` tool calls (`ctx.tool.hook("execute.after")`) and `session.skill.activated` events, and denies `edit` permission through `ctx.permission.hook("evaluate")` with the shared reason, letting sessions with a `parentID` through. Observable: a test loads the generated plugin with a fake `ctx` and checks deny, allow, the subagent pass and the injected text.
5. pi. A generated extension declared in `package.json`'s `pi.extensions` appends `using-vibekit` to the system prompt in `before_agent_start`, tracks skills from `read` calls on `<skill>/SKILL.md` and from `<skill name="...">` blocks in the prompt, and returns `{ block: true, reason }` for `write` and `edit` with the shared reason. Observable: a test loads the extension with a fake `pi` and checks deny, allow and the injected text.
6. `npm test` and `npm run check` exit 0.

## Non-goals

- Guarding shell commands that write files, on any runtime.
- Exempting subagents on pi, which has no built-in subagent tool.
- Windows behaviour of the Antigravity hook command.
- Live end-to-end runs in each runtime as part of the checks.

## Constraints

- No new dependency.
- Generated files change only through `npm run generate`.
- Every edited string obeys `plain`'s rules, which `npm test` checks.
- Claude Code keeps the deny shape and matcher it has on branch `fix/gate-deny-reason`. The reason text becomes runtime-neutral: it asks the model to load each missing skill, since only Claude Code has a Skill tool.
- An adapter that hits an error while checking allows the edit. pi blocks a tool when its handler throws, so the pi handler catches every error itself.
- A change under `hooks/` is not done until the `hook (windows-latest)` CI job passes.
- Run limits: at most 3 verify rounds, at most $0 on paid runs

## Approach

Pushback: a smaller version would load the start-up instructions everywhere and keep the guard on Claude Code and Codex only. Outcome, decided in a `repl` run: the larger framing, because sessions on 0.10.1 and 0.10.2 skipped written instructions and only the guard caught it.

The user chose to guard file-edit tools only, not shell commands.

Three runtimes hand a hook a session record, so they share `hooks/edit-gate`. Its pipeline-skill and modifier lists still arrive as arguments. It finds the record path under `transcript_path` or `transcriptPath`, exempts input carrying `agent_id`, and counts a skill as loaded when a `Skill` call, a `/vibekit:<name>` command, or a tool-call line naming `<name>/SKILL.md` appears. It prints Claude's deny shape, or agy's when the input carries `toolCall`. Codex already loads `hooks/hooks.json`, and its probe showed the `Write|Edit|NotebookEdit` matcher catches `apply_patch`. Antigravity gets its own root `hooks.json`, with commands relative to the plugin folder, which agy runs hooks in. `hooks/session-start` takes an optional runtime argument and prints agy's `injectSteps` shape when given `antigravity`.

OpenCode and pi run plugin code inside the session, so they track loaded skills in memory, per session id, and need no record. The generator bakes the pipeline list, the modifier list and the reason builder into each generated file, using the same `lib/` functions the Claude hook command uses.

## Alternatives considered

- Start-up instructions everywhere and the guard on Claude Code and Codex only. Smaller, rejected in the pushback.
- One Node guard script for the three record-based runtimes. Hooks start through `run-hook.cmd` under bash on every platform, and Node is not guaranteed on a user's PATH there.
- Matching any mention of `<skill>/SKILL.md` in a record. Codex and agy put skill paths into prompts, so the guard would always pass.

## Testing

Unit tests per adapter with fixtures shaped like the probed inputs and records, generator tests for the new and changed files, a pin test tying the bash reason to the `lib/` reason, `agy plugin validate . --json`, then `npm test`, `npm run check` and the Windows `hook` CI job. Live runs in each runtime are unseen.

## Open questions

N/A: every question was answered by the user, by the live probes, or decided in the `repl` run.
