---
title: parse fired not attempted
date: 2026-08-22
status: approved
---

# parse fired not attempted: Design

## Problem

`evals/parse.mjs:55` records a skill as fired when the assistant emits a `Skill` tool_use block. It never checks whether the call succeeded, so an attempt to invoke a skill that does not exist counts identically to a skill that loaded and was read.

The failure was captured directly. A session run against a worktree predating `skills/plain` produced:

```
TOOL_USE    name=Skill  id=toolu_01TV1H...  input={"skill": "vibekit:plain"}
TOOL_RESULT for=toolu_01TV1H...  is_error=true
   content="<tool_use_error>Unknown skill: vibekit:plain. Did you mean vibekit:plan?</tool_use_error>"
```

A successful call differs unambiguously. `is_error` is absent and the content reads `"Launching skill: vibekit:terse"`.

This produced wrong numbers in the `plain` cycle. In `evals/results/2026-08-22T11-00-37-062Z-HEAD.json`, the baseline arm ran against commit `67ae746`, where `skills/plain` does not exist in the tree. Yet `plain-omits-em-dash-in-artifact` recorded a baseline of 0.2 and `plain-omits-semicolon` recorded 0.4. Seven of ten sessions were scored as having fired a skill that was not there. Both should have been 0.0.

The cost is not only wrong baselines. Nine identical `skill vibekit:plain never fired` lines during that cycle hid the fact that some were a session declining to invoke and some were a session invoking something unavailable. Those are different diagnoses and they were indistinguishable.

## Goals

1. A skill attempted but absent from the session's offered skills is not reported as fired. Observable: a new fixture `evals/fixtures/skill-unavailable.jsonl` parses to a `skills` array not containing the attempted name, asserted by a test in `tests/eval-parse.test.mjs`.
2. An attempted tool is still recorded in `tools`. Observable: the same fixture parses to a `tools` array that does contain the `Skill` entry, asserted by its own test, so a later change cannot filter `tools` without turning the suite red.
3. A scenario whose expected skill was never offered reports that distinctly from one that was offered and not invoked. Observable: `evals/score.mjs` returns a reason containing `was not available` in the first case and `never fired` in the second, each asserted by a test in `tests/eval-score.test.mjs`.
4. No existing test regresses. Observable: `npm test` exits 0 and reports a total at or above the 206 currently passing.
5. The change is confined to parse and score. Observable: `git diff --name-only` against the merge base lists only `evals/parse.mjs`, `evals/score.mjs`, `evals/fixtures/skill-unavailable.jsonl`, `tests/eval-parse.test.mjs` and `tests/eval-score.test.mjs`.

## Non-goals

- Filtering `tools` or `dispatches`. They record a decision the model made rather than guidance it received. An errored `Write` still means the session chose to write before designing, which is exactly what the `before` expectation at `evals/score.mjs:101` exists to catch, and it reads `run.tools`. Filtering there would weaken the brainstorm gate by letting a session attempt and fail repeatedly while passing.
- Re-running the M-series from the `plain` cycle. Roughly 500 sessions to restate conclusions that do not change. The em dash rule still binds at 1.00 and sponsorship still moved firing 0.00 to 1.00, because `plain` existed in those candidate arms and the calls succeeded.
- Correcting results files already written. They are gitignored, they record what the old scorer measured, and rewriting them would destroy the record of what was actually observed.
- Detecting a skill that was offered, loaded, and then ignored. That is a different question and no evidence exists that it occurs.
- Any change to how `initSkills` is populated at `evals/parse.mjs:36`.

## Constraints

- `run.skills` has exactly three consumers in `evals/score.mjs`: the `skill` expectation at line 98, `after` at line 110, and `skillAbsent` at line 120. Filtering at parse time serves all three with one definition of fired. `before` at line 101 reads `run.tools` and is deliberately unaffected.
- The filter is unconditional. Every existing fixture that makes a `Skill` call already carries an init event listing that skill, verified across all four of `errored.jsonl`, `late-skill.jsonl`, `no-skill.jsonl` and `skill-fired.jsonl`, so no fallback branch is needed and no fixture changes. A fallback that trusted the attempt when `initSkills` is empty would silently restore the defect.
- An init event with an empty skills list is handled correctly by the same rule. A session offered no skills can load none, so filtering to nothing is the right answer, not an edge case.
- The filter is applied where the result is assembled, not at push time, so the init event's position in the stream cannot matter.
- `evals/parse.mjs` has two return paths. The early return for a session with no result event is one statement at line 71, carrying `skills` inline. The normal return opens at line 74 with `skills` on line 77. Both must carry the filtered list, or a run that failed to complete would still be scored against unfiltered attempts.
- `/docs` is gitignored per `.gitignore:4`, so this spec cannot be committed. `/evals/results` is gitignored per `.gitignore:5`.
- `evals/parse.mjs:9` describes the file as "Pure: JSONL text in, facts out. No fs, no network". The change must not break that.

