---
title: debug — the pipeline's failure branch
date: 2026-08-09
status: approved
---

# debug — the pipeline's failure branch — Design

## Problem

`skills/verify/SKILL.md:183` routes a failing test or build to `debug`, and
`debug` does not exist. That is the last named-but-unbuilt skill in the frame,
the same defect class closed for `finish` in the previous cycle and closed there
by deletion rather than by building.

`exec` has the same gap without the dangling name. On a failed `→ verify:`
clause it halts and says the task's own criterion said no, and then nothing
happens. There is no destination, so the failure returns to the user as a stop.

Neither skill diagnoses, and that is correct — `exec` must not repair what it
dispatched, and `verify` must not author what it gates. But the consequence is
that vibekit models the happy path and hands every failure back unexamined.

What is missing is not the fix. It is the step between a failed check and a fix:
establishing what actually broke, and testing that claim before anyone acts on
it.

## Goals

- **`debug` fires at its trigger.** Observable: scenario `debug-fires` at n=10
  shows `vibekit:debug` in the session's skills.

- **`debug` never edits what it diagnoses.** Observable: scenario
  `debug-edits-nothing` at n=10 seeds a broken source file and asserts
  `onlyNewFilesMatching: "^docs/"`. `evals/score.mjs:189-190` fails such a run
  with `seeded file modified: <path>`, so a session that repairs the fixture
  scores zero. This is the hard gate, measured directly.

- **The refutation is dispatched, not asserted.** Observable: scenario
  `debug-dispatches-the-refutation` at n=10 asserts `anyDispatchMatches` on the
  refute instruction, so a session that describes the confirmation without
  performing it fails. It originally asserted `dispatchPromptMatches`; see the
  `anyDispatchMatches` goal below for why that was the wrong quantifier.

- **The skill states the refutation contract.** Observable:
  `skills/debug/SKILL.md` states that the subagent is fresh, is read-only, is
  told to refute rather than review, and defaults to refuted when the evidence
  is not conclusive.

- **The loop is bounded by construction.** Observable: the skill states one
  re-hypothesis and a maximum of two dispatches per failure, and states that
  the second refutation ends in escalation to the user rather than a third
  attempt.

- **`unreproducible` is terminal.** Observable: the skill states that a failure
  which cannot be made to fail on demand routes no fix, and names widening the
  window as a precondition of that verdict rather than an alternative to it.

- **Every routed fix carries a guard test.** Observable: the skill states that
  the routed fix must add a test that fails before the fix and passes after, and
  states that `debug` names it without writing it.

- **`exec` has a destination for a failed clause.** Observable:
  `grep -c 'debug' skills/exec/SKILL.md` is at least 1, and the failed-clause
  entry under `## Repair nothing` names the route.

- **The pipeline has no dangling names.** Observable:
  ``grep -rnoE '`(finish|review|isolate|reconcile|debug-recovery)`' skills/``
  returns nothing, and every skill named as a route — `brainstorm`, `plan`,
  `exec`, `verify`, `debug`, `lazy`, `terse` — has a `skills/<name>/SKILL.md`.

  **Amended after the first verdict, 2026-08-09.** This criterion originally used
  a word boundary, `\b(finish|review|...)\b`, and it failed on its first run with
  13 matches — every one of them the ordinary English word "review", in
  `## Self-review`, `## User review gate`, and "a reviewer looks for". None named
  a skill. The change was correct and the probe was wrong.

  The fix uses the codebase's own convention: a skill reference is written in
  backticks, so the probe matches a backticked name. It was run both ways before
  being written here — nothing against `skills/`, and a match against a file
  containing the literal text `` `finish` ``. A check that has not been shown
  failing is not a check, and this project has shipped three that could not fail.

- **The scorer can assert that one dispatch did something.** Observable:
  `evals/score.mjs` supports `anyDispatchMatches`, satisfied when at least one
  dispatch prompt matches and failed when none do or when nothing was
  dispatched; `tests/eval-score.test.mjs` covers both cases over a two-dispatch
  run; and `dispatchPromptMatches` keeps its existing universal meaning and its
  existing test, unchanged.

  **Added after the second verdict, 2026-08-09.** `debug-dispatches-the-refutation`
  measured 0.40. Every failure read `dispatch N did not match /refut/`, and five
  of the six failing sessions reported dispatching a refuter in their final text
  — they performed the behaviour and were scored against a dispatch that had
  nothing to do with it.

  `dispatchPromptMatches` is universally quantified and that is correct for the
  skill it was built for: `exec` dispatches only briefs, so *every* dispatch
  should name one. It is wrong for `debug`, which dispatches a refuter alongside
  ordinary exploration. The repair is a second expectation, not a changed one —
  flipping the quantifier would weaken `exec`'s assertion to rescue `debug`'s.

  The existing test is named *"dispatchPromptMatches and dispatchPromptOmits
  judge every dispatch"*, so the universal reading was intended. It never
  exercises more than one dispatch, so it could not distinguish the two
  quantifiers, and the ambiguity survived until a skill dispatched twice.

