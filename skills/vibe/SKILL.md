---
name: vibe
description: Run a short intent through the pipeline. Invoked as /vibekit:vibe. Hands off to brainstorm and does nothing else.
trigger: Invoked explicitly as a slash command, never fires on its own
gate: none
command: true
---

# vibe

An entry point, not a stage. The pipeline is already wired: every skill's
`Handoff` section names its successor, and `using-vibekit` carries the trigger
map. This exists because a slash command cannot exist without a skill to invoke.

## What to do

Invoke `brainstorm` with the user's intent. Stop there.

`brainstorm` gates the design, hands to `plan`, `plan` hands to `exec`, `exec`
hands to `verify`, and a failed check goes to `debug`. None of that is your
business to restate or to sequence.

## Never

- Never skip `brainstorm` because the intent looks small. That is the gate's
  whole purpose.
- Never carry out the intent yourself.
