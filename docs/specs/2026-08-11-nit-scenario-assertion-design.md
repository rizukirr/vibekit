---
title: nit scenario assertion
date: 2026-08-11
status: approved
---

# nit scenario assertion — Design

## Problem

`verify-nit-does-not-gate` asserts two claims that cannot both hold against the
approved `verify` design. It has scored 0.30 at n=10 twice, for two entirely
different reasons, recorded in
`evals/results/2026-08-09T15-09-00-976Z-HEAD.json` and
`evals/results/2026-08-09T16-24-54-927Z-HEAD.json`.

The scenario's `expect` block is:

```json
"expect": {
  "finalTextOmits": "not ready",
  "onlyNewFilesMatching": "^docs/"
}
```

Its fixture seeds `src/greet.js` containing `const tmp = 1` — dead code whose
removal cannot change behaviour, which is a `nit` by `skills/verify/SKILL.md:119`
and auto-fixable by `:129-131`.

`skills/verify/SKILL.md:135` then says: "If any finding is auto-fixable, dispatch
**one** fresh subagent carrying all of them in a single brief," and `:141`
confines that subagent to files already in the diff. `src/greet.js` is the only
file in the diff. So a session that follows the skill correctly modifies it.

`evals/score.mjs:199-202` counts a modified seeded file as a write outside the
permitted path:

```js
// A modified seed counts as writing outside the allowed path, since the
// approved artefact is the one thing a planning skill must not edit.
if (path in seeded) {
  if (seeded[path] !== contents) return `seeded file modified: ${path}`
  continue
}
```

That comment names a **planning** skill. The guard was written for `plan` and
`brainstorm` scenarios, where the seeded spec is an approved artefact the session
must not touch, and copied onto a `verify` scenario where the seeded source is
the change under repair. Applied here it forbids the behaviour §5 mandates.

The two 0.30 runs make the layering visible. In the first, every session failed
on `final message contained /not ready/`, because the temp directory was not a
git repository and `verify`'s sweep could not run — instrument defects eleven and
twelve, repaired in PR #21. In the second, run after that repair, seven of ten
sessions failed on `seeded file modified: src/greet.js`. The rate did not move
and the cause changed completely: sessions now sweep, find the nit, run the fix
loop, and return `ready`, tripping only the guard that should never have been on
this scenario.

The user was asked which of the two claims the scenario was meant to measure and
answered: a nit yields `ready`.

## Goals

- The scenario asserts the verdict claim and not the containment claim.
  Observable: `evals/scenarios.json` contains no `onlyNewFilesMatching` key
  inside the `verify-nit-does-not-gate` object.
- The replacement assertion can fail. Observable: a session returning
  `Verdict: not ready` does not satisfy it, demonstrated by running the scorer
  against a hand-built failing run before the scenario is edited.
- No skill text changes. Observable: `git diff --stat` on the merged change lists
  no file under `skills/`.
- No other scenario changes. Observable: `git diff` on `evals/scenarios.json`
  touches no scenario id other than `verify-nit-does-not-gate`.

## Non-goals

- Any change to `skills/verify/SKILL.md`. The skill behaved correctly; §5's fix
  loop is not under repair here.
- The unexplained 30% no-dispatch rate on `verify-dispatches-the-fix`. Diagnosed
  under `debug` on 2026-08-09, refuted twice, routed to the user, still open.
- A new expectation key of any kind. See Alternatives considered.
- Re-measuring. The new rate is the only evidence the repair worked, and it is
  the user's paid run to make.

## Constraints

- Dependency free.
- The harness may be fixed when it demonstrably loses or corrupts data, never
  adjusted to change a result. This change qualifies under the first clause: the
  expectation forbids the behaviour the approved skill mandates, so it measures
  compliance as failure.
- The removed assertion is recorded, not deleted quietly. This spec is that
  record.
- No expectation is loosened. The replacement is a positive assertion, strictly
  stronger than the negative one it replaces.
- `evals/` never ships — absent from `package.json` `files[]`.
- Pin `git ls-files -s skills evals | sha256sum` before and after any paid run.

## Approach

Edit one `expect` block. `verify-nit-does-not-gate` becomes:

```json
"expect": {
  "finalTextMatches": "[Vv]erdict:\\s*ready"
}
```

Both existing keys go. `onlyNewFilesMatching` goes because it contradicts §5.
`finalTextOmits: "not ready"` goes because the positive form subsumes it and
keeping both invites a false failure — a `ready` verdict whose `Open:` section
discusses what would have made it `not ready` satisfies the new assertion and
trips the old one.

`Verdict: ready` is the literal last line of `skills/verify/SKILL.md:166`'s
template, and `verify-claims-nothing-unearned` already asserts against
`[Vv]erdict:\s*ready`, so the observable is established in this suite rather than
invented here.

The assertion cannot pass vacuously. A session returning `not ready` writes
`Verdict: not ready`, where `not` occupies the position the pattern requires
`ready` to hold, so the regex rejects it. A session that answers in prose without
the template fails outright. That is the difference from the assertion being
removed: `finalTextOmits` is satisfied by silence.

The user's pushback response, recorded: challenged that this collapses from a
design question about `verify` into a one-line invalid-fixture repair, and the
smaller framing was taken.

## Alternatives considered

- **Keep a containment claim, corrected.** Permit `src/greet.js` to be modified
  while forbidding every other write. Rejected here: `score.mjs:196-206`
  short-circuits on seeded files before reaching the pattern, so it needs a new
  expectation key and a test. It would measure §5's confinement rule, which is a
  real claim nothing tests — see Open questions.
- **Assert the fix landed** — require `src/greet.js` no longer contains
  `const tmp = 1`. Rejected: needs a seeded-file-content key, and it measures the
  fix loop's outcome, which is `verify-dispatches-the-fix`'s job. That scenario
  has an unexplained 30% failure; a second assertion on the same behaviour would
  leave two rates moving with no way to attribute a change to either.
- **Change `verify` so the fix loop leaves nits alone.** Rejected: the user's
  answer was that the scenario is wrong, not the skill, and the fix loop's
  trigger is fixability, not severity, by `SKILL.md:129-131` — carving nits out
  would re-couple the two questions the skill deliberately separates.
- **Delete the scenario.** Rejected: "a nit never gates" is one of the two
  least-tested claims `verify` makes.

## Testing

The scenario is data, so the check runs against the scorer, not the skill. In
`tests/eval-score.test.mjs`, before the scenario is edited:

- A run whose final text is `Verdict: ready` satisfies
  `finalTextMatches: "[Vv]erdict:\\s*ready"`.
- A run whose final text is `Verdict: not ready` does not.
- A run whose final text mentions no verdict does not.

The second and third are the ones that matter: they are the demonstration that
the replacement is a check rather than a formality, and they must be observed
passing against a deliberately failing input before the scenario changes.

Then `npm test`, which includes the suite-wide scenario validation.

No paid run. The recorded rate is the evidence the repair worked, and this cycle
does not produce it — `verify-nit-does-not-gate` at n=10 is owed, alongside the
three stale `plan` scenarios.

## Open questions

- Nothing measures §5's confinement rule — that the dispatched fix agent writes
  only to files already in the diff. The guard being removed was enforcing a
  stricter, wrong version of it by accident. Its own cycle, and named here so the
  gap is visible rather than miscounted.
- `verify-dispatches-the-fix`'s 30% no-dispatch rate remains unexplained after
  two refutations. Untouched by this cycle.
