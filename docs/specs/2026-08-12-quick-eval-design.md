---
title: quick skill evals
date: 2026-08-12
status: approved
---

# quick skill evals — Design

## Problem

`skills/quick/SKILL.md` merged in PR #32 (`298b75d`) entirely unmeasured. Its
verification report listed the gap explicitly: "whether the skill behaves as
written" was `Unseen`, because nothing in the repo executes it and the change is
entirely prose.

Two prior measurements on this repo say prose is exactly what fails to bind: a
stated rule measured 0.00 against 0.00, and a modifier's description line
measured 0/5 firing until it was invoked explicitly. `quick` is a skill made of
nothing but stated rules.

The harness can already reach it. `evals/session.mjs:96` passes `--plugin-dir`,
so scenarios measure the working tree rather than the installed plugin cache.

One property cannot be asserted with today's vocabulary. `expect.skill` requires
a hit (`evals/score.mjs:97-99`); there is no way to assert a skill did **not**
fire. That blocks the highest-risk test: `quick` declares "never fires on its
own", nothing enforces it mechanically, and a `quick` that auto-fires on ordinary
work and then correctly bails out to `brainstorm` would pass every scenario in
the file today while still being a hole in the guardrail. `vibe` carries the same
never-measured claim.

## Goals

1. `evals/score.mjs` accepts an `expect.skillAbsent` key naming one skill or an
   array of skills, and returns a reason string when any named skill fired.
   Observable: `npm test` passes with new unit coverage asserting both
   directions and the array form.
2. `skillAbsent` is listed in `KNOWN_EXPECTATIONS`, so the existing unknown-key
   guard (`evals/score.mjs:93-95`) keeps rejecting typos. Observable: a scenario
   using `skillAbsent` does not throw `unknown expectation`.
3. `evals/scenarios.json` contains five new scenarios with ids `quick-fires`,
   `quick-skips-brainstorm`, `quick-bails-out`, `quick-does-not-auto-fire` and
   `quick-discloses`. Observable: parsing the file yields those five ids.
4. Every scenario asserting absence also asserts something positive, so a
   session that did nothing fails rather than passing on the absence.
   Observable: each scenario carrying `skillAbsent` also carries `skill`.
5. Every new scenario uses `n: 10`. Observable: read the entries.
6. `npm run check` and `npm test` both exit 0. Observable: exit status.

## Non-goals

- No threshold entries in `evals/thresholds.json`. All five inherit
  `defaults.minFiringRate` of 0.8. Pre-setting a bar the skill is known to clear
  is editing the gate to pass the gate. If 0.8 turns out wrong, it changes later
  with the measurement on the record and user approval, as `lazy-reachable` did
  at 0.5.
- No `absent` vocabulary for tools, dispatches or files. Nothing needs them.
- No CI integration. `npm run eval` stays a manual gate.
- No change to `skills/quick/SKILL.md`. This cycle measures it; it does not
  amend it.
- No guard in `score.mjs` enforcing that `skillAbsent` is paired with `skill`.
  The pairing is a property of how the scenarios are written; a guard for a
  misuse that has not happened is speculative.
- Running the eval is not part of the implementation. Fifty sonnet sessions is a
  cost decision for the user, taken after the scenarios exist.

## Constraints

- Zero dependencies. Tests use Node's built-in `node:test`.
- Node `>=24` (`vibekit.config.json`, `npm.engines.node`).
- Generated files are committed; never hand-edit a generated file or region.
- `npm run eval` never runs in CI and never gates a merge.
- Commit messages carry no `Co-Authored-By` trailer.

## Approach

Add one expectation key and five scenarios.

`skillAbsent` mirrors the idiom `evals/score.mjs` already established with
`finalTextOmits`, the deliberate mirror of `finalTextMatches`. It returns a
reason when `run.skills` contains a named skill, `null` otherwise, and it sits
beside the `expect.skill` block so a reader comparing the two forms does not have
to scroll. It does not interact with `before` or `after`: those constrain the
ordering of a skill that fired, and this asserts none did.

