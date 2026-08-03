---
name: example-command
description: Fixture skill that exercises slash-command emission.
trigger: Never — this is a build fixture
command: true
gate: none
---

# example-command

Build fixture. Proves that `command: true` produces `commands/example-command.md`
for Claude Code and `commands/example-command.toml` for Codex. Deleted once the
real pipeline is authored.
