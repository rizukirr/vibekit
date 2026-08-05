> **Superseded by `2026-08-05-plan-skill-verify-2.md`.** This report reached
> `not ready` with four goals unmeasured. The evals have since been run and all
> four resolved. Kept because its blocker list is what prompted the run, and
> because the deviations it declares still stand.

# Verification Report — plan skill

**Date:** 2026-08-05
**Spec:** `docs/specs/2026-08-05-plan-skill-design.md`
**Plan:** `docs/plans/2026-08-05-plan-skill.md`
**Commit verified:** `f88b73c`
**Tree digest:** `git ls-files -s skills evals | sha256sum` →
`b72d250dd9615daf8950e1716cfdc92aa374b6f387c0a25f7a10cc8769340ec8`

## Method deviations, declared

Three, all disclosed rather than discovered:

1. **Critical-requirements cost control was taken**, as the gate's own clause
   permits at N ≥ 15. The spec yields 18 requirements. Four received three
   independent dispatched passes; ten received a single pass; four received no
   dispatch at all (see 3).
2. **The ten single-pass requirements were dispatched in two grouped agents**
   of five, not ten agents of one. The gate's brief template says a pass must
   not consult other requirements. Grouping breaches that in letter. Recorded
   because it weakens those ten verdicts, all of which are `yes`; none is
   load-bearing for the overall verdict, which is `not ready` on other grounds.
3. **Goals 1–4 were marked `not satisfied` without dispatch.** Each is stated
   in the spec as an observable of a paid eval run, and no run has occurred.
   No amount of reading the repository can turn that into `satisfied`. Marking
   them failed directly can only make the verdict stricter, never laxer, which
   is why it is a safe deviation — but it is a deviation.

## Repo-level checks

- Tests: **pass** — `npm test` → exit 0

  ```
  ℹ tests 135
  ℹ suites 0
  ℹ pass 135
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ```

- Generated-surface check: **pass** — `npm run check` → exit 0

  ```
  npm notice run node bin/generate.mjs --check
  up to date
  ```

- Predicate-rule guard: **pass** — `node --test tests/plan-clauses.test.mjs` → exit 0

  ```
  ✔ every verify clause in this repo is a predicate
  ✔ a straight-quoted string is caught
  ✔ a spelled-out count is caught
  ```

- `git status --porcelain`: empty (clean)

- `git log --oneline 2ae826d..HEAD`: 19 commits

- Surgical-diff pass: **clean** on re-run.
  First run returned `orphans-found` with one orphan:

  > `docs/plans/2026-08-05-plan-skill.md:565-567` — Commit 794bbc0 flipped
  > `- [ ]` to `- [x]` on three lines inside the fenced SKILL.md template
  > embedded in Task 5 Step 1. These are illustrative template lines, not plan
  > checkboxes. The change also makes the plan's embedded copy diverge from the
  > shipped `skills/plan/SKILL.md:63-65`.

  Cause: the `sed` range used to tick Task 5's step boxes matched inside the
  fence. Fixed at `f88b73c`; the embedded template is now byte-identical to the
  shipped skill, confirmed by a Python byte comparison returning
  `embedded==shipped: True`. Auditor re-run returned `clean`, zero orphans.

## Requirements

### G1. "**`plan` fires when a spec is approved and implementation has not started.** Observable: an eval scenario seeds an approved spec, prompts for the implementation plan, and asserts a `vibekit:plan` invocation appears in the transcript. Rate measured at n=5."

- Passes: not dispatched (see deviation 3)
- Verdict: **not satisfied**
- Evidence: the scenario exists and is committed —
  `220dd40 — eval: plan-fires and plan-no-predicted-output scenarios`. It has
  never been executed. `npm run eval` was not invoked at any point in this run,
  and `evals/results/` contains only 2026-08-03 and 2026-08-04 artefacts. No
  firing rate exists.

### G2. "**A plan authored under this skill contains no predicted output.** Observable: a mechanical post-run assertion greps every `→ verify:` clause in the produced plan for a quoted string, or for a number outside the permitted numeric forms defined in Approach. Zero hits is a pass."

- Passes: not dispatched (see deviation 3)
- Verdict: **not satisfied**
- Evidence: the assertion is implemented and unit-tested — `verifyClauses` and
  `isPredicate` in `evals/score.mjs`, exercised by eight cases in
  `tests/eval-score.test.mjs`, all passing. The scenario that would apply it to
  an agent-authored plan (`plan-no-predicted-output`) has not been run. What is
  proven is that the checker works, not that the skill produces plans that pass
  it.

### G3. "**Every task carries a `→ verify:` clause stating a predicate.** Observable: the same post-run assertion confirms every `### Task N` header contains `→ verify:`."

- Passes: not dispatched (see deviation 3)
- Verdict: **not satisfied**
- Evidence: `expect.tasksHaveVerify` is implemented in `evals/score.mjs` and
  unit-tested. Unmeasured against an agent-authored plan for the same reason as
  G2.

