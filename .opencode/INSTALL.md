# Installing vibekit for opencode

Requires opencode v2.

## Local checkout

opencode v2 reads the skills directory of a local checkout directly. Add it to the `skills` array in your `opencode.json`:

```json
{
  "skills": ["/path/to/local/vibekit/skills"]
}
```

Replace `/path/to/local/vibekit` with the absolute path to your checkout. With this route the skills are listed by `opencode api skill.list`, and `opencode plugin list` has no vibekit row.

## Git repository

This form is available once vibekit is published to the repository's default branch:

```json
{
  "plugin": ["vibekit@git+https://github.com/rizukirr/vibekit.git"]
}
```

## Verify

Run `opencode reload`, then:

```
opencode plugin list
```

The list has a row whose ID is `vibekit`.

That row shows opencode found the plugin. It stays when the plugin then failed to register its skills, so check those too. From your project directory:

```
opencode api skill.list -H "x-opencode-directory:$PWD" | grep -c '"id":"using-vibekit"'
```

It prints `1` when the skills are registered and `0` when they are not. This check also works for a local checkout added through the `skills` array.

If you already have a skill with the same name as a vibekit skill, opencode uses yours and drops the vibekit one without a warning. The vibekit skill names are common words such as `plan`, `debug` and `verify`, so check for a clash.

Each runtime installs separately; installing here does not affect any other.
