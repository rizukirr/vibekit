# drop fixture skills — Implementation Plan

**Spec:** docs/specs/2026-08-11-drop-fixture-skills-design.md
**Goal:** Delete the two build-fixture skills, and give vibekit's only slash command to a new thin `vibe` skill that forwards to `brainstorm`.
**Architecture:** One task adds `skills/vibe/`, one deletes the two fixtures and repoints the two references that name them. The generator does the rest — `.vibekit-manifest` drives removal of the orphaned command files, and the trigger tables, README skill list and package manifests are all regenerated.

## Global constraints
- Dependency free.
- No shipped file under `skills/`, and none of the generated context files, may name a project vibekit borrows from.
- Generated files are never hand-edited. The fixture command files are removed by the generator, not by hand.
- `evals/` never ships.
- No paid eval run.

### Task 1: the vibe skill and its command → verify: `npm run check` exits 0

**Files:**
- Create: `skills/vibe/SKILL.md`
- Create: `commands/vibe.md`
- Create: `commands/vibe.toml`
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`
- Modify: `GEMINI.md`
- Modify: `README.md`
- Modify: `.vibekit-manifest`

- [x] Step 1: Write `skills/vibe/SKILL.md`:

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

- [x] Step 2: Run `npm run generate` and record which paths it reports writing.
- [x] Step 3: Run `npm test`
- [x] Step 4: Confirm `commands/vibe.md` and `commands/vibe.toml` both exist and
      both name the `vibe` skill. If either is absent, `command: true` did not
      take; stop rather than hand-writing the file.
- [x] Step 5: Read the `vibe` row of the generated trigger table in `CLAUDE.md`
      and confirm its trigger column says the skill is invoked explicitly and
      never fires on its own. A row claiming a session moment would put `vibe`
      in competition with `brainstorm` for the gate `brainstorm` owns.
- [x] Step 6: Commit

### Task 2: delete the fixtures and repoint what named them → verify: `grep -rn example- CLAUDE.md AGENTS.md GEMINI.md README.md commands/` exits 1

**Files:**
- Delete: `skills/example-command/SKILL.md`
- Delete: `skills/example-plain/SKILL.md`
- Delete: `commands/example-command.md`
- Delete: `commands/example-command.toml`
- Modify: `tests/skeleton.test.mjs:16-20`
- Modify: `evals/scenarios.json:17-21`
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`
- Modify: `GEMINI.md`
- Modify: `README.md`
- Modify: `.vibekit-manifest`

- [ ] Step 1: Delete the directories `skills/example-command/` and
      `skills/example-plain/`. Do not delete anything under `commands/` by hand.
- [ ] Step 2: In `tests/skeleton.test.mjs`, replace the array in the test named
      `every stub skill has a SKILL.md`:

```js
  for (const name of ['using-vibekit', 'vibe']) {
```

- [ ] Step 3: In `evals/scenarios.json`, replace the `skill-invocable` scenario's
      prompt and expectation, leaving its `id`, `n` and `model` untouched:

```json
    "prompt": "Invoke the vibekit:lazy skill using the Skill tool, then stop.",
    "expect": { "skill": "vibekit:lazy" },
```

- [ ] Step 4: Run `npm run generate` and confirm it reports removing
      `commands/example-command.md` and `commands/example-command.toml`. If it
      does not, the manifest did not track them and the removal is not the
      generator's; stop and say so rather than deleting them by hand.
- [ ] Step 5: Run `npm test`, then `npm run check`
- [ ] Step 6: Run `ls commands/` and confirm the only entries are `vibe.md` and
      `vibe.toml`.
- [ ] Step 7: Commit
