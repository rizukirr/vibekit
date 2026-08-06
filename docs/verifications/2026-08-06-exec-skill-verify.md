# Verification Report — exec skill

**Date:** 2026-08-06
**Spec:** `docs/specs/2026-08-05-exec-skill-design.md`
**Plan:** `docs/plans/2026-08-05-exec-skill.md`
**Commit verified:** `HEAD` on `exec-skill` (18 commits from `89570e7`)
**Tree digest:** `git ls-files -s skills evals | sha256sum` →
`6e1ccc973a9fcb0ebbd34a638ad4caffa831e726daf47838b7830ec915cd4efa`

## Method deviations, declared

1. **Critical-requirements cost control was taken.** The spec yields roughly 21
   requirements. Two received three independent dispatched passes; eleven
   received a single grouped pass; four received none (see 3).
2. **The eleven single-pass items were dispatched in one grouped agent**, not
   eleven agents of one. The gate's brief says a pass must not consult other
   requirements; grouping breaches that in letter. All eleven returned `yes`,
   and none is load-bearing for a verdict that is `not ready` on other grounds.
3. **Goals 1, 2, 3 and 5 were marked `not satisfied` without dispatch.** Each is
   stated in the spec as an observable of a paid eval run. No run has occurred.
   No amount of reading turns that into `satisfied`, and marking them failed
   directly can only make the verdict stricter.

## Repo-level checks

- Tests: **pass** — `npm test` → exit 0, 164 passing
- Generated surfaces: **pass** — `npm run check` → exit 0
- Predicate guard: **pass** — `node --test tests/plan-clauses.test.mjs` → exit 0
- `git status --porcelain`: empty
- `git log --oneline 89570e7..HEAD`: 18 commits
- Surgical-diff pass: **clean**, zero orphans, over the full range with the
  auditor asked specifically whether `evals/scenarios.json` was reserialised
  rather than edited in place. It was not.

## Requirements

### G1. "`exec` fires when a plan is approved and implementation has not started." (n=10)

- Verdict: **not satisfied** — unmeasured.
- Evidence: `exec-fires` is committed at `9460fd7` and has never run.
  `evals/results/` holds nothing dated after the exec work began; the newest
  artefact predates the first exec commit.

### G2. "A plan with any task lacking a `→ verify:` clause is rejected whole, before any dispatch."

- Verdict: **not satisfied** — unmeasured, and the scenario is known weak.
- Evidence: `exec-rejects-clauseless-plan` exists but has never run. Gate 2 on
  Task 6 found its original form **vacuous**: `transcriptMatches` scores against
  `run.raw`, the full stdout including tool results, and the seeded plan contains
  the literal string `Task 3`, so reading the plan satisfied the assertion. Task
  8 replaced that with `finalTextMatches` plus `onlyNewFilesMatching`. Gate 2 on
  Task 8 found the result **narrowed, not eliminated**: the regex still cannot
  distinguish *"Task 3 lacks a verify clause"* from *"Task 3 complete"*, and a
  `Bash`-less session cannot satisfy `exec`'s own git-based gate, so a refusal
  may occur for an unrelated reason.

### G3. "Work is handed over as file paths, not pasted text."

- Verdict: **not satisfied** — unmeasured.
- Evidence: `dispatchPromptMatches` and `dispatchPromptOmits` are implemented and
  unit-tested, including a case asserting a truncated prompt cannot satisfy an
  omission. No scenario currently uses them, and none has run.

### G4. "A task's `→ verify:` clause is executed, and its exit status decides."

- Verdict: **partial**.
- Evidence: stated unambiguously in the skill — *"Execute the task's `→ verify:`
  command yourself. Its exit status decides. This is the gate; there is no
  reviewer."* No eval asserts it, because sessions run without `Bash`. The spec
  declares this limitation in advance rather than discovering it.

### G5. "`exec` repairs nothing."

- Verdict: **not satisfied** — unmeasured.
- Evidence: stated in the skill's *Repair nothing* section and in *Never fix a
  finding yourself*. No scenario exercises a non-`done` return.

### G6 / R1. "The skill is smaller than every reference that does the same job." (under 160 lines)

- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: `wc -l` → 124. Pass 1 checked for reflow-gaming and reported
  *"total content 4,897 chars vs 41,245 for the 764-line v1 cluster, so the
  budget was met by genuine content reduction, not reflow"*. Pass 2:
  *"word count 866 vs 3601 (exec-dispatch alone) / 6391 (764-line cluster)"*.

### R2. "One directory, one file … the regenerated set is `CLAUDE.md`, `README.md` and `AGENTS.md`."

- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: `ls -1 skills/exec/` → `SKILL.md`; `npm run check` exit 0. Pass 3
  verified each generated change is *"a single added line inside its marker
  region: AGENTS.md:14 within vibekit:generated:trigger-table (lines 8–19),
  CLAUDE.md:13 within (7–18), README.md:11 within skill-list (7–16)"*. The
  previous cycle's `AGENTS.md` omission did not recur.

### Non-goals NG1–NG6 and constraints C1–C5 (single pass, grouped)

All eleven **satisfied**. NG1 no fix loop; NG2 *"there is no reviewer"*; NG3
*"Never dispatch two implementers at once"*; NG4 *"`exec` does not create the
workspace"*; NG5 no follow-through machinery; NG6 the Bash limitation is
declared in the spec. C1 no trailers across 18 commits; C2 branch `exec-skill`,
unprefixed; C3 artefacts under `docs/`; C4 harness changes landed as plan tasks
and no results file was written in range; C5 all three new scenarios specify
`n: 10`.

One correction to that pass: it described `exec-control` as a branch. It is a
tag. Immaterial to the verdict.

## Disagreements

None. All dispatched passes were unanimous.

## Overall verdict

**not ready.**

Blockers:

- **G1 not satisfied** — firing unmeasured.
- **G2 not satisfied** — rejection unmeasured, and the scenario is weak by its
  own gate's finding.
- **G3 not satisfied** — file-path handover unmeasured; no scenario uses the
  expectations built for it.
- **G5 not satisfied** — repair-nothing unmeasured.
- **G4 partial** — stated, unassertable in a `Bash`-less session.

Every blocker is the same blocker: `exec` is built and its harness support is
proven by unit tests, but no dispatch behaviour has been observed. Suggested
next step: run the three scenarios at n=10, plus the A/B
(`--baseline exec-control --candidate HEAD --scenarios exec-names-a-model`),
with the digest pinned either side.

## Defect provenance

Nine defects surfaced during this cycle. **All nine were in the plan or the
measuring apparatus; none was in a dispatched implementation.**

Plan defects: a hand-counted `promptLength: 34` for a 26-character prompt that
made a fixture unsatisfiable; two wrong task cross-references in the premortem;
three verify clauses violating the predicate rule the shipped `plan` skill
enforces.

Apparatus defects: `unsatisfiedReason` silently ignoring unknown expectation
keys, so a typo scores 1.00 — closed by Task 7, whose guard then caught
`finalTextMatches` in Task 8 before it could be ignored; and the vacuous
rejection scenario described under G2.

The pattern is now three cycles old and worth stating plainly: the implementers
do not fail. The plan and the instrument do.

---

## Addendum — Tasks 9 and 10, after this report was written

At the user's request, `exec` gained a requirement after verification ran: every
dispatch must instruct the implementer to invoke `lazy`. Two commits landed
after the report above.

**What changed.** Task 9 added the instruction to the dispatch prompt. Gate 2
found that structurally unsound on two counts, both correct: the implementer's
operative source of truth is the brief file — `exec` introduces it as *"its
requirements to use verbatim"* and the bootstrap tells subagents to *"skip this
and follow your brief"* — so an instruction beside the brief is framing a
compliant agent may ignore; and the same paragraph's tool restriction could
remove the means to load the skill it named. Both reduce the change to a
description-line reference, which this project has measured at a zero fire rate.
Task 10 moved the line into the brief and put the tool carve-out in the same
sentence as the restriction. Gate 2 re-judged both warns closed, verbatim.

**Effect on this report's verdicts.**

- **R1 (line budget) — still satisfied.** `wc -l` moved 124 → 134, against a
  budget of 160. The three passes judged the 124-line file; the ten added lines
  are the two replacements, and the reflow question they examined is unaffected.
  Re-dispatch was not run for this, which is a declared gap rather than a
  claim.
- **New goal — not satisfied, unmeasured.** No scenario asserts the dispatch
  prompt or brief mentions `lazy`. `grep -c lazy skills/exec/SKILL.md` = 2
  proves two lines exist in a file; it says nothing about whether the ladder
  reaches an implementer. Given the measured zero fire rate for
  referenced-but-uninvoked modifiers, that distinction is the whole question.
- **Overall verdict — unchanged: not ready.** One more unmeasured goal joins the
  four already listed.

**Defect count for the cycle rises to eleven, still none in an implementation.**
Task 10's own verify clause required `grep -c lazy` to find at least two
matches, but its two prescribed replacements were net-neutral on the word — one
added, one removed — and `grep -c` counts matching lines rather than matches.
A predicted count, not derived. Caught by the implementer, which halted before
committing a task that failed its own gate.
