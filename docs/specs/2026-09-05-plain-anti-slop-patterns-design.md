---
title: plain anti-slop patterns
date: 2026-09-05
status: approved
---

# plain anti-slop patterns: Design

## Problem

vibekit's output reads as AI-generated in ways its current skills do not catch. `plain` holds three typography rules (no em dash, no semicolon, no hard wrapping). `terse` holds five prose tells (throat-clearing openers, "not X, it's Y", emphasis adverbs, passive voice, vague declaratives), but `terse` governs narration only by its own placement rule, so those five never reach a spec, a plan, a commit message or a code comment.

That leaves a large uncovered surface. Structural slop such as lists where every item is a bold label, headings restated by the sentence below them, runs of clipped fragments, and lists padded to three items goes unaddressed on both surfaces. So does drafting residue: options raised only to be rejected, objections nobody made, and descriptions of what the code used to do.

The reference for what is missing is blader/humanizer v2.11.2, a 35-pattern skill derived from Wikipedia's "Signs of AI writing". Ten of its patterns do not overlap anything vibekit already states.

## Goals

- `skills/plain/SKILL.md` states thirteen rules, and `tests/plain.test.mjs` asserts the presence of all thirteen rule phrases rather than the current three.
- Rule 1 covers the em dash, the en dash, the spaced dash form, and the double hyphen used as a dash, while keeping the literal string `No em dash` so the existing assertion at `tests/plain.test.mjs:11` still matches.
- `skills/plain/SKILL.md` contains a guard section, scoped to tiers 2 and 3, that names at least the five false positives which would otherwise collide with `brainstorm`, `debug` and `exec`.
- Five new eval scenarios exist in `evals/scenarios.json`, each at `n: 10`, covering curly quotes, decorative emoji, title-case headings, bold mini-heading list items, and the en dash.
- The three existing em-dash scenarios (`terse-omits-em-dash`, `plain-omits-em-dash-in-artifact`, `terse-omits-em-dash-short`) use a regex that matches the en dash as well as the em dash.
- `npm run check` and `npm test` both exit 0 after `npm run generate`.
- An A/B eval run is recorded: a baseline at the pre-change commit and a post-change run, both reported per scenario with rates and opportunity counts.
- No existing scenario regresses by more than the 0.2 ceiling in `evals/thresholds.json`.

## Non-goals

- A judge-based scorer for the seven rules that no regex can score.
- Moving `terse`'s five Tells into `plain`. `terse` is not edited by this work.
- A new skill directory. The rules go into the existing `plain`.
- Porting all 35 humanizer patterns. Ten non-overlapping ones only.
- A CI linter over vibekit's own repository text. That is a separate idea and is not part of this design.

## Constraints

- `lib/model.mjs:30` reads exactly one `SKILL.md` per directory under `skills/`. There is no companion reference file, so all thirteen rules live in one body.
- `tests/plain.test.mjs:24` pins `plain`'s frontmatter `description` by exact value. Widening the skill means editing that assertion in the same change.
- Generated files are produced by `npm run generate` and must never be hand-edited.
- The repository ships no dependencies and targets Node 24. Every check runs on a bare node.
- `evals/score.mjs:139-152` and `:230-235` compile `finalTextOmits` and `producedFilesOmit` with `new RegExp`, so a rule is scorable exactly when it is expressible as a regex.
- Default thresholds are `minFiringRate` 0.8 and `maxRateRegression` 0.2.
- `git worktree list` must be clean before any `evals/run.mjs` invocation. A leftover `.eval-worktrees/HEAD` silently measures the wrong commit.
- Prose additions to a skill have twice measured 0.00 against 0.00 in this repository. This design assumes nothing about effect size and exists to measure it.

## Approach

Widen `skills/plain/SKILL.md` from three rules to thirteen, in three tiers.

Tier 1, typography, six rules: the existing no em dash (widened to en dash, spaced dash and double hyphen), no semicolon, no hard wrapping, plus no curly quotes, no decorative emoji in headings or list items, and sentence case rather than title case in headings.

Tier 2, shape, four rules: no list where every item is a bold label followed by a colon, no sentence directly after a heading that only restates it, no run of three or more clipped fragments used as a punchline, and no padding a list to three items when the meaning has two or four.

Tier 3, drafting residue, three rules: no introducing an option nobody proposed in order to reject it, no answering an objection the text never raised, and no describing what the code used to do outside a changelog, migration note, release note, root cause or commit message.

