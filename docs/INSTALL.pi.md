# Installing Vibekit for Pi

Enable vibekit skills, the `/vibe` slash command, and using-vibekit priming inside the [pi coding agent](https://github.com/badlogic/pi-mono).

## Prerequisites

- `@mariozechner/pi-coding-agent` installed globally:
  ```bash
  npm install -g @mariozechner/pi-coding-agent
  ```
- An API key or subscription configured for pi (`/login` or env var). See [pi's README](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md#providers--models).

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

## Uninstall

```bash
pi remove git:github.com/rizukirr/vibekit
```