- **The skill stays under its budget.** Observable: `wc -l
  skills/debug/SKILL.md` is at most 150. Read as a content budget: reflowing to
  pass it is a violation, not a fix.

  **Derived, not chosen.** The body was drafted onto a scratch copy before this
  spec was written and measured 143 lines — observed, not estimated. 150 is that
  number plus margin. Four ceilings set before their content existed were wrong
  four times; two derived after drafting held. The draft also sits between
  `exec` at 134 and `plan` at 154, which is the size band this skill belongs in.

## Non-goals

- **Fixing anything.** `debug` diagnoses and routes. Not the fix, not the
  obvious one-liner, not the revert. A repair made here is a change nobody
  gated, and the guard test never gets written because the bug is already gone.

- **A three-cycle re-hypothesis budget.** The reference implementation allowed
  three. Three is a budget wearing the word bound. One re-hypothesis, two
  dispatches, then the user — the same choice `verify`'s fix loop made, for the
  same reason: a judgement-driven loop has no exit status to converge on.

- **A JSON report schema.** Every v2 skill reports in a fenced plain-text block.
  A schema an agent must emit exactly is a new failure mode, and the consumer
  here is a human reading a diagnosis.

- **Standalone as the primary framing.** `debug` is the pipeline's failure
  branch first and answers a directly reported failure second. The user chose
  this over standalone-primary.

- **Bounding the outer loop.** `debug → exec → verify → debug` can cycle more
  than once and nothing in the frame stops it. `verify` bounds its fix loop and
  `debug` bounds its re-hypothesis; the loop across skills is bounded by the
  user, deliberately.

- **Writing an artefact.** No file under `docs/`. `verify` reports in the
  conversation and so does this.

- **A `reconcile` or `writing-skills` skill.** Neither is named by any shipped
  file. They are ideas, not gaps.

## Constraints

- **Dependency free.** No shipped file under `skills/` names a project vibekit
  borrows from; `tests/no-external-references.test.mjs` enforces it. This
  matters more than usual here: the reference implementation of this skill opens
  by naming three outside projects, so nothing may be copied from it unexamined.
- **One directory, one file.** `skills/debug/SKILL.md`. The harness files
  `evals/score.mjs` and `tests/eval-score.test.mjs` were added to this change's
  scope by the amendment above. `CLAUDE.md`, `README.md`
  and `AGENTS.md` are regenerated by `npm run generate` and committed together,
  never hand-edited. Adding a skill changes all three.
- **No `Co-Authored-By` trailers. Branch names carry no prefix. Artefacts stay
  committed under `docs/`.**
- **Measurement integrity.** `git ls-files -s skills evals | sha256sum` pinned
  before and after every paid run. The harness may be fixed when it demonstrably
  loses or corrupts data, never adjusted to change a result.
- **Rates are quoted at n=10 or not at all.**
- **Suspect the probe before the skill.** Every cycle so far has produced more
  defects in the plan and the measuring apparatus than in any implementation.

## Approach

One file is created — `skills/debug/SKILL.md` — and five change:
`skills/exec/SKILL.md`, `evals/scenarios.json`, and the three generated docs,
which a new skill's frontmatter necessarily rewrites.

### The new skill

`skills/debug/SKILL.md`, six numbered stages between a hard gate and a report.

**Stop and preserve** — the command, its exit status, its output verbatim, and
the branch and HEAD it ran on. Never paraphrase an error: the exact string is
what matches a line of source, and a summary of it matches nothing.

**Reproduce** — make it fail on demand and say how many times you ran it.
Failure to reproduce is `unreproducible`, a terminal outcome that routes
nothing. An intermittent failure does not qualify until the window has been
widened.

**Isolate** — bisect the history to the first bad commit and then to the hunk.
Reading source until something looks wrong is not isolation; it finds what was
already suspected. Where nothing changed, the widening from the previous stage
is the isolation.

