---
title: terse shaping rules
date: 2026-08-12
status: draft
---

# terse shaping rules — Design

## Problem

`terse` says what to cut. It says nothing about the order what survives arrives
in, or where the reader is in a multi-step run.

Observed in the session that produced this spec: an eight-task `exec` run
reported each task's outcome without once stating which task of eight had
finished. The reader had to count. `terse` was active throughout and forbids
none of that, because every rule it carries is about deletion.

Two reference projects under `external/` were read for ideas. One shapes output
for a reader who cannot hold state between turns. The other removes constructions
that mark prose as machine-written. Their ideas are used here; no shipped file
names them, and `tests/no-external-references.test.mjs` enforces that.

**Round 1 and round 2 already tried this and failed, and the failure was
misattributed.** On 2026-08-11 a section carrying both halves went into `terse`,
measured 0.00 against a 0.00 baseline, and was reverted. It was then moved to the
top of the file, measured 0.00 again, and reverted again. Recorded in
`evals/results/2026-08-11T15-18-28-057Z-HEAD.json` and
`evals/results/2026-08-11T16-09-14-732Z-HEAD.json`.

The scenario behind both numbers is `terse-omits-em-dash`. It tests one tell. It
never tested a single shaping rule, which the round 1 spec said in advance:
restating position needs a multi-turn fixture, leading with the action has no
assertion that survives legitimate variation, and the deletion pass leaves no
trace. Both reverts therefore discarded an untested component because a tested
component alongside it failed.

The two halves are in different evidential positions, and this spec separates
them.

## Goals

- `terse` states the five shaping rules. Observable: `skills/terse/SKILL.md`
  contains a section naming all of leading with the action, restating position,
  one next action, the list cap and the pre-send deletion pass.
- The rules cannot truncate evidence. Observable: `npm test` passes a test
  asserting the section names the exemption, tying the cap and the deletion pass
  to the never-compress list.
- The measured-dead tells stay out. Observable: `skills/terse/SKILL.md` contains
  no line matching `No em dash`.
- Firing is untouched. Observable: `git diff` on `skills/terse/SKILL.md` changes
  no line above the `# terse` heading, so frontmatter is byte-identical.
- No other skill changes. Observable: `git diff --name-only` lists no file under
  `skills/` other than `skills/terse/SKILL.md`.

## Non-goals

- The tells. No em dash, no throat-clearing opener, no emphasis adverb, no
  `not X, it's Y` contrast. Measured inert at n=10 twice, in two positions. A
  third statement produces the same number. Their absence here is a finding
  being respected, not an oversight.
- A new skill. `terse` already owns how the agent talks, and the one measurement
  on modifier surface reads zero of five for an un-invoked one.
- A paid run. Nothing here is measurable with the current harness. See Testing.
- Rewriting vibekit's own skill prose to obey these rules. A separate question,
  considered and set aside during design.
- Any change to another skill's text, or to `terse`'s frontmatter.

## Constraints

- Dependency free.
- No shipped file under `skills/`, and none of the generated context files, may
  name a project vibekit borrows from.
- The never-compress list is not weakened. Every rule added here is subordinate
  to it.
- `terse`'s frontmatter is byte-identical after this change. `description` and
  `trigger` are what the runtime shows the model before it decides to invoke a
  skill, and `lib/model.mjs` feeds `trigger` into three generated trigger tables.
  Touching either changes firing, which five scenarios measure.
- Rates are quoted at n=10 or not at all.

## Approach

One section in `skills/terse/SKILL.md`, after `### Auto-clarity override` and
before `## What does not save tokens`, carrying the five shaping rules and the
exemption. The text is recovered from commit `603b487` rather than rewritten, so
it is the same text that was drafted, reviewed and approved on 2026-08-11, minus
the `### Tells` subsection.

1. **Lead with the action.** If the answer is a command, a path or a snippet, it
   is the first line.
2. **Restate position every turn.** In a multi-step run, say where you are.
3. **One concrete next action** whenever something is left open.
4. **Cap narration lists at five.**
5. **Pre-send deletion pass.** Announcements, recaps, sidebars, empty hedges.

### The exemption

The cap and the deletion pass govern narration only. Neither touches anything on
the never-compress list: a findings list, a blocker enumeration, a goals walk, a
question to the user, quoted evidence, a destructive-operation warning.

A cap that can truncate findings is a licence to drop the sixth blocker, which is
the worst thing this pipeline could ship. The exemption is a goal with its own
test rather than a sentence trusted to be read.

### Position

The section goes back where round 1 put it, not where round 2 put it. Round 2
tested whether position mattered and measured no difference, so position is a
free variable and the file reads better with the compress and never-compress
boundary established first.

## Alternatives considered

- **Include the tells.** Rejected: measured inert at n=10 twice.
- **A separate skill for output shaping.** Rejected: a third modifier to invoke,
  against a measurement that says an un-invoked modifier fires zero times in five.
- **Two new skills mirroring the references.** Rejected for the same reason, and
  because half their content is the measured-dead half.
- **Rewrite vibekit's own 1,050 lines of skill prose to obey these rules.** A
  real option with a testable mechanism — imitation rather than instruction — and
  a real risk, since it edits the text of nine hard gates in service of a style
  theory. Set aside, not refuted.

## Testing

Unit, each assertion shown failing before the section is written:

- `skills/terse/SKILL.md` names all five shaping rules.
- It names the exemption, tying the cap and the deletion pass to the
  never-compress list.
- It contains no line matching `No em dash`, so the measured-dead half cannot
  return unnoticed.
- `terse`'s frontmatter is unchanged: the first six lines of the file are
  byte-identical to the previous commit's.

**No paid run, and no rate is claimed.** Three of the five rules cannot be
measured by the current harness: restating position needs a multi-turn fixture
and eval sessions are single turn; leading with the action has no assertion that
survives legitimate variation between a path, a command and a verdict block; the
deletion pass leaves no trace of what it removed. The remaining two are not worth
a run on their own.

This ships on judgment. Saying so is the point: the alternative is inventing a
scenario that passes vacuously and calling it evidence.

## Open questions

- Whether any of the five rules bind. Unknown and, with this harness, unknowable.
  A multi-turn fixture would make `restate position` measurable, and that is the
  single most valuable addition the eval harness could gain.
- Whether the rules that cannot be measured should ship at all. This spec says
  yes, on the grounds that structure is what every working skill in this repo is
  made of, and that the pipeline demonstrably follows structural instruction. The
  contrary view is that two nulls in one day argue for spending nothing further
  on output shaping.
