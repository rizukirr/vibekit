# vibekit

Guardrailed vibe-coding pipeline. Skills auto-trigger at their trigger points.

## Auto-trigger map

<!-- vibekit:generated:trigger-table -->
| Trigger condition | Skill | Gate |
|---|---|---|
| About to start creative or implementation work, before code is written | `brainstorm` | hard |
| A check failed: verify returned not ready on a failed check, an exec clause failed, or a failure was reported | `debug` | hard |
| Plan approved, implementation not yet started | `exec` | hard |
| First moment of any coding work, invoke once, then it stays on | `lazy` | none |
| Spec approved, implementation not yet started | `plan` | hard |
| Invoked explicitly as a slash command, never fires on its own | `quick` | none |
| First response of the session, invoke once, then it stays on | `terse` | none |
| Session start | `using-vibekit` | none |
| Implementation complete, before any claim that work is done | `verify` | hard |
| Invoked explicitly as a slash command, never fires on its own | `vibe` | none |
<!-- /vibekit:generated -->

## Contributing

Adding a skill is creating one directory under `skills/`. Run `npm run generate`
afterwards; never hand-edit a generated file.
