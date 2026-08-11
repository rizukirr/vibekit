---
title: drop fixture skills
date: 2026-08-11
status: approved
---

# drop fixture skills — Design

## Problem

vibekit ships two skills that exist to test the build, and their own text says
they should be gone.

```
skills/example-command/SKILL.md:  Deleted once the real pipeline is authored.
skills/example-plain/SKILL.md:    Deleted once the real pipeline is authored.
```

The pipeline is authored. `brainstorm`, `plan`, `exec`, `verify`, `debug`,
`lazy`, `terse` and `using-vibekit` are all real, and the fixtures still ship
alongside them: two rows in each of the three generated trigger tables, two
entries in `README.md`'s skill list, and two directories inside the published
package. `opencode debug skill` lists them next to the real ones. Every user of
every runtime sees two skills whose trigger reads
`Never — this is a build fixture`.

The published `commands/` directory holds nothing else:

```
commands/example-command.md
commands/example-command.toml
```

`example-command` is the only skill in the repository with `command: true`, so
installing vibekit adds exactly one slash command and it is a fixture.

The command-emission path does **not** depend on them. `tests/claude-code.test.mjs:33-38`
and `tests/codex.test.mjs:20-33` already exercise it against `alpha` and `beta`,
fake skills in the `MODEL` fixture. Deleting the two directories costs no test
coverage. Recorded because the opposite was asserted during design and was
wrong: it turns what looked like a coverage question into a product question.

The product question is what should own vibekit's only slash command. v1 shipped
`/vibe` as the pipeline's entry point. v2 dropped it and ships no command at all
beyond the fixture's.

## Goals

- The fixtures are gone. Observable: `ls skills/` names neither
  `example-command` nor `example-plain`, and `npm test` exits 0.
- Nothing generated still mentions them. Observable:
  `grep -rn example- CLAUDE.md AGENTS.md GEMINI.md README.md commands/` exits 1.
- `/vibekit:vibe` exists. Observable: `npm run generate` produces
  `commands/vibe.md` and `commands/vibe.toml`, and both name the `vibe` skill.
- `vibe` does not compete with `brainstorm` for a trigger. Observable: the
  generated trigger table's `vibe` row says the skill is invoked explicitly and
  never fires on its own.
- The suite keeps its cheapest liveness check. Observable: scenario
  `skill-invocable` names a skill that exists in `skills/`.

## Non-goals

- A stage list inside `vibe`. It forwards to `brainstorm` and stops. v1's
  version enumerated seven stages and still names `isolate`, `review-pack` and
  `finish-branch`, three skills v2 does not have — a third copy of the chain is a
  third thing to keep in step.
- A slash command for any other skill. `brainstorm` is a gate that should fire
  whether or not anyone typed anything; making it opt-in inverts its purpose.
- Renaming `vibekit:example-plain` inside `evals/fixtures/*.jsonl`. Those are
  recorded transcripts used as parser test data. The skill need not exist for
  them to parse, and editing recorded evidence to match a later decision is the
  habit this project refuses everywhere else.
- Removing `command: true` from the emitters. It gains a real user here.
- Any change to another skill's text.

## Constraints

- Dependency free.
- No shipped file under `skills/`, and none of the generated context files, may
  name a project vibekit borrows from.
- Generated files are never hand-edited. `commands/example-command.*` are removed
  by the generator through `.vibekit-manifest`, not by hand.
- `evals/` never ships.
- No paid eval run. No skill under measurement changes, and `skill-invocable`
  moves to a different target rather than a different claim.

## Approach

### The skill

`skills/vibe/SKILL.md`, deliberately thin:

```markdown
---
name: vibe
description: Run a short intent through the pipeline. Invoked as /vibekit:vibe; hands off to brainstorm and does nothing else.
trigger: Invoked explicitly as a slash command — never fires on its own
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
```

The trigger line is the one doing work. `using-vibekit`'s auto-trigger map is
generated from every skill's `trigger`, so a `vibe` row claiming "user gives a
short intent" would compete with `brainstorm` for the moment `brainstorm` already
owns, and the gate would race its own entry point. Declaring that it never
self-fires costs nothing, because a slash command is explicit by construction.

`gate: none` for the same reason: it gates nothing, `brainstorm` does.

### The removals

`skills/example-command/` and `skills/example-plain/` are deleted. The generator
removes their command files on its own — `.vibekit-manifest` records what was
emitted, and `planChanges` removes anything the manifest names that is no longer
emitted.

### The two hand edits

- `tests/skeleton.test.mjs:17` asserts `['using-vibekit', 'example-command',
  'example-plain']` each carry a `SKILL.md`. It becomes `['using-vibekit',
  'vibe']`: the bootstrap skill and the commanded skill, the two whose absence
  breaks something a user touches.
- `evals/scenarios.json`, scenario `skill-invocable`, repoints from
  `vibekit:example-plain` to `vibekit:lazy`. Same claim — can the Skill tool load
  a vibekit skill at all, on haiku at n=3 — against a target that will still
  exist. It does not collide with `lazy-reachable`, which asks whether `lazy`
  fires organically after `brainstorm` on sonnet.

## Alternatives considered

- **Delete the fixtures and ship no command.** Coherent, and it leaves v2 with no
  entry point at all. Rejected by the user, who asked for the slash command.
- **Give `brainstorm` the command.** Rejected: it is a hard gate meant to fire
  automatically, and the users who would type `/vibekit:brainstorm` are the ones
  already being gated correctly.
- **Delete `command: true` from both emitters.** Rejected: it gains a user here,
  and the emission path is already tested.
- **Port v1's seven-stage `vibe`.** Rejected as a non-goal above.

## Testing

Unit:

- `skills/vibe/SKILL.md` exists and its frontmatter carries `command: true`.
- `tests/skeleton.test.mjs` names only skills that exist.
- `npm run check` exits 0 after `npm run generate`, proving no generated file
  drifted and that the fixture command files were removed by the generator.

There is no new emitter test. The command path is already covered synthetically
against `alpha` and `beta`; adding a third assertion against a real skill would
test the fixture, not the code.

Manual, by the user, unmeasured:

- `/vibekit:vibe <intent>` in Claude Code and in Codex, both of which have
  vibekit installed from this checkout.

## Open questions

- **No automated check covers whether a slash command works in any runtime.**
  The command files are generated and unit-tested against their expected shape,
  which says nothing about whether a host accepts them — the same gap that hid
  four integration defects until 2026-08-11. A session's init event does carry a
  `slash_commands` array — it is visible in `evals/fixtures/skill-fired.jsonl` —
  but `evals/parse.mjs:36` reads only `event.skills` and discards it. So covering
  this needs a parser change and a new expectation key, not merely a scenario.
  Its own cycle, named here rather than implied.
- Whether a thin forwarding skill drifts fat. v1's did. Nothing here prevents it
  beyond the non-goal above.
