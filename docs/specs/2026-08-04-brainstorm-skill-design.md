---
title: brainstorm skill
date: 2026-08-04
status: draft
---

# brainstorm skill — Design

## Problem

vibekit v2 has architecture (spec 1) and measurement (spec 2) but no skills — only
three empty stubs. The pipeline has to be authored, and the maintainer chose to
author it **compressed**, applying meta-prompting's structure-over-content
principle. Superpowers, the baseline this project follows, holds the opposing
position: its skills average ~227 lines because rationalization tables are what
stop a model talking itself out of a gate, and it requires eval evidence before
anyone shortens one.

Authoring twelve skills compressed and measuring afterwards is the failure mode
this project already hit once — a behavioural slot built, measured 0/5, and
abandoned only after the work was done. So the pipeline is authored **one skill at
a time**, each measured before the next.

`brainstorm` is first because it is the pipeline's entry gate: every other skill
runs downstream of a design it produced.

### What is actually untested

Two compression axes are independent, and only one has ever run:

| Axis | Status |
|---|---|
| **Runtime output compression** — the skill instructs the agent to compress narration | Exercised continuously. v1's `brainstorm-lean` already does exactly this: "This skill compresses *only* assistant narration. Everything else is verbatim." |
| **Skill-file compression** — the SKILL.md itself written tersely | **Never tested.** v1's `brainstorm-lean` is 245 lines / 1,939 words of ordinary full prose. |

The risk was never compressing output. It is compressing the *file* and finding
skills stop firing.

### The two-layer token model

vibekit's measured input footprint is 9,956 tokens (spec 2). That cost is **not**
skill bodies — bodies load only when a skill is invoked. The always-on cost is the
SessionStart bootstrap plus each skill's `description:` line.

| Layer | Paid | Policy |
|---|---|---|
| Always-on — bootstrap + N descriptions | every session, forever | compress ruthlessly |
| Pay-per-use — skill bodies | only when invoked | length is nearly free; keep gate language full |

Uniform compression spends guardrail risk where there is no saving.

## Goals

- Author `brainstorm` into the v2 contract as the pipeline's entry gate, with an
  observable success criterion: a clean session on "Let's make a react todo list"
  invokes it **before** any `Write`, `Edit` or `NotebookEdit`.
- Author the two modifiers `brainstorm` delegates to — `lazy` and `terse`. A skill
  cannot reference skills that do not exist, so the extraction is only coherent if
  all three ship together.
- Reduce its length by **extraction only** — move duplicated policy into the
  `lazy` and `terse` modifiers — with no behaviour-shaping sentence shortened.
- Add the three guards v1 lacks: understand-before-shortening, name-your-confusion,
  and observable success criteria in the spec template.
- Squeeze the `description:` line, since it is always-on.
- Ship an eval scenario that exercises the `before` ordering assertion, which spec
  2 built and no shipped scenario has used.
- Establish the A/B ladder that the remaining nine skills will follow.

## Non-goals

- **The other nine skills.** This spec authors three of twelve — `brainstorm` and
  the two modifiers it delegates to. The agreed set is recorded under §Appendix as
  the frame this one fits into; each remaining skill gets its own spec.
- **Squeezing `brainstorm`'s procedure prose.** Deliberately deferred so the first
  A/B isolates one variable. Squeezing is run 2, on its own branch.
- **Deleting v1's `brainstorm-lean`.** It stays installed and running until the
  A/B says the replacement is at least as good.
- **Changing the eval harness.** It is used as built.

## Constraints

- The v2 authoring contract: one directory, `SKILL.md` frontmatter is the complete
  registration (`name` must equal the directory, plus `description`, `trigger`,
  optional `command` and `gate`). Run `npm run generate` after; never hand-edit a
  generated file.
- Zero dependencies.
- Frontmatter values must not contain generated-region marker syntax, and pipes in
  `trigger` are escaped at render time — both enforced by the generator.
- The eval scenario costs real money (~$0.10–0.45 per sonnet session; 5 repeats ×
  2 variants ≈ $1–4.50 per A/B run).
- `brainstorm` is `gate: hard`.

