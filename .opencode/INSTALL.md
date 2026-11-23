# Installing vibekit for opencode

Requires opencode v2.

## Local checkout

opencode loads a plugin file placed in a `.opencode/plugins/` folder: your project's, or `~/.config/opencode/plugins/` for every project. Create `vibekit.js` there with this one line, so the plugin still finds its skills in your checkout:

```js
export { default } from 'file:///path/to/local/vibekit/.opencode/plugins/vibekit.js'
```

Replace `/path/to/local/vibekit` with the absolute path to your checkout, with forward slashes on Windows too, such as `file:///C:/Users/you/vibekit`. The `plugin` array of `opencode.json` does not load a local checkout: opencode 2.3.2 rejects a file path there and ignores a folder path.

## Git repository

This form is available once vibekit is published to the repository's default branch:

```json
{
  "plugin": ["vibekit@git+https://github.com/rizukirr/vibekit.git"]
}
```

## Verify

Run `opencode reload`, then check that the skills are registered. From your project directory:

```
opencode api skill.list -H "x-opencode-directory:$PWD" | grep -c '"id":"quick"'
```

It prints `1` when the skills are registered and `0` when they are not. `opencode plugin list` is no check here: it can print `No plugins found` while the plugin is loaded.

If you already have a skill with the same name as a vibekit skill, opencode uses yours and drops the vibekit one without a warning. The vibekit skill names are common words such as `plan`, `debug` and `verify`, so check for a clash.

Each runtime installs separately; installing here does not affect any other.
