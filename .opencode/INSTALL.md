# Installing Vibekit for OpenCode

## 1) Add plugin entry

Add vibekit to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["vibekit@git+https://github.com/rizukirr/vibekit.git"]
}
```

This enables plugin hooks (bootstrap injection and skill path registration).

## 2) Install command

OpenCode plugins and slash commands are loaded separately. To use `/vibe` globally, copy the command file into your global commands directory:

```bash
mkdir -p ~/.config/opencode/commands
cp .opencode/commands/vibe.md ~/.config/opencode/commands/vibe.md
```

If you prefer project-local commands instead, copy this file into `<project>/.opencode/commands/`.

## 3) Restart OpenCode

Restart OpenCode so plugins and commands reload.

## 4) Verify

- Use the `skill` tool to list skills.
- Confirm you can see `vibe`, `brainstorm-lean`, `plan-write`, and other vibekit skills.
- Confirm the slash command works:

```bash
opencode run --command vibe "add a hello endpoint"
```

## Troubleshooting

If `/vibe` does not appear in autocomplete or returns unknown command:

1. Confirm the plugin line exists in `opencode.json`.
2. Confirm command file exists at `~/.config/opencode/commands/vibe.md` (or project-local `.opencode/commands/vibe.md`).
3. Restart OpenCode after config changes.
4. If needed, clear vibekit package cache and restart OpenCode:

```bash
rm -rf ~/.cache/opencode/packages/vibekit@git+https:/github.com/rizukirr/vibekit.git
```
