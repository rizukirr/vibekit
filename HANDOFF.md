# Handoff: test vibekit on Windows

You are testing vibekit on a Windows machine. vibekit is a skills plugin for coding agents. This checkout is `main` after PR #73 ("runtime guard"), which is not released yet, so every test runs against this local checkout, never an installed release.

Two things must work on every runtime:

- **Start-up text.** When a session starts, vibekit's `using-vibekit` skill is injected. The model can tell you it "has vibekit".
- **Edit guard.** In a main session, the first file write or edit is denied until the session has loaded `quick` (or another pipeline skill) and the modifiers `lazy`, `plain` and `terse`. The denial reason reads: `vibekit denied this edit, so the file was not changed. Load each of these vibekit skills first, in order: vibekit:quick vibekit:lazy vibekit:plain vibekit:terse. ...` (only the missing ones are named). After the model loads them, the same write goes through. `VIBEKIT_GATE=off` turns the guard off.

How it is wired, so you know where to look when something fails:

| Runtime | Start-up text | Guard |
|---|---|---|
| Claude Code | `hooks/hooks.json` SessionStart runs `hooks/run-hook.cmd session-start` | `hooks/hooks.json` PreToolUse runs `hooks/run-hook.cmd edit-gate ...` on Write, Edit, NotebookEdit |
| Codex | same `hooks/hooks.json` | same, the matcher also catches `apply_patch` |
| Antigravity (`agy`) | root `hooks.json` runs `./hooks/run-hook.cmd session-start antigravity` | root `hooks.json` runs `./hooks/run-hook.cmd edit-gate ...` on `write_file|edit_file` |
| OpenCode | `.opencode/plugins/vibekit.js`, context hook | same plugin, permission evaluate hook |
| pi | `.pi/vibekit.js`, before_agent_start | same extension, tool_call on write and edit |

`hooks/run-hook.cmd` is a polyglot: under `cmd.exe` its batch half finds Git Bash and runs the named bash script in `hooks/`. Without Git for Windows it exits 0 silently, which turns both features off.

## Rules for this run

- Ask the user before installing anything, before changing any global config (`~/.claude`, `~/.codex`, `~/.config/opencode`, `~/.pi`, `~/.gemini`), and before any push. Prefer per-session flags and scratch folders.
- Do not fix anything during the run. Record what failed with the exact command and output, then report. A fix comes after, through the normal vibekit flow.
- Run every live agent test from a new empty scratch folder outside this repo, so a stray write cannot touch the checkout.
- Use a prompt that asks for a file without mentioning vibekit or any skill, for example: `create hello.txt containing the word hi`.

## Step 1: no-agent checks (do these first, they cost nothing)

From the repo root, in PowerShell or `cmd.exe`:

1. `git --version` and `where bash`. Record whether Git Bash is found. Everything below needs it.
2. `git ls-files --eol hooks/` and record the `w/` column for `edit-gate`, `session-start` and `run-hook.cmd`. `w/crlf` on a bash script is a likely cause of later failures (`$'\r': command not found`).
3. `node --version` (needs 24 or newer), then `npm test` and `npm run check`. Both should exit 0.
4. Run the Antigravity command exactly as agy will, from the repo root in `cmd.exe`:
   `cmd /c "./hooks/run-hook.cmd session-start antigravity" < nul`
   Pass: it prints JSON starting with `{` and containing `injectSteps`. Fail: an error such as `'.' is not recognized`. This is the most likely Windows break, because `cmd.exe` may read the `/` as a switch.
5. Run the guard by hand through the wrapper, in `cmd.exe`:
   `echo {"toolCall":{"name":"write_file"},"transcriptPath":"C:\\nonexistent.jsonl"} | cmd /c "./hooks/run-hook.cmd edit-gate quick lazy"`
   Pass: no output and exit 0 (an unreadable record lets the edit through). Then repeat with `hooks\run-hook.cmd` instead of `./hooks/run-hook.cmd` and record whether both forms behave the same.

## Step 2: live checks, one runtime at a time

For each runtime that is installed, record: the version, whether the start-up text arrived (ask the model `do you have vibekit? quote the first line of what you were given about it`), whether the first write was denied with the reason above, whether the write then succeeded after the skills loaded, and the exact denial text it saw.

1. **Claude Code.** `claude --plugin-dir <absolute path to this checkout>` from the scratch folder. The session record path on Windows looks like `C:\Users\<you>\.claude\projects\...\<id>.jsonl`. If the first write goes through with no denial, the guard probably could not read that path. Check by running step 1.5 with that real path.
2. **Codex.** Ask the user how they want vibekit installed from this checkout (`codex plugin marketplace add <path>` changes global config). Codex asks once to trust plugin hooks. Record that prompt. If no denial ever appears, check whether `CLAUDE_PLUGIN_ROOT` is set for Codex hooks on Windows and whether bash is used.
3. **Antigravity.** Ask before `agy plugin install <path to this checkout>`. Then `agy -p "create hello.txt containing the word hi" --mode accept-edits` from the scratch folder. If step 1.4 failed, expect both features to be off here.
4. **OpenCode.** Load `.opencode/plugins/vibekit.js` from this checkout through a project-local `opencode.json` in the scratch folder if possible, otherwise ask the user. See `.opencode/INSTALL.md`.
5. **pi.** `pi -e <checkout>\.pi\vibekit.js --skill <checkout>\skills\quick` plus one `--skill` per skill you need, from the scratch folder, with `-p` and `< nul` (without `< nul` pi waits on stdin). pi's ChatGPT login only accepted model `gpt-6-luna` on the Linux box, so pass `--model gpt-6-luna` if the default model is rejected.

## Report

Write the results to `windows-test-results.md` in the repo root (do not commit it) and give the user a short summary. Use one table row per check:

| Check | Result | Evidence |
|---|---|---|
| 1.4 agy session-start command | pass or fail | the command and its output |

End with every failure, its most likely cause, and which file a fix would touch. Say plainly which checks you could not run and why.
