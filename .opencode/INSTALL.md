# Installing Vibekit for OpenCode

## 1) Add plugin entry

Add Vibekit's scoped npm package to the `plugin` array in one of these OpenCode configuration files:

- **Global (all projects):** `~/.config/opencode/opencode.json`
- **Project-specific:** `<project-root>/opencode.json`

OpenCode also accepts `opencode.jsonc`. If you set the `OPENCODE_CONFIG` environment variable, edit the custom file it names instead.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@rizukirr/vibekit"]
}
```

OpenCode installs configured npm plugins into its own package cache. This enables Vibekit's plugin hooks (bootstrap injection and skill path registration).

> [!IMPORTANT]
> `npm install @rizukirr/vibekit` and `npm install -g @rizukirr/vibekit` only download the package into npm's project or global directory. They do not add it to `opencode.json`, so they do not activate it in OpenCode. Use the configuration above even if you already downloaded the package with npm.

## 2) Install commands

OpenCode plugins and slash commands are loaded separately. To use Vibekit slash commands globally from a project-local npm install, copy the command files into your global commands directory:

```bash
mkdir -p ~/.config/opencode/commands
cp node_modules/@rizukirr/vibekit/.opencode/commands/*.md ~/.config/opencode/commands/
```

For a global npm install, the source is under the global npm root:

```bash
mkdir -p ~/.config/opencode/commands
cp "$(npm root -g)"/@rizukirr/vibekit/.opencode/commands/*.md ~/.config/opencode/commands/
```

If you are working from a Vibekit clone, use `.opencode/commands/*.md` as the source. If you prefer project-local commands, copy the files into `<project>/.opencode/commands/`.

## 3) Restart OpenCode

Restart OpenCode so plugins and commands reload.

## 4) Verify

- Use the `skill` tool to list skills.
- Confirm you can see `vibe`, `brainstorm-lean`, `plan-write`, and other vibekit skills.
- Confirm slash commands work:

```bash
opencode run --command vibe "add a hello endpoint"
opencode run --command vibekit-doctor
```

## Troubleshooting

If vibekit slash commands do not appear in autocomplete or return unknown command:

1. Confirm `@rizukirr/vibekit` appears in the `plugin` array in `opencode.json`.
2. Confirm command files exist at `~/.config/opencode/commands/` (or project-local `.opencode/commands/`).
3. Restart OpenCode after config changes.
4. If needed, clear vibekit package cache and restart OpenCode:

```bash
rm -rf ~/.cache/opencode/packages/vibekit
```
