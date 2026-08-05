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
| Plan approved, implementation not yet started | `exec` | hard |
| First moment of any coding work — invoke once, then it stays on | `lazy` | none |
| Spec approved, implementation not yet started | `plan` | hard |
| First response of the session — invoke once, then it stays on | `terse` | none |
| Session start | `using-vibekit` | none |
<!-- /vibekit:generated -->
