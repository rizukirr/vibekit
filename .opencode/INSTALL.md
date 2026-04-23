# Installing Vibekit for OpenCode

Add vibekit to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["vibekit@git+https://github.com/rizukirr/vibekit.git"]
}
```

Restart OpenCode. Vibekit skills are auto-registered from `skills/`.

## Verify

- Use the `skill` tool to list skills.
- Confirm you can see `vibe`, `brainstorm-lean`, `plan-write`, and other vibekit skills.