A guard section titled "Not a tell by itself" covers tiers 2 and 3 in roughly eight lines. It is required rather than optional, because two of the rules collide with the pipeline without it. Rule 11 would fight `brainstorm`, which mandates two or three approaches with trade-offs and an Alternatives considered section. Rule 13 would fight `debug`, whose product is a root cause that usually describes prior behaviour, and `exec`, which writes commit messages where prior behaviour is the point. The guards state that three items are fine when there are three things and the tell is padding, that one short sentence for emphasis is fine and the tell is a run, that a heading followed by a definition is fine and the tell is a restatement, that an alternative is fine when it is weighed and the tell is one raised and dropped in the same clause, and that prior behaviour is fine in the document types listed above and the tell is it appearing in a description of current behaviour.

`plain`'s closing boundary line, currently "How text is typed, not how much of it there is", becomes false under tiers 2 and 3 and is rewritten to cover shape rather than typing alone.

`plain` was chosen over a new skill because it already declares the required scope in its "Where this applies" section, and because `brainstorm` step 1 already names it in the sentence "Invoke `lazy`, `terse` and `plain` before anything else". That sentence is a sponsor, and a sponsor is the mechanism this repository measured moving a modifier from 0.00 to 1.00. Widening `plain` inherits it at no cost.

The user was offered a smaller framing in the pushback turn: ship only the six measurable rules first, learn whether the mechanism works at all, and add the rest on that evidence. The user chose the larger framing, all ten in one pass. The user separately chose to widen existing rules in place rather than move `terse`'s Tells.

## Alternatives considered

A new modifier skill, `skills/voice/`, holding the ten patterns and leaving `plain` at 32 lines. Rejected. A new modifier does not fire on its own, and the trigger row plus description suffix were previously measured worth only 0.1 to 0.2, so it would need an explicit sponsor sentence added to `brainstorm` and probably to `plan`, `exec` and `verify`. That is four gate skills edited, a new trigger row, regenerated tables across four runtimes, and a new firing mechanism tested at the same time as the patterns. A 0.00 result would not say which of the two failed.

Six measurable rules first, four judgment rules later. Offered as the pushback and declined in favour of the larger framing. Recorded because it remains the fallback if the post-change A/B shows no movement.

Moving `terse`'s five Tells into `plain` so they govern artifacts as well as narration. Declined by the user. It would grow `plain` to eighteen rules, shrink `terse` to pure compression, and require rework of `tests/terse.test.mjs` and two terse scenarios.

Porting all 35 humanizer patterns. Rejected as roughly 450 added lines against a 9,956-token baseline, duplicating a skill that is separately installable alongside vibekit.

## Testing

Unit tests. `tests/plain.test.mjs` extends its phrase list from three entries to thirteen, so a rule silently deleted from the skill body fails the suite. The pinned `description` assertion is updated to the new value in the same commit.

Eval scenarios. Five new entries in `evals/scenarios.json`, each `n: 10`, matching the newer scenarios rather than the underpowered `n: 5` group, because n=5 has already produced a 0.80 to 0.40 swing in this repository with no code change. Each uses `producedFilesOmit` when the rule is being tested on the artifact surface and `finalTextOmits` when it is being tested on narration. The regexes are the widened dash as `[—–]|\s--\s`, curly quotes as the four curly marks, decorative emoji at the start of a heading or list item, title-case headings, and bold mini-heading list items as a line-anchored form.

Anchoring. `evals/score.mjs` compiles every pattern with `new RegExp` and passes no flags, so the multiline flag is unreachable and a bare `^` would anchor to the start of the whole text. Line anchoring is therefore written as `(^|\n)`, and the emoji ranges use surrogate pairs rather than `\u{...}`, which needs the equally unreachable `u` flag. An unanchored `finalTextOmits` has been measured far harder than an anchored one, so each new scenario records its opportunity count in the results, otherwise its rate is not comparable to the existing scenarios.

Regression detection. `plain-reachable` and `plain-omits-semicolon` are left unchanged and act as the detectors for whether roughly 80 added lines dilute the skill. A drop beyond 0.2 fails the run.

Procedure. Check `git worktree list` is clean. Take a baseline `npm run eval` at the pre-change commit. Apply the change. Run `npm run eval` again. Report both, per scenario, with rates and opportunity counts. The eval gate is manual and never ships.

## Open questions

Seven of the thirteen rules ship unmeasured: hard wrapping, heading echo, fragment runs, padded triads, fake alternatives, unraised objections and previous-version writing. No regex scores them and this design does not build a judge. Their effect is unknown and this is the accepted cost of the larger framing.

The title-case heading regex may false-positive on legitimate proper nouns in a heading, for example a heading naming Claude Code or GitHub Actions. The acceptable false-positive rate is not yet decided, and the regex may need a proper-noun allowance before it is trustworthy.

Whether roughly 80 added lines regress `plain`'s three existing scenarios is unknown until the A/B runs. If they regress beyond 0.2, the fallback recorded in Alternatives considered becomes the plan.
