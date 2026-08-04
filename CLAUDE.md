# vibekit

Guardrailed vibe-coding pipeline. Skills auto-trigger at their trigger points.

## Auto-trigger map

<!-- vibekit:generated:trigger-table -->
| Trigger condition | Skill | Gate |
|---|---|---|
| About to start creative or implementation work, before code is written | `brainstorm` | hard |
| Never — this is a build fixture | `example-command` | none |
| Never — this is a build fixture | `example-plain` | hard |
| Any coding work — writing, adding, refactoring, fixing, or designing code | `lazy` | none |
| Session start | `using-vibekit` | none |
<!-- /vibekit:generated -->

## Contributing

Adding a skill is creating one directory under `skills/`. Run `npm run generate`
afterwards; never hand-edit a generated file.
