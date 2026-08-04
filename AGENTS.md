# vibekit

Guardrailed vibe-coding pipeline. Skills are referenced from this file and
invoked by following the named workflow.

## Auto-trigger map

<!-- vibekit:generated:trigger-table -->
| Trigger condition | Skill | Gate |
|---|---|---|
| About to start creative or implementation work, before code is written | `brainstorm` | hard |
| Never — this is a build fixture | `example-command` | none |
| Never — this is a build fixture | `example-plain` | hard |
| Any coding work — writing, adding, refactoring, fixing, or designing code | `lazy` | none |
| Every response — compress conversation, never compress artifacts | `terse` | none |
| Session start | `using-vibekit` | none |
<!-- /vibekit:generated -->
