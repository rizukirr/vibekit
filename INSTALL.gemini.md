# Install Vibekit for Gemini CLI

Use this file when asked to install Vibekit in Gemini CLI.

## Install

```bash
gemini extensions install https://github.com/rizukirr/vibekit
```

If prompted to trust the workspace, answer `y`.

## Pin to a known-good ref (optional)

```bash
gemini extensions install https://github.com/rizukirr/vibekit --ref a2bafc6 --consent
```

## Configure context file (one-time, after install)

Gemini CLI does not auto-discover skills from `./skills/` the way Claude Code, Codex, and opencode do. You must author a `GEMINI.md` file at the extension root that explicitly imports each skill you want loaded. `GEMINI.md` is gitignored as per-user local context, so this step runs once per install.

Minimum `GEMINI.md`:

```markdown
# Vibekit for Gemini CLI

Core workflow:
@./skills/vibe/SKILL.md

Pipeline stages:
@./skills/brainstorm-lean/SKILL.md
@./skills/plan-write/SKILL.md
@./skills/isolate/SKILL.md
@./skills/brief-compiler/SKILL.md
@./skills/exec-dispatch/SKILL.md
@./skills/report-filter/SKILL.md
@./skills/verify-gate/SKILL.md
@./skills/review-pack/SKILL.md
@./skills/finish-branch/SKILL.md

Cross-cutting:
@./skills/memory-dual/SKILL.md
@./skills/vibekit-doctor/SKILL.md
@./skills/ralph-loop/SKILL.md
```

The full skill list lives in `AGENTS.md` (the public skill table) — copy from there if vibekit's skill set has expanded since this guide was last touched.

## Verify

```bash
gemini extensions list
gemini extensions validate ~/.gemini/extensions/vibekit
```

In interactive Gemini CLI:

```text
/extensions list
```

## Update

```bash
gemini extensions update vibekit
```

## Uninstall

```bash
gemini extensions uninstall vibekit
```

## Local fallback

If GitHub installation fails, install from local path:

```bash
gemini extensions install /home/rizki/Projects/vibekit --consent
```
