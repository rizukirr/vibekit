# Installing vibekit for opencode

## Local checkout

Add a local checkout to the `plugin` array in your `opencode.json`:

```json
{
  "plugin": ["/path/to/local/vibekit"]
}
```

Replace `/path/to/local/vibekit` with the absolute path to your checkout.

## Git repository

This form is available once vibekit is published to the repository's default branch:

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
