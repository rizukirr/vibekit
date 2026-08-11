# Installing vibekit for opencode

Add it to the `plugin` array in your `opencode.json`, global or project-level:

```json
{
  "plugin": ["vibekit@git+https://github.com/rizukirr/vibekit.git"]
}
```

Restart opencode. Verify with:

```
opencode debug skill
```

Each runtime installs separately; installing here does not affect any other.
