# Verification Report — plan observation rule

**Date:** 2026-08-06
**Spec:** `docs/specs/2026-08-06-plan-observation-rule-design.md`
**Plan:** `docs/plans/2026-08-06-plan-observation-rule.md`
**Commit verified:** `HEAD` on `plan-observation-rule` (10 commits from `v2`)
**Tree digest:** `b06d2475b8fcc7f1faf04fd571003b6a4717dbaec3b051eaec9d4a58e781938a`

## Method deviations, declared

1. **Critical-requirements cost control.** G1 received three independent
   dispatched passes; ten further items received one grouped pass; G3 received
   none (see 2).
2. **G3 was marked `not satisfied` without dispatch.** It is a regression check
   requiring a paid eval run, and no run has occurred. No reading turns that into
   `satisfied`, and marking it failed can only make the verdict stricter.
3. **The ten grouped items were judged by one agent**, not ten. The gate's brief
   says a pass must not consult other requirements; grouping breaches that in
   letter. All ten returned `yes` and none is load-bearing for the verdict.

## Repo-level checks

- Tests: **pass** — `npm test` → exit 0, 164 passing
- Generated surfaces: **pass** — `npm run check` → exit 0
- Predicate guard: **pass** — `node --test tests/plan-clauses.test.mjs` → exit 0
- `git status --porcelain`: empty
- `git log --oneline v2..HEAD`: 10 commits
- Surgical-diff pass: **clean**, zero orphans

## Requirements

### G1. "The observation rule covers every value a plan states, not only verify clauses… and the clause rules read as its strictest case rather than as the whole rule."

- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: this requirement **failed two reviews during execution** before
  passing. After Task 1 the widened rule was three paragraphs against thirty
  clause-scoped lines; after Task 2 the provenance item closed it only
  retroactively at self-review. Task 3 was added mid-run to close the authoring
  half. All three passes independently cite the same three anchors: the general
  opening at `:79-83`, the *"A clause is the strictest case"* hinge at `:89`, and
  the closing enumeration at `:119-122` naming a line count in a task title, a
  path in a `Files` block, a version in global constraints and a task-number
  cross-reference, with *"there is no allowlist"*.

### G2. "Self-review asks a question the author can answer."

- Passes: single (grouped)
- Verdict: **satisfied**
- Evidence: item 4 — *"For every number, path, count and cross-reference in the
  plan, name where it came from"* — with `I ran it` and `I read it` passing and
  `I knew it` failing.

### G3. "`plan`'s measured behaviour does not regress." (three scenarios at n=10)

- Passes: not dispatched
- Verdict: **not satisfied** — unmeasured.
- Evidence: no eval run exists for this change. The newest artefact under
  `evals/results/` is `2026-08-06T06-49-50-949Z-HEAD.json`, from the `exec`
  cycle. `plan`'s three scenarios last measured 1.00 each against a version of
  the skill that no longer exists.

### G4. "The skill stays under its budget." (under 168 lines)

- Passes: single (grouped)
- Verdict: **satisfied**
- Evidence: `wc -l` → 154. Checked for reflow-gaming at byte level: *"the only
  >100-char lines (3: 170, and the shifted 127->146: 136) are byte-identical to
  v2, and every added line is <=80 chars matching the file's existing wrap."*

### Non-goals NG1–NG4 and constraints C1–C4 (single pass, grouped)

All eight **satisfied**. NG1 nothing sweeps the amendment path; NG2 no
subagent — `grep` for dispatch in the skill returns nothing; NG3 no test enforces
provenance, and `git diff v2..HEAD -- tests/ evals/` is empty; NG4 no symbol
machinery. C1 no trailers across 10 commits; C2 branch unprefixed; C3 spec and
plan committed under `docs/`; C4 `skills/plan/` holds only `SKILL.md` and the
diff touches no generated file at any path.

## Disagreements

None. All dispatched passes were unanimous.

## Overall verdict

**not ready.**

One blocker:

- **G3 not satisfied** — `plan`'s three scenarios have not been re-run. They hold
  at 1.00 each against the pre-change skill; the change is behaviour-shaping
  prose, so those numbers now describe a skill that no longer exists.

Suggested next step: `npm run eval -- --scenarios plan-fires,plan-no-predicted-output,plan-second-spec-shape -n 10`, digest pinned either side. Roughly $3–4. This is a do-no-harm check, not evidence the change works.

## What this change cannot show

Recorded because a reader should not infer more than the evidence supports.

There is no mechanical assertion for whether a value was derived, and none was
invented — this project has shipped three vacuous checks already, and a check
that cannot fail reads as evidence while proving nothing. G1 and G2 are
therefore text-presence verdicts: the rule says the right thing, and three
independent readers agree an author would apply it correctly. Whether authors
actually do is unmeasured.

The real test is the next cycle's defect count against a baseline of six
predicted-value defects across two cycles. That test is slow, n=1, and
confounded by who writes the plan. It is also free, and it is the only honest
one available.

## Defect provenance

Three defects surfaced during this cycle. All three were in the plan or the
spec; none was in an implementation.

- The spec's line-delta value was wrong **twice** — once estimated ("roughly
  fifteen lines"), once computed by a script that counted a replaced range
  including its blank lines where git replaced three content lines, not five.
  Corrected at `df9f68a`, with the lesson recorded in the spec itself: *running
  a computation over an assumed model is not observing the operation.*
- The spec's approach section specified two edits; three were needed, because two
  reviews found the first two left the clause section teaching a narrow reading.

The first of those is the exact defect class this change exists to prevent,
committed by its own author while writing the spec that proposes it.
