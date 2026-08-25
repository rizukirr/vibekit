---
title: quick skill
date: 2026-08-12
status: approved
---

# quick skill — Design

## Problem

vibekit has one door: `/vibekit:vibe` hands to `brainstorm`, which is a hard gate,
and `brainstorm` states the gate applies "regardless of perceived simplicity". For
a typo, a one-line guard, or a rename, the pipeline costs a spec doc, a plan doc,
a subagent dispatch and a verification report to produce a change smaller than any
one of those artifacts.

The escape hatch nominally exists: `using-vibekit` ranks the user's explicit
instructions above every skill, so "just fix it, skip the gates" is already
licensed. Two prior measurements on this repo say that is not enough:

- `stated-rules-do-not-bind` — prose added to a skill measured 0.00 against 0.00.
- `modifier-skills-must-be-invoked` — a description line measured 0/5 firing until
  the skill was invoked explicitly.

A permission that lives only in prose is the exact construct that measured zero.

`lazy` does not close the gap. It governs how short the code is once writing is
permitted; it grants no permission to write. Invoking `/vibekit:lazy` today loads
the ladder and leaves the `brainstorm` gate standing, so the user gets the
minimalism and none of the speed. `lazy` is also not a generated command — only
skills with `command: true` produce command files (`runtimes/claude-code.mjs:69`),
and `vibe` is currently the only one, so `/vibekit:lazy` does not exist at all in
Codex, opencode, gemini or pi.

## Goals

1. `npm run generate` emits `commands/quick.md` (`runtimes/claude-code.mjs:70`)
   and `commands/quick.toml` (`runtimes/codex.mjs:55`). Observable: both files
   exist after generation and `npm run check` passes.

   Amended 2026-08-12, user-approved. The original wording claimed an equivalent
   command surface for every runtime, which the emitters do not produce and no
   task could satisfy. Only two runtimes emit command files. `opencode` and `pi`
   have native skill support and are wired by skills-directory path
   (`runtimes/opencode.mjs:16-18`, `runtimes/pi.mjs:13`), so `quick` is
   discovered by living in `skills/`. `gemini` receives only a trigger-table row
   (`runtimes/gemini.mjs:23`). Extending the gemini emitter was considered and
   rejected as speculative until the missing command is actually felt.
2. `quick` appears as a row in the generated `CLAUDE.md` auto-trigger table with
   `gate: none` and a trigger reading that it never fires on its own. Observable:
   grep the generated table for the row.
3. The skill body states, in its own text, that `brainstorm`, `plan`, `exec` and
   `verify` do not apply on this path. Observable: those four names appear under a
   waiver heading in `skills/quick/SKILL.md`.
4. The skill body lists bail-out criteria as checkable facts, not judgement calls,
   and states that bailing means stopping and naming the tripped criterion rather
   than silently starting a spec. Observable: the criteria list is present and
   every entry is a fact about the change (dependency, schema, trust boundary,
   file count, ambiguous intent) rather than an adjective about its size.
5. The skill body preserves `lazy`'s never-simplify-away floor and requires the
   one runnable check to be executed before any claim of working, given no
   `verify` stage follows. Observable: both statements appear in the file.
6. The skill body states that `debug` is not waived. Observable: the statement
   appears in the file.
7. The ladder is not duplicated: the body invokes `lazy` rather than restating its
   rungs. Observable: no rung list in `skills/quick/SKILL.md`.
8. No existing skill, test or manifest is edited. Observable: the diff touches
   only `skills/quick/SKILL.md` plus generated files.

## Non-goals

- No eval scenario. `eval-n5-is-underpowered` records a 0.80 to 0.40 swing with no
  code change; a number at the harness's current n would mislead rather than
  inform. Revisit at n>=10.
- No auto-trigger. `quick` is reachable only by an explicit keystroke.
- No change to `vibe`, `lazy`, `terse`, or the pipeline skills.
- No formal escalation handoff that invokes `brainstorm` automatically on bail-out
  (see Alternatives).
