---
title: quick default
date: 2026-11-21
status: approved
---

# quick default: Design

## Problem

Every implementation request starts at `brainstorm`, which writes a spec, then `plan` writes a plan, then `exec` dispatches subagents and `verify` reports. For a big task that structure pays for itself. For a small task it spends tokens on documents nobody needed. `quick` exists as the fast path, but it only runs when the user types `/vibekit:quick`, it does no design thinking, and when its bail-out trips it tells the user to start `brainstorm` themselves.

The user wants `quick` to be the default: think through the design silently the way `repl` does, build in one go, and prove the result works. A gate inside `quick` catches a task that is too big and asks the user to move it to the normal flow or to `repl`, with a reason the user can follow.

## Goals

1. `quick` is the default for implementation work. Observable: the `trigger:` in `skills/quick/SKILL.md` is `About to start creative or implementation work, before code is written`, and the generated trigger table in `CLAUDE.md`, `AGENTS.md` and `rules/AGENTS.md` lists that trigger against `quick`.
2. `brainstorm` runs only on escalation or by explicit entry. Observable: the `trigger:` in `skills/brainstorm/SKILL.md` is `Escalated by quick, or invoked by vibe or repl`, and its `gate:` stays `hard`.
3. `quick` invokes `lazy`, `terse` and `plain` first. Observable: the first numbered step in `skills/quick/SKILL.md` invokes all three and says they stay on.
4. `quick` gates on facts. Observable: `skills/quick/SKILL.md` lists the six gate items (dependency not installed, schema or migration or stored data shape, auth or payments or permissions or trust boundary, more files than one reading holds, intent reads two ways, more than 3 separate things a user could see or use), says an item it cannot decide counts as tripped, and says a tripped gate stops before any edit.
5. A tripped gate asks the user in plain words. Observable: `skills/quick/SKILL.md` contains a gate question template that names the tripped item, gives a reason the result may not match what the user meant, offers the normal flow and `repl`, and accepts `quick anyway`. It requires words a 12-year-old would follow, with no file paths or jargon unless the user used them.
6. `quick anyway` keeps the floor. Observable: `skills/quick/SKILL.md` says `quick anyway` never waives `lazy`'s never-simplify-away list or `decide`'s one-way doors.
7. `quick` brainstorms silently. Observable: `skills/quick/SKILL.md` says it loads `decide`, answers brainstorm's questions itself with no spec file, no plan file, no subagents and no decision log, and prints `Reading: <goal>. Smallest change: <change>.` without waiting.
8. `quick` builds in units with a check after each. Observable: `skills/quick/SKILL.md` says it builds one user-visible thing at a time, at most 3, and runs that unit's check before starting the next.
9. `quick` proves the one fact the change relies on by running something. Observable: `skills/quick/SKILL.md` says "it compiles" and "I read it" do not count, and that when nothing can run it says so instead of claiming the work is done.
10. `quick` stops after two failed fixes. Observable: `skills/quick/SKILL.md` says a failed check goes to `debug`, its report is approved once its refuter has run, and after two failed fixes sharing an assumption `quick` stops, names the assumption and offers the normal flow.
11. `quick` closes with the evidence line. Observable: `skills/quick/SKILL.md` contains `Ran: <check> (<result>). Evidence: ran it | reproduced in app | could not run.` and does not contain `Skipped:`.
12. `decide` applies inside `quick`. Observable: `skills/decide/SKILL.md` says it is loaded by `repl` or `quick`, that in `quick` a pause means stop and ask the user, and that the one-way door about skipping pipeline steps applies only to `repl`.
13. `using-vibekit` matches the new default. Observable: `skills/using-vibekit/SKILL.md` says `quick`'s gate is the check every implementation request gets and `brainstorm` is where a request lands when that gate trips, and it keeps the 1% rule.
14. Evals match. Observable: in `evals/scenarios.json`, `brainstorm-precedes-code` expects `vibekit:quick` before Write, Edit and NotebookEdit, `quick-does-not-auto-fire` is replaced by `quick-auto-fires`, `quick-skips-brainstorm` is removed, `quick-bails-out` expects no Write or Edit and a final text naming both the normal flow and `repl`, `quick-discloses` matches `Ran:.*Evidence:`, and a new `quick-gates-big` scenario asks for 5 features and expects no Write or Edit and a final text naming `repl`.
15. `npm run check` exits 0 and `npm test` exits 0.

## Non-goals

- No change to `plan`, `exec`, `verify`, `debug`, `retro`, `repl` or `vibe`.
- No change to how `brainstorm` runs once it starts.
- No separate routing skill.
- No numeric size score beyond the feature count in the gate.
- Running the evals. They start paid model sessions, so the user runs them.

## Constraints

- Every edited string obeys `plain`'s rules, which `npm test` checks.
- Generated files are regenerated with `npm run generate`, never hand-edited.
- No shipped file names an outside source, as `tests/no-external-references.test.mjs` requires.
- Unfinished edits from a stopped `quick` run stay in the working tree. `quick` never reverts them.

## Approach

Rewrite `quick` in place and move the default trigger to it (approach A). `quick` runs, in order: invoke `lazy`, `terse` and `plain`, gate, silent brainstorm with `decide` and a printed `Reading:` line, build in units with a check after each, prove the one fact the change relies on, route failures to `debug` with a two-failure stop, close with the `Ran:` line.

Pushback outcome: the user accepted the smaller framing. The size gate reuses the existing fact-based bail-out list and adds one item, more than 3 separate things a user could see or use, instead of a standalone feature count.

Escalation targets: the gate offers both the normal flow and `repl`, and the user picks. `quick` never starts `repl` on its own.

The user asked that `terse` and `plain` be named in `quick` explicitly, not left to their session-start triggers, and that the close line drop `Skipped:` and start at `Ran:`.

## Alternatives considered

- B, swap triggers only: `quick` becomes default and its bail-out asks the user. Smallest diff, but small tasks get no design thinking.
- C, a new routing skill in front of `quick`, `brainstorm` and `repl`. Cleaner single jobs, but an extra skill, an extra hop on every task, and the rules split across two skills.
- A standalone "more than 3 features" gate. Rejected in the pushback: the count drifts with how the model reads the request.

## Testing

- `npm run generate`, then `npm run check` exits 0.
- `npm test` exits 0.
- Evals updated as goal 14 lists. The user runs `npm run eval` for the touched scenarios.

## Open questions

N/A: every question was answered during brainstorm.
