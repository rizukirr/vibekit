# Security policy

## Supported versions

Only the latest published release receives fixes. vibekit ships skills and a SessionStart hook, with no server, no network calls and no runtime dependencies, so upgrading is replacing the plugin.

## Reporting a vulnerability

Report privately through [GitHub Security Advisories](https://github.com/rizukirr/vibekit/security/advisories/new). Do not open a public issue for a vulnerability.

Include the affected version, the runtime you ran it under (Claude Code, Codex, opencode, Antigravity or pi), and the smallest reproduction you have. Expect an acknowledgement within seven days.

## Scope

In scope:

- The SessionStart hook in `hooks/`, which is the one executable surface every runtime loads.
- Generated manifests that could cause a runtime to load a file the repo did not intend to ship.
- Skill instructions that would push an agent into an unsafe command without the user seeing it.

Out of scope:

- Behaviour of the coding agents themselves. A skill is instructions, and the runtime decides what it executes.
- Anything requiring an already compromised machine or an attacker who can already edit the installed plugin directory.
