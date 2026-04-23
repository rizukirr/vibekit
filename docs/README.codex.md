# Vibekit for Codex

Guide for using vibekit with OpenAI Codex via native skill discovery.

## Quick Install

Tell Codex:

```
Fetch and follow instructions from https://raw.githubusercontent.com/rizukirr/vibekit/refs/heads/main/docs/README.codex.md
```

## Manual Installation

### Prerequisites

- OpenAI Codex CLI
- Git

### Steps

1. Clone the repo:
   ```bash
   git clone https://github.com/rizukirr/vibekit.git ~/.codex/vibekit
   ```

2. Create the skills symlink:
   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/vibekit/skills ~/.agents/skills/vibekit
   ```

3. Restart Codex.

## Windows

Use a junction instead of a symlink:

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
cmd /c mklink /J "$env:USERPROFILE\.agents\skills\vibekit" "$env:USERPROFILE\.codex\vibekit\skills"
```

## Verify

```bash
ls -la ~/.agents/skills/vibekit
```

You should see a symlink (or junction on Windows) pointing to vibekit `skills/`.

## Updating

```bash
cd ~/.codex/vibekit && git pull
```

## Uninstalling

```bash
rm ~/.agents/skills/vibekit
```

Optionally delete the clone:

```bash
rm -rf ~/.codex/vibekit
```