## Approach

One filter in `evals/parse.mjs`, applied at result assembly:

```js
const fired = skills.filter(s => initSkills.includes(s.name))
```

`fired` replaces `skills` in both return paths. A comment at the filter states why `tools` and `dispatches` are not filtered, because the asymmetry reads as an oversight otherwise.

The improved diagnostic costs no new field. `evals/score.mjs` already receives `initSkills`, and a skill absent from that list could not have fired whether or not it was attempted:

```js
if (!hit) {
  return initSkills.includes(expect.skill)
    ? `skill ${expect.skill} never fired`
    : `skill ${expect.skill} was not available to the session`
}
```

**Pushback response.** The user was challenged on whether the simpler `initSkills` filter was preferable to correlating `tool_use` ids with `tool_result` blocks in `user` events. They chose the simpler framing. The `initSkills` approach infers failure from unavailability and catches the one failure mode actually observed. The correlation approach observes the outcome and catches any failure mode, at the cost of parsing `user` events in a file that currently reads only `system`, `assistant` and `result` events.

**Comparability boundary.** Every results file written before this change counts attempts. Every file after counts loads. That discontinuity is the intended effect. A reader comparing a rate across the boundary needs to know which scorer produced it, and this spec is the record of where the boundary sits.

## Alternatives considered

**Correlate tool_use ids with tool_result blocks.** Observes the outcome rather than inferring it, so it catches failure modes beyond unavailability. Rejected on the user's pushback answer. It requires `parse.mjs` to read `user` events, track ids across the stream, and reconcile at the end, which is a new parsing concern for a failure mode never observed.

**Check at scoring time instead, in the `skill` expectation only.** Smallest possible diff and it produces the same improved message. Rejected because it fixes one consumer of three. `after` and `skillAbsent` would keep the old semantics, leaving two definitions of fired in one file. `skillAbsent` is the sharp case: under the old semantics a session that attempted an unavailable skill fails a `skillAbsent` assertion for a skill that never loaded, which is backwards.

**Add a `skillAttempts` field to preserve the raw list.** Considered for the diagnostic, then dropped. `initSkills` already distinguishes unavailable from never-invoked, so the field buys nothing.

## Testing

`npm test` gates the change, and existing coverage must not regress.

One new fixture, `evals/fixtures/skill-unavailable.jsonl`, trimmed from a real captured transcript rather than hand-written. It contains an init event offering skills that exclude `vibekit:plain`, a `Skill` tool_use naming `vibekit:plain`, the matching `tool_result` with `is_error: true`, and a `result` event so the run parses as complete.

| Test | File | Asserts |
|---|---|---|
| skill absent from initSkills is not fired | `tests/eval-parse.test.mjs` | `skills` excludes the attempted name |
| the attempt is still in tools | `tests/eval-parse.test.mjs` | `tools` includes the `Skill` entry |
| unavailable reports distinctly | `tests/eval-score.test.mjs` | reason contains `was not available` |
| offered but not invoked still reports never fired | `tests/eval-score.test.mjs` | reason contains `never fired` |

No new eval sessions. The fixture demonstrates the behaviour end to end at parse time, and spending live sessions to watch a rate move from 0.20 to 0.00 buys nothing a 30-line JSONL file does not already prove.

## Open questions

1. Should `evals/thresholds.json` entries be revisited once rates are computed from loads rather than attempts? No threshold is known to depend on the difference, and none is changed here. Answered when a full sweep next runs.
2. Does any scenario currently pass only because an attempted-but-unavailable skill counted as fired? Only the three `plain-*` baseline arms are known to be affected, and nothing gates on a baseline. A full 27-scenario sweep would settle it, and is out of scope here.
