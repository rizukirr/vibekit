# Handoff: test vibekit on Windows

You are testing vibekit on a Windows machine. vibekit is a skills plugin for coding agents. Test this local checkout, never an installed release.

One thing must work on every runtime: when a session starts, the full text of `quick`, `lazy`, `plain` and `terse` is in context, and the first block says "You have vibekit." There is no edit guard, so the first file write goes through.

How it is wired, so you know where to look when something fails:

| Runtime | Start-up text |
|---|---|
| Claude Code | `hooks/hooks.json` SessionStart runs `hooks/run-hook.cmd session-start <skill>` once per start skill |
| Codex | the same `hooks/hooks.json`. On Windows it runs `commandWindows` in PowerShell: `& "$env:PLUGIN_ROOT/hooks/run-hook.cmd" session-start <skill>` |
| Antigravity (`agy`) | root `hooks.json` runs `hooks\run-hook.cmd session-start antigravity <skill> \|\| ./hooks/run-hook.cmd session-start antigravity <skill>` once per start skill |
| OpenCode | `.opencode/plugins/vibekit.js`, context hook, one block per start skill |
| pi | `.pi/vibekit.js`, before_agent_start, one block per start skill |

`hooks/run-hook.cmd` is a polyglot: under `cmd.exe` its batch half finds Git Bash and runs the named bash script in `hooks/`. Without Git for Windows it exits 0 silently, which turns the start-up text off.

## Rules for this run

- Ask the user before installing anything, before changing any global config (`~/.claude`, `~/.codex`, `~/.config/opencode`, `~/.pi`, `~/.gemini`), and before any push. Prefer per-session flags and scratch folders.
- Do not fix anything during the run. Record what failed with the exact command and output, then report.
- Run every live agent test from a new empty scratch folder outside this repo.
- Use prompts that do not mention vibekit's skills, for example `create hello.txt containing the word hi`.

## Step 1: no-agent checks

From the repo root:

1. `git --version`, and check that `C:\Program Files\Git\bin\bash.exe` exists.
2. `git ls-files --eol` and record any entry with `w/crlf`. `.gitattributes` asks for LF everywhere.
3. `node --version` (needs 24 or newer), then `npm run check` and `npm test`. The submission tests need `zip` and `unzip` on PATH.
4. Run each Antigravity command from the root `hooks.json` exactly as agy would, from the repo root: `cmd /c <command> < nul`. Pass: JSON containing `injectSteps`.

## Step 2: live checks, one runtime at a time

For each installed runtime, record the version, then ask `do you have vibekit? quote the first line of what you were given about it`, then `create hello.txt containing the word hi`. Pass: the answer quotes the start-up text, and the file is written on the first try.

1. Claude Code: `claude --plugin-dir <absolute path to this checkout>` from the scratch folder. Turn off an installed vibekit for the session with `--settings` and `{"enabledPlugins":{"vibekit@vibekit":false}}`.
2. Codex: ask the user how to install from this checkout. Codex asks to trust plugin hooks once, in an interactive session. `codex exec` hides a failing hook, so check an interactive session for `Hook failed`.
3. Antigravity: ask before `agy plugin install <path to this checkout>`. Then `agy -p "create hello.txt containing the word hi" --mode accept-edits` from the scratch folder.
4. OpenCode: follow `.opencode/INSTALL.md`, Local checkout, with the one-line file in the scratch folder's `.opencode/plugins/`.
5. pi: `pi -e <checkout>\.pi\vibekit.js -ne -ns --no-session -p "<prompt>" < nul` from the scratch folder.

## Report

Write the results to `windows-test-results.md` in the repo root (do not commit it), one table row per check with the command and its output as evidence. End with every failure, its most likely cause and the file a fix would touch, and say which checks you could not run and why.
