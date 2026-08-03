# vibekit

Guardrailed vibe-coding pipeline for coding agents. Dependency free.

## Skills

<!-- vibekit:generated:skill-list -->
- `example-command` — Fixture skill that exercises slash-command emission.
- `example-plain` — Fixture skill that exercises the plain-skill path.
- `using-vibekit` — Use when starting any conversation — establishes vibekit's auto-trigger discipline.
<!-- /vibekit:generated -->

## Runtime support

| Runtime | Emitter | Verified |
|---|---|---|
| Claude Code | `runtimes/claude-code.mjs` | Yes — SessionStart hook smoke-tested in CI on Linux and Windows |
| Codex | `runtimes/codex.mjs` | **No** — output shape is modelled on a previously-shipped package, never confirmed against a live Codex install |

The Codex emitter's tests assert that it produces what we decided it should
produce, which says nothing about whether Codex accepts it. Treat Codex support
as unproven until someone installs the generated plugin and reports back.

## Install

Claude Code: `/plugin marketplace add rizukirr/vibekit`

## Development

- `npm run generate` — regenerate every derived file
- `npm run check` — fail if any generated file is out of date
- `npm test` — run the unit tests
