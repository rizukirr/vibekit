# Installing Vibekit for Codex

Vibekit ships with a Codex plugin manifest and marketplace snapshot metadata in this repo.

## Prerequisites

- Codex CLI with plugin marketplace support

## Installation

```bash
codex plugin marketplace add rizukirr/vibekit
codex plugin add vibekit --marketplace vibekit
```

On first use, Codex will prompt you to review and trust the SessionStart hook.

## What gets loaded

- **Skills** are discovered from `./skills/` (declared in `plugin.json`).
- **SessionStart hook** (`./hooks/hooks.json` → `./hooks/session-start`) injects the `using-vibekit` priming layer at session start so the auto-trigger map fires for the rest of the pipeline.

## Verify

You can validate marketplace/plugin resolution with:

```bash
codex plugin list --marketplace vibekit
```

You should see `vibekit@vibekit` in the list.

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
