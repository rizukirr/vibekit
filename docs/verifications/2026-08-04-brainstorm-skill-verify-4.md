# Verification Report (run 4) — brainstorm skill

**Date:** 2026-08-04
**Spec:** docs/specs/2026-08-04-brainstorm-skill-design.md (amended at f11cadc)
**Plan:** docs/plans/2026-08-04-brainstorm-skill.md (amended at f11cadc)
**Prior reports:** verify.md (`ready`, at 90b7ab1) → verify-2.md (`not ready`, 5
blockers) → verify-3.md (`not ready`, 1 blocker)
**Commit verified:** dca93e9 (branch `brainstorm-skill`)
**Scope:** the single blocker left open by run 3 — R-B.

## Repo-level checks

- Tests: **pass** — `npm test` → exit 0, `111 pass / 0 fail`
- Drift check: **pass** — `npm run check` → `up to date`, exit 0
- Hook smoke test: **pass** — `npm run check:hook` → exit 0, `3 pass / 0 fail`
- `git status --porcelain`: empty
- Surgical-diff pass: **clean** (run 3, zero orphans; the only commit since is the
  results file this report is about)

## R-B — cleared

Requirement (plan, Task 11):

> "The result is information. **Do not adjust any skill, scenario or threshold to
> make it come out well** — that would destroy the measurement."

- Passes: yes / yes / yes
- Verdict: **satisfied**

Remedy 1 from run 3 was executed: a clean re-run at fixed code on both arms.

**Integrity proof.** HEAD was `2bf50c6` before the run and `2bf50c6` after.

```
git ls-files -s skills evals/scenarios.json evals/thresholds.json evals/run.mjs \
  evals/score.mjs evals/session.mjs evals/judge.md | sha256sum
```

returned the identical digest before and after:

```
3bbde11aafe54db6423eca9d65f532b153014e40c14638e84a5d73a667c5c544  -
```

`git status --porcelain` after the run showed exactly one new path — the results
file itself. Pass 1 verified this independently: "the digest matches exactly …
`git show --stat dca93e9` confirms only the results file/commit was added with no
skill/scenario/threshold edits."

**The measurement** (`evals/results/2026-08-04T16-24-22-484Z-HEAD.json`):

| arm | scenario | rate | n | err | footprint | judge |
|---|---|---|---|---|---|---|
| candidate | brainstorm-precedes-code | 1.00 | 5 | 0 | 21,138.6 | followed 0.00, score 2.0 |
| candidate | lazy-reachable | 1.00 | 5 | 0 | 21,258.8 | followed 0.80, score 3.4 |
| baseline | brainstorm-precedes-code | 1.00 | 5 | 0 | 18,393.8 | followed 0.20, score 3.0 |
| baseline | lazy-reachable | 0.00 | 5 | 0 | 18,540 | followed 0.00, score 0.0 |

Verdict `PASS`, zero session errors, zero judge errors across all 20 sessions.

`lazy-reachable` 0.00 on the baseline is **structural, not a regression**: tag
`brainstorm-arm-a` predates the modifiers and ships no `lazy` skill, so the
scenario asserts a skill that does not exist on that arm. Pass 2 and pass 3 both
identified this unprompted and both classed it as disclosed rather than tuned.

## What this run establishes, and what it does not

**Establishes.** At fixed code: `brainstorm` fires before any file write, 5/5.
The delegation chain resolves, 5/5. Extraction costs ~2,750 input tokens per
session (21,139 vs 18,394 on the matched scenario) — a cost, not a saving.

**Does not establish.** The `0.00 → 1.00` history remains what it was: run A and
run B differed in both artefact and probe, so that delta is not an effect size and
is not cited as one. This run replaces it rather than rehabilitating it — the
1.00 here stands on its own, measured once, at code nobody touched.

**W3 still stands.** n=5 per arm. 5/5 does not distinguish 1.00 from ~0.85.

## Open, not blocking

**The judge says `brainstorm` is invoked and largely not followed.** Candidate
`followed=0.00, score=2.0`; baseline `followed=0.20, score=3.0`. Both arms are
poor and the candidate scored lower than the baseline, on a metric with 5 graded
samples and no errors, so the signal is now credible even though the sample is
small. Prior run reported score 3.0 for the same candidate scenario, so run-to-run
variance on this metric is at least ±1.0.

The most likely explanation is the harness's session shape: a single-turn `-p`
session ends at `brainstorm`'s first clarifying question, so no run can exhibit a
completed procedure and any grader asking "was the procedure followed" should be
expected to say no. That is a hypothesis, not a finding — nobody has read a
transcript against the rubric.

This is not a blocker: it is identical in kind on both arms, so it says nothing
about the change under review. It is the most valuable open question for the
remaining nine skills, and it belongs in their specs.

## Overall verdict

**ready**

All five blockers from run 2 are cleared on evidence. Repo-level checks green,
surgical-diff clean, 40 live sessions across two runs with zero errors.

Next: review-pack.
