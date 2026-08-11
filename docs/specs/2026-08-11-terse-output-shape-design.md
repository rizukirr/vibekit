---
title: terse output shape
date: 2026-08-11
status: approved
---

# terse output shape — Design

## Problem

`terse` compresses. It does not shape.

Its 81 lines say what to cut — transitions, self-narration, acknowledgements,
hedging — and what never to cut. Nothing says what order the surviving content
arrives in, where the reader is in a multi-step run, or which constructions read
as machine-written regardless of length. A message can satisfy every rule in
`terse` today and still open with a paragraph of context before the command, run
a twelve-item list, and close by asking whether anything else is needed.

Observed in this session, against the agent that had `terse` active throughout:
an eight-task `exec` run reported each task's result without once stating which
task of eight had just finished. The reader had to count.

Two reference projects under `external/` solve adjacent halves of this. One
shapes output for a reader who cannot hold state between turns: lead with the
action, restate position, cap lists, give concrete estimates, end with one next
step. The other removes the constructions that mark prose as generated: adverbs
doing emphasis work, throat-clearing openers, binary contrasts, em dashes.

The user chose to take the output-shaping half first and measure it, leaving the
authoring-style half — whether the 1,048 lines of skill prose vibekit itself
ships should obey the same rules — to a separate cycle.

Recorded because it bears on whether these rules bind: vibekit's own skills use
em dashes and `not X, it's Y` constructions throughout, and so does every message
the agent sent while designing this. A rule its author cannot follow is worth
measuring before believing.

## Goals

- `terse` states the shaping rules. Observable: `skills/terse/SKILL.md` contains
  a section whose body names all five of leading with the action, restating
  position, one next action, the list cap, and the pre-send deletion pass.
- The rules cannot truncate evidence. Observable: `npm test` passes a test
  asserting `skills/terse/SKILL.md` names the exemption — that the cap and the
  deletion pass do not apply to the existing never-compress list.
- The em-dash rule changes behaviour. Observable: an A/B run of
  `terse-omits-em-dash` at n=10 records a candidate rate above its baseline rate.
- The opener rule changes behaviour. Observable: an A/B run of
  `terse-omits-throat-clearing` at n=10 records a candidate rate above its
  baseline rate.
- No other skill changes. Observable: `git diff --name-only` on the merged change
  lists no file under `skills/` other than `skills/terse/SKILL.md`.

## Non-goals

- A banned-phrase catalogue. The reference carries 128 lines of them. A list that
  long reads well and binds nothing; the four mechanically detectable tells are
  the part that can be checked.
- A `references/` subdirectory. It costs no code — `lib/model.mjs` reads only
  `SKILL.md` and `skills/` ships wholesale — and it buys shipped prose whose
  effect nobody has measured. Available later if the rules outgrow one file.
- A second modifier skill. Modifier surface is what killed firing before; the
  one measurement on it read zero of five.
- The authoring style of vibekit's own skill prose. The user's stated order puts
  it second, after this is measured.
- Measuring whether `terse` fires unprompted. Separate problem, already measured
  at zero once, untouched here.
- A scoring rubric. The reference rates prose 1-10 across five dimensions. Self-
  assessment with no observable is the kind of check that cannot fail.

## Constraints

- Dependency free.
- No shipped file under `skills/`, and none of the generated context files, may
  name a project vibekit borrows from. `tests/no-external-references.test.mjs`
  enforces it, and both references are named nowhere outside this spec.
- The never-compress list is not weakened. Every rule added here is subordinate
  to it.
- Rates are quoted at n=10 or not at all.
- Pin `git ls-files -s skills evals | sha256sum` before and after every paid run.
- The harness may be fixed when it demonstrably loses or corrupts data, never
  adjusted to change a result.

## Approach

One new section in `skills/terse/SKILL.md`, placed after "The placement rule" so
the compress/never-compress boundary is established before the shaping rules
arrive.

### Shaping

1. **Lead with the action.** If the answer is a command, path or snippet, it is
   the first line. Prose after, if at all.
2. **Restate position every turn.** In a multi-step run, name where you are:
   `Task 3 of 8 done: <what>. Next: <what>.` The reader is not holding the plan.
3. **One concrete next action** whenever something is left open, small enough to
   do immediately.
4. **Cap narration lists at five.** Past five, split into now and later, or must
   and nice-to-have.
5. **Pre-send deletion pass.** Cut the first sentence if it announces what you
   are about to do, the last if it recaps or asks whether anything else is
   needed, any sidebar, and any hedging adverb carrying no real uncertainty.

### Tells

Four checks, chosen because each is mechanically detectable: no em dash; no
throat-clearing opener; no `not X, it's Y` contrast where stating Y alone would
do; no adverb doing emphasis work.

### The exemption

The cap and the deletion pass apply to narration only. They never touch the
never-compress list: a findings list, a blocker enumeration, a goals walk, a
question to the user, evidence, or a destructive-operation warning.

Without this, rule 4 becomes a licence to drop the sixth blocker. That is the
worst thing this pipeline could ship, so the exemption is a goal with its own
test rather than a sentence trusted to be read.

### Measurement

Two scenarios, text-only, using assertions the scorer already has:

- `terse-omits-em-dash` — a prompt inviting several paragraphs, then
  `finalTextOmits` against the em-dash character.
- `terse-omits-throat-clearing` — same shape, `finalTextOmits` anchored at the
  start of the message against the common openers.

Both prompts instruct the session to invoke `terse` first, as `skill-invocable`
does. That measures whether following the skill changes the output, which is the
claim being made. Run A/B — `--baseline v2 --candidate HEAD` — so the number
separates the rule's effect from the model's baseline habits.

Three shaping rules are not measured this cycle, and nothing here implies they
are: restating position needs a multi-turn fixture and eval sessions are single
turn; leading with the action has no assertion that survives legitimate variation
between a path, a command and a verdict block; the deletion pass leaves no trace
of what it removed.

## Alternatives considered

- **A separate `shape` skill.** Rejected: a third modifier to invoke, against a
  measurement that says an un-invoked modifier fires zero times in five.
- **Port the phrase catalogue into `references/`.** Rejected for this cycle as a
  non-goal above; the pattern itself is sound and needs no code.
- **Rewrite the existing skills to obey the tells first.** Rejected: that is the
  authoring-style half, and the user set the order.
- **Score prose 1-10 before sending.** Rejected: no observable, cannot fail.

## Testing

Unit, in `tests/`:

- `skills/terse/SKILL.md` names all five shaping rules.
- `skills/terse/SKILL.md` names the exemption, tying the cap and the deletion
  pass to the never-compress list.
- Each assertion is shown failing against the current file before the section is
  written.

Paid, at n=10, A/B against `v2`:

- `terse-omits-em-dash`
- `terse-omits-throat-clearing`

Roughly 40 sessions. The digest is pinned either side, and the result is
committed whatever it says. A candidate rate at or below baseline is reported as
the finding, never repaired by editing the expectation.

## Open questions

- Whether the em-dash rule produces worse prose rather than merely less
  machine-like prose. The rate says the character is absent; it cannot say the
  sentence that replaced it is better.
- Whether `restate position` survives contact with a single-turn harness at all,
  or only ever binds in interactive use, where nothing measures it.
- Whether the authoring-style cycle, if run, would require rewriting all ten
  skills or only new ones. Deferred with the rest of that half.
