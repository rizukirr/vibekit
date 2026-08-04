# Review (round 2) — brainstorm skill

**Date:** 2026-08-04
**Spec:** docs/specs/2026-08-04-brainstorm-skill-design.md (amended at f11cadc)
**Plan:** docs/plans/2026-08-04-brainstorm-skill.md (amended at f11cadc)
**Verify report:** docs/verifications/2026-08-04-brainstorm-skill-verify-4.md (verdict `ready`)
**Prior review:** docs/reviews/2026-08-04-brainstorm-skill-review.md (0 blocks, 4 warns, 2 nits)
**Commits under review:** 6a09641..4b8871d on `brainstorm-skill`

## Diff summary

- Files changed: 23
- Lines added: 2,236, removed: 47
- Commits: 31
- Skill content: 360 lines across four skills (`brainstorm` 164, `terse` 82,
  `lazy` 60, `using-vibekit` 54)

## Findings

### Block

**B1. `evals/scenarios.json` — `terse` was extracted and no scenario asserts it is
reached. The spec's own goal, added four commits ago, requires one.**

The amended spec §Goals says, verbatim:

> - **The delegation must be observably load-bearing.** A skill that names a
>   modifier without causing it to be invoked has not delegated anything. Every
>   extraction ships with an eval scenario asserting the delegated skill is
>   reached.

`evals/scenarios.json` holds five scenarios — `footprint`, `bootstrap-injected`,
`skill-invocable`, `brainstorm-precedes-code`, `lazy-reachable`. `grep -c terse
evals/scenarios.json` returns `0`.

This spec extracted **two** modifiers. `lazy` got `lazy-reachable` and is measured
at 1.00. `terse` got nothing. The exact failure this goal exists to prevent —
content extracted into a file that never loads — is currently unmeasured for
`terse`, and it is the failure that actually happened here once already.

`terse` was observed invoking in the run-4 transcripts, so this is very likely a
paperwork gap rather than a live defect. But "very likely" is the standard the
goal was written to replace.

Two honest remedies:

1. **Add `terse-reachable` and measure it** — one scenario, one paid run
   (~$1–4.50 for the single scenario across both arms). Closes it on evidence.
2. **Narrow the goal to what was actually delivered** — reword it to bind the
   remaining nine skills prospectively, which is what its own inline comment
   ("binding on the remaining nine skills") already says, and record `terse` as
   knowingly unmeasured.

Remedy 2 is legitimate but it is the second time this spec's wording would be
adjusted to match the work rather than the reverse. I recommend remedy 1.

### Warn

**W1. `evals/results/2026-08-04T16-24-22-484Z-HEAD.json` — the candidate scored
*worse* than the control on the follow-through metric, and nobody knows why.**

```
candidate brainstorm-precedes-code  followed=0.00 score=2.0 graded=5 judgeErr=0
baseline  brainstorm-precedes-code  followed=0.20 score=3.0 graded=5 judgeErr=0
```

Zero judge errors on both arms, so the numbers are real numbers this time. The
same candidate scenario scored 3.0 one run earlier, so run-to-run variance is at
least ±1.0 and the gap may be noise. But the direction is unfavourable and the
verification report's explanation — that a one-shot session cannot exhibit a
completed procedure — is a hypothesis nobody has tested against a transcript.

Not a block: it is identical in kind on both arms, so it says nothing about the
extraction under review. It is the single most valuable open question for the
remaining nine skills.

**W2. `skills/using-vibekit/SKILL.md:42` hardcodes the modifier count in a
hand-written file.**

> Two skills are modifiers rather than steps: one governs what you build, the
> other governs how you talk.

The architecture's premise is that no hand-maintained file enumerates skills —
`CLAUDE.md`'s trigger table is generated precisely so it cannot drift. This
sentence reintroduces a hand-maintained count in the one document injected into
every session. A third modifier makes it silently wrong, and `npm run check` will
not catch it because the file is not generated.

**W3. `evals/scenarios.json:31-36` — `lazy-reachable` does not actually assert the
delegation chain.**

```json
"expect": { "skill": "vibekit:lazy" }
```

