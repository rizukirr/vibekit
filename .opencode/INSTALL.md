# Installing Vibekit for OpenCode

## 1) Add plugin entry

Add vibekit to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["vibekit@git+https://github.com/rizukirr/vibekit.git"]
}
```

This enables plugin hooks (bootstrap injection and skill path registration).

## 2) Install commands

OpenCode plugins and slash commands are loaded separately. To use vibekit slash commands globally, copy the command files into your global commands directory:

```bash
mkdir -p ~/.config/opencode/commands
cp .opencode/commands/*.md ~/.config/opencode/commands/
```

If you prefer project-local commands instead, copy these files into `<project>/.opencode/commands/`.

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

1. Confirm the plugin line exists in `opencode.json`.
2. Confirm command files exist at `~/.config/opencode/commands/` (or project-local `.opencode/commands/`).
3. Restart OpenCode after config changes.
4. If needed, clear vibekit package cache and restart OpenCode:

```bash
rm -rf ~/.cache/opencode/packages/vibekit@git+https:/github.com/rizukirr/vibekit.git
```
