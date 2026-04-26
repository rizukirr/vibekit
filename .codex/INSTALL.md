# Installing Vibekit for Codex

Enable vibekit skills in Codex via native skill discovery. Clone and symlink — no bootstrap edits required.

## Prerequisites

- Git
- Codex CLI

## Installation

1. **Clone the vibekit repository:**
   ```bash
   git clone https://github.com/rizukirr/vibekit.git ~/.codex/vibekit
   ```

2. **Create the skills symlink:**
   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/vibekit/skills ~/.agents/skills/vibekit
   ```

   **Windows (PowerShell):**
   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
   cmd /c mklink /J "$env:USERPROFILE\.agents\skills\vibekit" "$env:USERPROFILE\.codex\vibekit\skills"
   ```

3. **Restart Codex** to discover the skills.

Codex auto-discovers all skills under `~/.agents/skills/`. The `using-vibekit` skill carries a `Use when starting any conversation` description so it fires on session start, loading the auto-trigger map for the rest of the pipeline.

## Verify

```bash
ls -la ~/.agents/skills/vibekit
```

You should see a symlink (or junction on Windows) pointing to the vibekit skills directory.

## Updating

```bash
cd ~/.codex/vibekit && git pull
```

Skills update instantly through the symlink.

## Uninstalling

```bash
rm ~/.agents/skills/vibekit
```

Optionally delete the clone: `rm -rf ~/.codex/vibekit`.