There is no `before` clause and no assertion that `brainstorm` preceded it. The
scenario passes if `lazy` fires from its own trigger without `brainstorm`
delegating at all. The transcripts did show the chain, but the scenario does not
encode it, so a future regression that breaks delegation while leaving `lazy`'s
own trigger intact would still score 1.00.

The harness already supports the needed assertion — `before` was built in spec 2
and is used by `brainstorm-precedes-code`. Tightening this is a one-line change to
the expectation, though re-measuring costs money.

**W4. n=5 per arm. Unchanged and knowingly accepted.**

5/5 does not distinguish 1.00 from ~0.85. Carried from the prior review, recorded
again because two more results files now quote 1.00 and the figure invites
over-reading. The honest claim remains "no regression detected at n=5".

### Nit

**N1. Four verification reports and two reviews now exist for one feature, with no
index.** `verify.md` still leads with a conclusion that is wrong; it carries an
inline correction block, so a reader who starts at the top is not misled, but a
reader who greps for "extraction is free" will find it. A one-line pointer at the
top of `verify.md` to `verify-4.md` would close it.

**N2. `skills/lazy/SKILL.md:57-60` and `skills/terse/SKILL.md:79-82` — near-identical
`## Boundaries` sections.** Four lines each, mirror images ("governs what you
build, not how you talk" / "governs how you talk, not what you build"). Deliberate
symmetry rather than accidental duplication, and each is useful in isolation.
Recorded only because the prior review's W1 was exactly this shape.

## Pass 4 — simplicity

- Skill content: **360 lines** across four files. Largest construct:
  `skills/brainstorm/SKILL.md`, 164 lines.
- New executable code in this range: `extractJson`, 6 lines, one caller, three
  tests covering the fenced case, the prose-wrapped case, and the no-braces case
  that must still fail.
- Could a senior engineer halve it? **No.** The skill bodies are pay-per-use —
  they load only on invocation — and squeezing procedure prose is an explicit
  spec non-goal deferred to A/B run 2. The only executable addition is six lines
  with a test each.

`Lean already.`

`net: -0 lines possible.`

## Pass 5 — surgical diff

**Clean.** An independent read-only auditor re-traced `90b7ab1..HEAD` after the
f11cadc amendment and returned `clean` with zero orphans, having verified Task
12's file list against `git show 6ef25c3` hunk by hunk rather than trusting the
amendment's own claim. The earlier portion of the range was audited clean in
review round 1.

## Self-critique (three risks)

1. **The judge metric may be measuring the harness, not the skill — and nine more
   skills are about to be built on it.** `followed=0.00` on both arms is
   consistent with "brainstorm is ignored" and with "a one-shot session ends
   before the procedure can be exhibited", and nothing in the diff distinguishes
   them. — **unmitigated.** Follow-up: read one run-4 transcript against
   `evals/judge.md` by hand and record which reading it supports. Costs nothing.

2. **Nothing measures a false-positive firing rate.** Both modifier descriptions
   were rewritten to "Use at the start of…", which is what made them fire. The
   same change may make them fire in sessions where they are irrelevant, and every
   invocation loads a 60–82 line body. The suite has no negative scenario — no
   prompt that asserts a skill does *not* fire. — **unmitigated.** Follow-up: a
   haiku scenario with a non-coding prompt (`"What time zone is UTC+7?"`)
   expecting no `lazy` invocation.

3. **The entire result rests on a host heuristic no test pins.** Firing depends on
   how the runtime matches a `description:` line to a request. If that matching
   changes, every skill's rate moves and the only detector is a paid eval run
   somebody has to remember to launch. — **partially mitigated:** `footprint` and
   `bootstrap-injected` run on haiku and are cheap, but neither asserts a
   *behavioural* trigger. Follow-up: promote one cheap haiku firing scenario into
   whatever runs routinely, so drift surfaces without a $10 run.

## Diff

Run: `git diff 6a09641..4b8871d`

Per-file summary is in §Diff summary.

## Sign-off

- [ ] User reviewed findings.
- [ ] User reviewed diff.
- [ ] User approves proceeding to finish-branch.