**Hypothesise** — one falsifiable claim with `file:line` evidence. Falsifiable
is the operative word, and the thing that would prove the claim wrong is the
guard test the route will demand.

**Refute** — one fresh read-only subagent, briefed to find the reason the claim
is wrong, defaulting to refuted when the evidence is inconclusive. This is the
only stage that can end a story rather than extend one. It is a dispatch and not
a re-read because the hypothesis's author cannot test it — the principle `exec`
already runs on, and the one every plan defect in this project has confirmed.

**Route** — local to `exec` as a new task, structural to `plan` as a new problem
statement, `unreproducible` and twice-refuted to the user. Every routed fix
carries a guard test that fails before the fix and passes after. `debug` names
it and does not write it.

### The `exec` edit

`## Repair nothing` currently ends the failed-clause case at "halt". It gains
the destination: a failed clause is a failure with no diagnosis, and that is
what `debug` is for. One line.

### Pushback and response

The pushback challenged whether `debug` should exist at all: this project has
returned `not ready` twice and both times it was an unmeasured goal, never a red
test, so the primary trigger has fired zero times in eight cycles, and the
smaller version is three lines in `verify`'s routing telling it to reproduce and
prove a cause first.

The user took the larger framing. The counter-argument stated at the time and
recorded here: the zero count is a property of the subject rather than the
pipeline. This repo is eight prose files and a small Node harness, where tests
are fast and failure modes narrow. That is a claim about projects vibekit has
not been used on, which is weaker evidence than the eight cycles behind it, and
it is the honest basis on which this was approved.

## Alternatives considered

**Three rules and a route, about forty lines.** The laziest rung that still
meets the requirement: reproduce before diagnosing, get refuted before routing,
never edit. Rejected — the ordering is what a competent reader would follow
anyway, but `unreproducible` as a terminal outcome and the refutation brief both
need enough prose to actually specify, and at forty lines neither survives.

**Folding the procedure into `verify`'s `not ready` path.** No new skill, no new
trigger. Rejected by the user. It would also put a diagnostic procedure inside
the skill that must not author what it gates, and `verify` is already 221 lines.

**Standalone-primary framing.** Preconditions could then assume nothing — no
spec, no plan, no branch. Rejected: it makes the pipeline path a special case of
a general debugging skill, which is a larger thing than the gap being closed.

**A `reviewer` rather than a `refuter` for the confirmation dispatch.** Rejected
on the mechanism: a reviewer asks whether the claim holds and will find that it
does, because it was written to. Only an agent told to find the case where the
claim fails can end it.

## Testing

**Free CI.** `npm run generate` and `npm run check` cover registration;
`tests/no-external-references.test.mjs` covers the prose; `npm test` covers the
rest.

**Paid, three new scenarios at n=10.** `debug` is the first skill in three
cycles with substantial measurable surface, because its central rule is enforced
by tool use rather than by shell commands.

- `debug-fires` — the trigger, the failure this project measures most.
- `debug-edits-nothing` — the hard gate, measured directly. A seeded broken file
  and `onlyNewFilesMatching: "^docs/"`; a session that repairs the fixture fails
  on `seeded file modified`. This is the assertion that makes the cycle worth
  measuring.
- `debug-dispatches-the-refutation` — an existential assertion on the refute
  instruction, distinguishing the dispatch happening from the prose describing
  it. It first used `dispatchPromptMatches` and measured 0.40 against sessions
  that had in fact dispatched a refuter; see the `anyDispatchMatches` goal.

**What stays unmeasured.** Reproduce, isolate and the guard test are
shell-driven and need the per-scenario `allowBash` capability, still unbuilt
with no spec. Roughly half of `debug` is measurable, against one third of
`verify`.

**This cycle should pay.** The three goals above are stated as measurements, so
`verify` will mark them `not satisfied` — and therefore `blocker`, and therefore
`not ready` — unless the scenarios run. That is the severity model working as
designed rather than an obstacle to route around. Eight scenarios from earlier
cycles have also never run, five for `verify` and three for `plan`, and the
`verify` five now cover a skill this change routes into. Running all eleven is
roughly $7–8.

**Stated weakness.** This skill is being built for a failure mode this project
has never hit. Every argument for it is structural — the dangling route at
`verify:183`, the dead end in `exec` — rather than observed demand.

## Open questions

None. Deferred items are listed under Non-goals.