### G4. "**`plan` writes nothing outside `docs/plans/`.** Observable: the session's resulting diff touches exactly one file, in that directory."

- Passes: not dispatched (see deviation 3)
- Verdict: **not satisfied**
- Evidence: implemented as `expect.onlyNewFilesMatching` with a file-set
  assertion rather than a diff, because the eval temp cwd has no git and Bash is
  disallowed. The reinterpretation is recorded in the plan's Premortem. Never
  run.

### G5 / R-A. "**The skill is smaller than both predecessors.** Observable: `SKILL.md` is under 168 lines, against v1's 342 and the reference's 168."

- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence:
  - `wc -l skills/plan/SKILL.md` → `135 skills/plan/SKILL.md`
  - Pass 3 independently checked for reflow-gaming: *"body wraps at 80 columns
    (avg 35.7 chars/line, only two outlier lines from frontmatter), so the
    budget was not met by reflowing"*.
  - Criterion amended 120 → 168 mid-run at `a0177f4`, recorded inline in the
    spec.

### R-B. "**Dependency free.** No shipped file names any project vibekit borrows from; enforced by `tests/no-external-references.test.mjs`."

- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: `deps {} dev {}`; test output line
  `✔ no shipped file names a project vibekit only borrows from (5.756535ms)`.

### R-C. "**One directory, one file.** `skills/plan/SKILL.md`. Every other surface … is regenerated by `npm run generate` and enforced by `npm run check`. No generated file is hand-edited."

- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: `ls -1 skills/plan/` → `SKILL.md`; `npm run check` → exit 0,
  `up to date`. Pass 1 noted the enforcement loop working as designed: *"the
  AGENTS.md staleness at 33d84c8 was caught by the checker and regenerated"*.

### R-D. "**Eval harness capabilities are added before any measurement, as plan tasks.** … No harness change happens between a FAIL and a re-run."

- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: capabilities declared in the spec before implementation, built as
  Tasks 1–2 (`bbe11db`, `ab9ecd6`), scoring as Tasks 3–4 (`674f78d`,
  `dc62abc`), scenarios at `220dd40`. Pass 2: *"evals/results/ contains only
  2026-08-03/04 artefacts, so no plan eval run occurred and no harness change
  could sit between a FAIL and a re-run."*

### Non-goals NG1–NG5 (single pass, grouped)

All five **satisfied**. NG1 no `exec` shipped; NG2 no Interfaces block
(`grep -niE 'interfaces|consumes|produces'` finds only an incidental word in
the handoff sentence); NG3 no premortem, parallel-group markers or minimalism
constraint in the shipped skill; NG4 no follow-through machinery touched; NG5
shingle comparison against v1's `plan-write` yields *"0 shared 8-grams and no
shared sentences"*.

### Constraints C1–C5 (single pass, grouped)

All five **satisfied**. C1 no `Co-Authored-By` across 19 commits; C2 branch
`plan-skill`, unprefixed; C3 artefacts under `docs/`, tree clean; C4 vacuously
satisfied — no paid run occurred, so the pin-before/pin-after obligation never
triggered, and it is untestable as a positive demonstration; C5 both scenario
prompts name the artefact and point at a seeded in-project spec.

## Disagreements

None. All twelve dispatched passes were unanimous.

## Overall verdict

**not ready.**

Blockers:

- **G1 not satisfied** — firing rate unmeasured; `plan-fires` committed, never run.
- **G2 not satisfied** — no-predicted-output unmeasured against an agent-authored plan.
- **G3 not satisfied** — tasks-have-verify unmeasured against an agent-authored plan.
- **G4 not satisfied** — writes-nothing-outside unmeasured.

Every blocker is the same blocker: the skill is built and its checker is proven,
but the skill's behaviour is unmeasured. Nothing here is evidence that `plan`
fires or that what it writes obeys the rule.

Suggested next step: run `npm run eval` on the two new scenarios, n=5,
candidate-only, with the tree digest pinned either side. That is a paid run and
an explicit user decision, not something this gate authorises.

## Note on defect provenance

Six defects were found during execution, all in the plan and none in the
implementations: a wrong count ("four" for three), backticks treated as quotes,
`exit` not matching `exits`, `AGENTS.md` missing from the regenerated file list,
a line budget estimated before the body existed, and a checker that counted
fenced documentation as clauses. A seventh — the template checkboxes — was found
by the surgical-diff auditor after execution finished.

Every one was a predicted or assumed value written into a plan. That is the
defect class this skill exists to stop, occurring seven times in the first plan
written under it. It is the strongest available evidence that the rule targets
something real, and equally that prose alone does not reach it:
`tests/plan-clauses.test.mjs` now catches the mechanical subset on every commit,
and would have caught two of the seven.
