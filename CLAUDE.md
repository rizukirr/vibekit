# vibekit

Guardrailed vibe-coding pipeline. Skills auto-trigger at their trigger points.

## Auto-trigger map

<!-- vibekit:generated:trigger-table -->
| Trigger condition | Skill | Gate |
|---|---|---|
| Escalated by quick, or invoked by vibe or repl | `brainstorm` | hard |
| A check failed: verify returned not ready on a failed check, an exec clause failed, or a failure was reported | `debug` | hard |
| Loaded by repl or quick at the start of its run, never fires on its own | `decide` | none |
| Plan approved, implementation not yet started | `exec` | hard |
| First moment of any coding work, invoke once, then it stays on | `lazy` | none |
| Before the first text of the session is written, whether prose or a file, invoke once, then it stays on | `plain` | none |
| Spec approved, implementation not yet started | `plan` | hard |
| About to start creative or implementation work, before code is written | `quick` | hard |
| Invoked explicitly as a slash command, never fires on its own | `repl` | none |
| A run ended, and a debug report in it carried a Class: other than none | `retro` | none |
| First response of the session, invoke once, then it stays on | `terse` | none |
| Implementation complete, before any claim that work is done | `verify` | hard |
| Invoked explicitly as a slash command, never fires on its own | `vibe` | none |
<!-- /vibekit:generated -->

## Contributing

Adding a skill is creating one directory under `skills/`. Run `npm run generate`
afterwards; never hand-edit a generated file.

## Rules

- For cmd.exe batch behaviour, measure the construct in Windows CI before building a fix on it. This Linux box cannot run batch.
- Skills invoked in this repo load from the installed plugin cache (`~/.claude/plugins/cache/.../vibekit/<version>`), not from `skills/` here. After changing a skill, the session keeps running the old text until the plugin is updated.
- `docs/` is gitignored. Specs and plans are committed with `git add -f`, and a fresh worktree has no `docs/specs/` until you create it.
- Before opening or updating a PR, run `git rm -r --cached --ignore-unmatch docs` and commit, so specs and plans never reach `main`. The files stay on disk.
- A change under `hooks/` is not done until the `hook (windows-latest)` CI job passes. Push and read it before `verify` returns ready.
