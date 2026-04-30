# Installing Vibekit for Pi

Enable vibekit skills, the `/vibe` slash command, and using-vibekit priming inside the [pi coding agent](https://github.com/badlogic/pi-mono).

## Prerequisites

- `@mariozechner/pi-coding-agent` installed globally:
  ```bash
  npm install -g @mariozechner/pi-coding-agent
  ```
- An API key or subscription configured for pi (`/login` or env var). See [pi's README](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md#providers--models).

## Before you install — check for an existing install

Pi reads skills from several locations, including `~/.agents/skills/` (a runtime-shared location used by Codex's vibekit install). If you have already installed vibekit on this machine via another runtime — most commonly via the Codex install instructions, which symlink `~/.codex/vibekit/skills` → `~/.agents/skills/vibekit/` — pi will already see every vibekit skill from that path. **Running `pi install git:github.com/rizukirr/vibekit` on top of it is redundant** and will produce skill-collision warnings on every pi startup (functionally harmless: pi keeps the user-level copy and skips the package copy, but the noise is avoidable).

Quick check:

```bash
ls ~/.agents/skills/vibekit/ 2>/dev/null
```

If that lists the 14 skill directories, vibekit is already reachable on pi. You only need:

1. **Skip `pi install`.** Skills are already discovered. The `/skill:<name>` namespace works for every skill out of the box.
2. **Optional — add `/vibe` and the priming extension.** The shared `~/.agents/skills/` path delivers skills but not the pi-only `/vibe` prompt template or the `vibekit-prime` extension. To get those without re-shipping the skills, install vibekit project-locally with `-l` (it will still produce one-time collision warnings; if that's intolerable, see "Avoiding collisions" below).

If `~/.agents/skills/vibekit/` does not exist, proceed with the standard install below.

### Avoiding collisions

If you want both adapters cleanly without warnings, pick one source of truth:

- **Codex-shared (shared across runtimes):** install via [`docs/INSTALL.codex.md`](../.codex/INSTALL.md) once, then point pi at the same path by adding `~/.agents/skills` to pi's `settings.skills` array (see [pi's docs/skills.md "Using Skills from Other Harnesses"](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/skills.md#using-skills-from-other-harnesses)). Add a thin pi-package install with `pi install git:github.com/rizukirr/vibekit -l --skills ./empty` if you only need `/vibe` + the extension — or just copy `.pi-plugin/prompts/vibe.md` and `.pi-plugin/extensions/vibekit-prime.ts` into your project's `.pi/prompts/` and `.pi/extensions/` manually.
- **Pi-only:** if you don't use Codex, ensure `~/.agents/skills/vibekit/` does not exist (delete the symlink if you previously ran the Codex install) and use the standard `pi install` below.

## Install

Install vibekit as a pi package directly from the git repo:

```bash
pi install git:github.com/rizukirr/vibekit
```

For project-local installs (vibekit lives only inside the current project's `.pi/`), add `-l`:

```bash
pi install git:github.com/rizukirr/vibekit -l
```

Pi reads vibekit's `package.json` `pi` key and registers:

- All 14 skills under `skills/` (auto-discovered via the `pi.skills` path).
- The `/vibe` slash command from `.pi-plugin/prompts/vibe.md`.
- The `vibekit-prime` extension from `.pi-plugin/extensions/vibekit-prime.ts`, which injects the using-vibekit priming body into every agent turn's system prompt.

## Verify

1. Confirm vibekit is registered:

   ```bash
   pi list
   ```

   Expected: `vibekit` appears in the installed-packages list.

2. Start pi and confirm `/vibe` is available:

   ```bash
   pi
   ```

   In the editor, type `/vibe` — autocomplete should show the entry with the description "Run the full vibe pipeline on a short intent…".

3. (Optional) Confirm priming reaches the system prompt. Inside pi, run `/settings` or use a debug extension that calls `ctx.getSystemPrompt()`. The string `<EXTREMELY_IMPORTANT>\nYou have vibekit.` should appear in the system prompt.

## Troubleshooting

If `/vibe` does not appear in autocomplete or skills do not load:

1. Confirm the package installed cleanly:

   ```bash
   pi list
   ```

2. Update vibekit and pi together:

   ```bash
   pi update
   ```

3. Clear the pi package cache and reinstall:

   ```bash
   rm -rf ~/.pi/agent/git/github.com/rizukirr/vibekit
   pi install git:github.com/rizukirr/vibekit
   ```

4. If priming is missing from the system prompt, confirm the extension loaded:

   ```bash
   pi --verbose
   ```

   Expected: `vibekit-prime` appears in the extension-load log without errors.

5. If pi shows "skill collision" warnings on startup (each vibekit skill listed twice — one from `~/.agents/skills/vibekit/`, one from `~/.pi/agent/git/.../vibekit/skills/`), you have both the Codex install and the pi-package install delivering the same skills. The warnings are benign — pi keeps the `~/.agents/` copy and skips the package copy. To silence them, see "Before you install — check for an existing install" above; pick one source of truth.

## Uninstall

```bash
pi remove git:github.com/rizukirr/vibekit
```