- No repo description change. Discussed in the same session; tracked separately.

## Constraints

- v2 authoring contract: one directory, `skills/quick/SKILL.md`, frontmatter is
  the only registry. `name` must equal the directory (`lib/model.mjs:62`). No
  entry in `package.json` or `vibekit.config.json`.
- `npm run generate` must be run after; `npm run check` fails otherwise.
- Generated files are committed. Never hand-edit them.
- Zero dependencies, enforced by convention.
- The name `lazy` is unavailable: `skills/lazy/` exists and directory and
  frontmatter name must match.

## Approach

A new command skill, `skills/quick/`, with `command: true`, `gate: none`, and a
trigger copied in shape from `vibe`: invoked explicitly as a slash command, never
fires on its own.

The body has four parts: the waiver, the bail-out criteria, the surviving floor,
and the disclosure line. It invokes `lazy` rather than restating the ladder, so
one copy of the ladder exists and a change to `lazy` propagates instead of
drifting. `debug` is explicitly not waived — `quick` skips the gates before
implementation, never the one after a failure.

**Pushback and response.** The challenge raised was that the escape hatch already
exists, since `using-vibekit` ranks explicit user instructions above every skill,
making a new skill worth only a few keystrokes. The user chose the larger framing.
The two measurements cited under Problem support that choice: on this repo, prose
permission has twice measured as no permission at all.

**Accepted consequence.** Two command skills now point at opposite policies —
`vibe` refuses to skip `brainstorm`, `quick` skips it by definition. This is
intended: two doors, each labelled, rather than one door with a hidden bypass. It
was raised explicitly during design and approved.

## Alternatives considered

**Add the skip to `vibe` as an argument prefix** (`/vibekit:vibe quick: ...`).
Zero new files, the laziest rung that meets the requirement. Rejected because
`vibe`'s current value is that it does exactly one thing and cannot be talked out
of it — "never skip `brainstorm` because the intent looks small" is written into
it. Putting the skip inside the skill that forbids the skip blurs both halves.

**Add `command: true` to `lazy`.** Makes `/vibekit:lazy` a real command across all
runtimes for a one-word diff. Rejected because it lands on a modifier that governs
how code is written, not on something that writes it — the skill whose rule is
"shorten the solution, never the reading" would become the skill that skips the
reading.

**A line in `using-vibekit` waiving the gates on request.** Rejected on the two
measurements under Problem.

**Formal escalation handoff on bail-out** (stop, then invoke `brainstorm` with the
original intent). Strictly better behaviour, strictly more surface. Deferred: an
escalation that fires too eagerly makes the fast path useless — the user types
`/quick`, gets a lecture and a spec, and stops using it. That failure is worse
than no skill, because it trains disuse. Ship bail-out as advice first, formalise
after observing a misfire.

## Testing

- `npm run check` — validation runs inside generation, so a malformed skill cannot
  reach a manifest.
- `npm test` — existing tests use synthetic skill fixtures, not real skill names,
  so none require edits. A pass confirms the new directory breaks nothing.
- Inspect generated output: `commands/quick.md`, `commands/quick.toml`, the
  `CLAUDE.md` auto-trigger table row, and the README skill list emitted by
  `runtimes/core.mjs`.
- Manual smoke: type `/vibekit:quick` on a one-line change and confirm no spec
  doc, plan doc or verification report is written, and that the closing
  disclosure names what was skipped.

## Open questions

1. Exact file-count threshold in the bail-out criteria. "More than a few files" is
   the current wording; a hard number is checkable but arbitrary, and a wrong
   number bails on work the fast path should handle. Resolve during drafting by
   writing the criterion and reading it back, per
   `line-budgets-set-before-drafting-are-predictions`.
2. Whether the disclosure line should also name the bail-out criteria that were
   checked and passed, or only what was skipped. The former is more auditable and
   longer.