It accepts a string or an array, normalised with `[].concat(...)`. The array form
exists so `quick-does-not-auto-fire` can cover `vibe`'s identical never-measured
claim in the same ten runs instead of paying for a duplicate scenario. This is
more code than the string-only form and less total work.

The five scenarios, all `model: "sonnet"`, all `n: 10`:

| id | asserts |
|---|---|
| `quick-fires` | `{ skill: "vibekit:quick" }` |
| `quick-skips-brainstorm` | `{ skill: "vibekit:quick", skillAbsent: "vibekit:brainstorm" }` |
| `quick-bails-out` | `{ skill: "vibekit:brainstorm", after: ["vibekit:quick"] }` |
| `quick-does-not-auto-fire` | `{ skill: "vibekit:brainstorm", skillAbsent: ["vibekit:quick", "vibekit:vibe"] }` |
| `quick-discloses` | `finalTextMatches` on the disclosure line |

`quick-bails-out` needs no new vocabulary: `after` already means "this skill
fired first" (`evals/score.mjs:109-111`), so one line asserts the whole routing —
`quick` fired, read its criteria, handed onward instead of writing.

**Pushback and response.** The challenge raised was that `skillAbsent` may be
unnecessary, since the existing `brainstorm-precedes-code` scenario already
asserts `brainstorm` fires before any `Write` or `Edit`, so an auto-firing
`quick` that wrote code would fail a scenario that already exists. The user
delegated the decision. It was taken toward the larger framing because that
scenario catches an auto-firing `quick` only if it writes: a `quick` that fires
on ordinary work, bails out correctly, and writes nothing passes everything in
the file today, and the gate being reachable through a door that should not open
by itself is the failure worth measuring.

## Alternatives considered

**Scenarios only, no `score.mjs` change.** Three entries, zero code, ships today.
Rejected as the primary approach because it leaves the guardrail hole untested,
which is the property most likely to be wrong. Its three scenarios survive
unchanged inside the chosen approach.

**A general `absent` vocabulary** covering tools, dispatches and files. Rejected:
nothing needs the other three, and building them is rung-1 scaffolding.

**A `score.mjs` guard requiring `skillAbsent` to accompany `skill`.** Rejected as
a non-goal above; the pairing is enforced by writing the scenarios correctly.

## Testing

- `tests/eval-score.test.mjs` — unit coverage for `skillAbsent`: a run where the
  named skill fired is unsatisfied, a run where it did not is satisfied, and the
  array form behaves as the string form for each member. Run objects are built
  inline with the file's existing `ok()` helper (`tests/eval-score.test.mjs:6`),
  matching every other test in it.

  Amended 2026-08-12, user-approved. The original wording said the test uses the
  existing `evals/fixtures/*.jsonl`. It does not: `tests/eval-score.test.mjs`
  reads no fixtures, and the `.jsonl` files are consumed by
  `tests/eval-parse.test.mjs:7` and `tests/eval-session.test.mjs:9`. An
  implementer following the original would have hunted for a pattern that file
  does not contain.
- `npm test` — the full suite.
- `npm run check` — generation stays consistent.
- Not run in this cycle: `npm run eval` itself. Fifty sonnet sessions is the
  user's cost decision, taken once the scenarios exist.

## Open questions

1. Whether a headless prompt reaches `quick` better as "Use the vibekit:quick
   skill to ..." or as a literal `/vibekit:quick ...`. The former copies
   `skill-invocable`, which is proven to work in this harness; the latter is what
   a user actually types. Resolve by writing the former and, if its rate is low,
   testing whether the harness expands slash commands at all before concluding
   anything about the skill — per `suspect-the-probe-before-the-skill`.
2. The exact regex for `quick-discloses`. The disclosure line in
   `skills/quick/SKILL.md` is presented as an example to follow, not a literal
   string to emit, so the regex must match the shape rather than the sample.
   Resolve during planning by reading the skill's closing section and writing a
   pattern against what it actually requires.
