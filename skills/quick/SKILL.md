---
name: quick
description: Use when the user types /vibekit:quick — writes the change immediately under lazy's ladder, no spec, no plan, no subagents. Reports what it skipped.
trigger: Invoked explicitly as a slash command — never fires on its own
gate: none
command: true
---

# quick

The fast path. One intent in, the change written now.

## The waiver

`brainstorm`, `plan`, `exec` and `verify` do not apply here. No spec doc, no plan
doc, no subagent dispatch, no verification report. That is the whole point of
typing this instead of `/vibekit:vibe`.

Invoke `lazy` and write under its ladder. Do not restate its rungs — one copy of
the ladder exists, and it lives in `lazy`.

## Bail out first

Check before writing. Each of these is a fact about the change, not a judgement
about its size:

- It needs a dependency that is not already installed.
- It touches a schema, a migration, or the shape of stored data.
- It touches auth, payments, permissions, or any other trust boundary.
- It spans more files than you can hold in one reading.
- The intent reads two ways.

Any one of them: stop, name the criterion that tripped, and say the request wants
`brainstorm`. Do not start a spec yourself, and do not negotiate — the user asked
for speed, and the honest answer is that this is not the path for it.

None of them: write the change now.

## The floor still holds

Nothing runs behind you, so `lazy`'s never-simplify-away list is not optional
here: validation at trust boundaries, error handling that prevents data loss,
security, accessibility, and anything the user explicitly asked for.

Non-trivial logic leaves one runnable check, and **you run it**. `verify` is not
coming. A change you did not execute is a change you are guessing about, and
"evidence or it did not happen" is not waived by speed.

## debug is not waived

A failed check routes to `debug` exactly as it always does. `quick` skips the
gates before implementation. It does not skip the one after a failure.

## Say what you skipped

Close with one line naming the skipped stages and the check you ran, so a fast
path never reads like a verified one:

> Skipped: brainstorm, plan, exec, verify. Ran: <the check, and its result>.