## Approach

### Structure

Twelve sections. Provenance is given because the mix is the point.

| # | Section | Length | From |
|---|---|---|---|
| 1 | Frontmatter | squeezed | v2 contract |
| 2 | HARD-GATE | full | superpowers |
| 3 | Understand before you shorten | full | ponytail (**new**) |
| 4 | Clarifying loop | full | superpowers + karpathy #1 (**2 new rules**) |
| 5 | Scope check | full | superpowers (**promoted**) |
| 6 | Pushback turn | full, verbatim shape | karpathy #1 |
| 7 | Approaches (2–3) | full | superpowers + ponytail |
| 8 | Design presentation in sections | full | superpowers |
| 9 | Spec template | structural | superpowers + karpathy #4 + PEG meta-prompting |
| 10 | Self-review | full | superpowers + PEG reflexion |
| 11 | User-review gate | verbatim | superpowers |
| 12 | Terminal handoff to `plan` | full | superpowers + PEG prompt chaining |

### The three additions

**§3 Understand before you shorten** — v1 has ponytail's ladder but not its guard:

> The ladder shortens the solution, never the reading. Trace the whole thing
> first — every file the change touches, the actual flow — before proposing
> anything. Laziness that skips comprehension ships a confident wrong fix.

Without this, "lazy" degrades into "careless", which is the failure ponytail
itself warns is the dangerous kind because it dresses up as efficiency.

**§4 Two karpathy rules** v1 lacks:

> If multiple interpretations exist, present them — don't pick silently.
> If something is unclear, stop. Name what is confusing. Ask.

**§9 Observable success criteria** in the spec template's Goals:

> Each goal states an observable success criterion. "Make it work" is not a goal.
> Strong criteria let downstream skills verify without asking you.

This is karpathy #4 pushed one stage earlier. Every gate in the pipeline reads the
spec's Goals; vague goals are what produced three `partial` verdicts during spec
2's verification, each of which was a spec sentence promising something
unverifiable or unbuilt.

### What is extracted, not shortened

Two blocks move out of the body. Neither is reworded.

**To `lazy`** — the 7-rung ladder and the never-simplify-away list (input
validation at trust boundaries, error handling that prevents data loss, security,
accessibility, anything explicitly requested). `brainstorm` retains one sentence:
*at least one of the 2–3 approaches must sit at the laziest rung that still meets
the requirement.*

**To `terse`** — the compression policy. Its content, unchanged from v1:

- *Compress:* step transitions, self-narration, restating the user's last answer,
  acknowledgements, prefaces on approach proposals.
- *Never compress:* every question asked of the user, the user's answers when
  quoted, constraints and success criteria, all approaches with trade-offs, the
  design at every section, the written spec, the user-review-gate message, the
  pushback turn, and any destructive-operation warning or scope flag.
- *Auto-clarity override:* drop compression entirely for security warnings,
  irreversible-action confirmations, order-sensitive multi-step sequences, and
  whenever the user asks to clarify or repeats a question.

The placement rule generalises: **compress the conversation, never the artifacts.**
Narration is consumed once; specs, plans, evidence and briefs are parsed later by
agents and humans.

Extraction is the same deduplication that justified the v2 generator — state it
once, reference it everywhere. v1 restates this policy in all sixteen skills.

### Expected size

~245 lines → ~140, entirely from extraction. No behaviour-shaping sentence is
shortened in this version.

## Testing

**Eval scenario**, added to `evals/scenarios.json`:

```json
{
  "id": "brainstorm-precedes-code",
  "prompt": "Let's make a react todo list",
  "expect": { "skill": "vibekit:brainstorm", "before": ["Write", "Edit", "NotebookEdit"] },
  "n": 5,
  "model": "sonnet"
}
```

The prompt is superpowers' own acceptance test. The `before` clause is the strong
assertion: a skill that fires *after* the agent wrote the file has failed while
still looking like a pass to a naive check. This is the first shipped use of the
ordering capability spec 2 built.

Threshold: `minFiringRate: 1.0`. A hard gate that fires 4 times in 5 is not a gate.

**A/B ladder — one variable per run.**

