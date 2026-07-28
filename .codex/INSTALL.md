# Installing Vibekit for Codex

Vibekit ships with a Codex plugin manifest and marketplace snapshot metadata in this repo.

## Prerequisites

- Codex CLI with plugin marketplace support

## Installation

> [!IMPORTANT]
> `npm install @rizukirr/vibekit` and `npm install -g @rizukirr/vibekit` only download the package files. They do not register the plugin with Codex, and Codex does not automatically scan the global npm package directory for plugins or skills. Use the marketplace commands below even if you already installed the npm package.

```bash
codex plugin marketplace add rizukirr/vibekit
codex plugin add vibekit --marketplace vibekit
```

Restart Codex after installation. On first use, Codex will prompt you to review and trust the SessionStart hook.

## What gets loaded

- **Skills** are discovered from `./skills/` (declared in `plugin.json`).
- **SessionStart hook** (`./hooks/hooks.json` → `./hooks/session-start`) injects the `using-vibekit` priming layer at session start so the auto-trigger map fires for the rest of the pipeline.

## Verify

You can validate marketplace/plugin resolution with:

```bash
codex plugin list --marketplace vibekit
```

You should see `vibekit@vibekit` in the list.

If the command reports `No plugins found in marketplace 'vibekit'`, the marketplace has not been registered in the current Codex configuration. Run both installation commands above, then restart Codex and verify again.

## Updating

Re-run:

```bash
codex plugin marketplace remove vibekit
codex plugin marketplace add rizukirr/vibekit
```

## Uninstalling

```bash
codex plugin remove vibekit
codex plugin marketplace remove vibekit
```