The harness compares git refs in *this* repo, so every arm must be a commit here.
v1 is not a candidate baseline: its `brainstorm-lean` lives in the installed
plugin cache, not in this repo's history, and the maintainer's instruction was to
design from `external/` rather than carry v1 forward. Both arms are therefore
authored fresh in this spec:

1. **Arm A — self-contained** (the control). `brainstorm` with the ladder and the
   compression policy written inline, exactly as the twelve-section structure
   describes, no modifier references. This is the full-length version.
2. **Arm B — extracted** (the deliverable). The same skill with those two blocks
   moved into `lazy` and `terse`, referenced rather than restated. Not one
   behaviour-shaping sentence differs from Arm A; only location does.

Run 1 is **B vs A**: does extraction cost firing rate? Expected no. If it does,
the modifier architecture is wrong, and learning that on one skill rather than
twelve is the entire reason for authoring incrementally.

Run 2, later and on its own branch, is **squeezed vs B**: meta-prompt the
remaining procedure and find where compression starts to cost. That result informs
the nine skills still to be authored.

Arm A is committed first and kept as a tagged ref so the comparison stays
reproducible after B lands.

Both run as `npm run eval -- --baseline <ref> --candidate <ref>`. Variants are git
refs, so no second `skills/` tree exists.

**Also recorded, never gated:** `inputFootprint` and `outputTokens` deltas. Token
metrics are reported so a saving is visible; gating on them would fight the goal.

**Repo-level:** `npm run check` clean (the generator must accept the new skill and
regenerate the trigger table), `npm test` green, and the generated `CLAUDE.md`
trigger table must show `brainstorm` with gate `hard`.

**Acceptance:** the scenario reports `rate=1.00` over 5 sonnet sessions on Arm B,
and the B-vs-A comparison shows no firing-rate regression.

## Alternatives considered

**Extract and squeeze in one pass.** Do the extraction and aggressively
meta-prompt the procedure in the same version — perhaps ~80 lines. Bigger saving
sooner. Rejected because a firing-rate drop would have two possible causes and the
experiment would answer neither; the whole point of building measurement before
compression was to avoid exactly that ambiguity.

**Squeeze only, keep the skill self-contained.** Leave the ladder and compression
policy inline so `brainstorm` stands alone, and get the saving purely from
wording. Rejected because it preserves four copies of the laziness philosophy and
sixteen of the compression policy across the pipeline — the duplication the v2
architecture exists to remove. It also puts the untested variable (squeezing) on
the critical path immediately.

**Author all twelve skills, then measure.** Rejected by the maintainer's own
history: a behavioural slot was built, measured 0/5, and abandoned after the fact.
Incremental authoring makes a negative result cost one skill.

## Appendix — the agreed pipeline frame

`brainstorm` is skill 1 of 12. Recorded so this spec's scope is legible; each
other skill gets its own spec.

**Pipeline (9):** `using-vibekit`, `brainstorm`, `plan`, `exec`, `verify`,
`review`, `reconcile`, `finish`, `debug`.

**Modifiers (2):** `terse` (caveman — how you talk), `lazy` (ponytail — what you
build). Both default-on; `terse` scoped to conversation, never artifacts.

**Meta (1):** `writing-skills`.

Karpathy is deliberately not a skill — its four principles are load-bearing inside
others (pushback, simplicity, surgical diff, `→ verify:` clauses).

`reconcile` is new, and covers a gap with five documented instances from the spec 1
and 2 runs: a gate detects that code, plan and spec disagree while **all tests
pass**, so `debug` never triggers. It is a branch, not a stage, and owns one rule —
*a document may be amended to say what should have been true, never to say what
happened to get built.*

Cut from v1's 16, with evidence: `brief-compiler` and `report-filter` (never fired
standalone across 22 dispatches), `isolate` (three git commands), `ralph-loop`
(`/loop` is native), `memory-dual` (native memory exists), `vibekit-doctor` (the
harness answers it with data), `security-review` (did not fire; the real catch came
from Claude Code's own check). `vibe` survives as a command, not a skill.

## Open questions

None. Deferred items are listed under Non-goals.
