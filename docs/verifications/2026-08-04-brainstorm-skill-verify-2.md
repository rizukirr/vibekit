# Verification Report (run 2) — brainstorm skill

**Date:** 2026-08-04
**Spec:** docs/specs/2026-08-04-brainstorm-skill-design.md
**Plan:** docs/plans/2026-08-04-brainstorm-skill.md
**Prior report:** docs/verifications/2026-08-04-brainstorm-skill-verify.md (verdict `ready`, at 90b7ab1)
**Commit verified:** befd46c (branch `brainstorm-skill`)
**Scope:** the twelve commits `90b7ab1..HEAD`, i.e. the review-fix tasks (8–10),
the Task 11 measurement, and the unplanned repair commit `6ef25c3`.

## Repo-level checks

- Tests: **pass** — `npm test` → exit 0

  ```
  ℹ tests 111
  ℹ suites 0
  ℹ pass 111
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 276.444715
  ```

- Drift check / build: **pass** — `npm run check` → exit 0

  ```
  up to date
  ```

- Hook smoke test: **pass** — `npm run check:hook` → exit 0

  ```
  ℹ pass 3
  ℹ fail 0
  ```

- Type checker: N/A — no TypeScript in this repo.
- Linter: N/A — none configured (zero dependencies).

- `git status --porcelain`:

  ```
  ```
  (empty)

- `git log --oneline 90b7ab1..HEAD`:

  ```
  befd46c eval: A/B run 1 re-measured — lazy-reachable 0.00 to 1.00, verdict PASS
  6ef25c3 fix: make modifier skills actually load, and the eval able to see it
  a89442d test(evals): judged re-measurement — lazy never fires, judge mostly errored
  0b8451d plan: rescope Task 11 — judge and delegation at n=5, W3 accepted as a limitation
  02bc27a chore: complete Tasks 8-10 — review fixes
  bc07d05 plan: correct Task 8's unsatisfiable verify clause
  4f44db6 refactor(skills): drop the paragraph brainstorm duplicated from lazy
  9d6335f test: make the coverage assertion capable of failing
  c9bc1a8 feat(skills): bootstrap describes the discipline, not an empty stub
  03ef1a3 plan: add Tasks 8-11 for review findings
  76ab50f docs: review-pack findings — no blocks, four warns
  0b6415a docs: verification report for the brainstorm skill — ready
  ```

- Surgical-diff pass: **orphans-found** — hard fail. Eleven orphans, all
  introduced by `6ef25c3`. Verbatim from the auditor:

  - `evals/run.mjs:143-151, 163` — "Adds extractJson() and rewires judgeTranscript() to use it; no plan task's Files section lists evals/run.mjs, and the spec's Non-goals explicitly excludes 'Changing the eval harness. It is used as built.'"
  - `tests/eval-run.test.mjs:4, 89-104` — "Imports and tests extractJson(), companion to the unauthorized evals/run.mjs change; not listed in any task's Files section."
  - `skills/lazy/SKILL.md:3-4` — "description/trigger rewritten to 'invoke once, then stays on' phrasing; Task 2 authored the original content, Task 11 (the only later task touching this period) does not list skills/lazy/SKILL.md in its Files section."
  - `skills/lazy/SKILL.md:15-17` — "Persistence section reworded ('Invoke once, then active...'); same — no task authorizes a post-Task-2 edit to this file."
  - `skills/terse/SKILL.md:3-4` — "description/trigger rewritten in the same 'invoke once' pattern as lazy; Task 3 authored the original, no later task lists skills/terse/SKILL.md."
  - `skills/terse/SKILL.md:15-17` — "Persistence section reworded; unauthorized post-Task-3 edit."
  - `skills/brainstorm/SKILL.md:33-36` — "Procedure step 1 rewritten to move the lazy/terse delegation from a standalone sentence (added by Task 4) into an explicit invocation instruction, renumbering steps 2-11; this is a second edit to brainstorm's body after Tasks 1/4/8 closed, with no task authorizing it."
  - `skills/using-vibekit/SKILL.md:42-48` — "The 'Always on' section is rewritten from 'Apply them throughout' to explicit invoke-once-then-persist instructions; Task 9 (which authored this file) is already committed/closed before 6ef25c3, and no task's Files section names skills/using-vibekit/SKILL.md again."
  - `CLAUDE.md:13-14` — "Trigger-table rows for lazy/terse regenerated to reflect the unauthorized trigger-string changes above; derivative of an orphaned source edit, not itself sanctioned by any task."
  - `AGENTS.md:14-15` — "Same regenerated trigger-table rows for lazy/terse, derivative of the unauthorized skill frontmatter edits."
  - `README.md:11-12` — "Skill-list descriptions for lazy/terse regenerated to match the unauthorized description-line rewrites."

## The measurement

Task 11's paid run executed twice. Both results files are committed.

| | run A (`a89442d`) | run B (`befd46c`) |
|---|---|---|
| `lazy-reachable` rate (candidate) | 0.00 | 1.00 |
| `lazy-reachable` rate (baseline) | 0.00 | 0.00 |
| `brainstorm-precedes-code` rate | 1.00 | 1.00 |
| judge errors | 4 of 5 | 0 of 5 |
| candidate input footprint | 18,299.2 | 21,180.2 |
| verdict | FAIL | PASS |

Run B is **not** a repeat of run A. Between them, four skill files and the
scenario prompt changed. See R-B.

## Requirements

Scope note: CR1, CR2, CR4–CR7 and G4–G6, N1–N3, C1–C4 were verified at 90b7ab1 in
the prior report and are unaffected by this commit range except where restated
below. Three requirements are re-verified at three passes each because the new
commits bear on them directly.

### R-A. Task 11 verify clause: "writes a results file where both arms report `incomplete: false`, `brainstorm-precedes-code` carries a non-null `judge` block, and `lazy-reachable` has a numeric rate" `[single-pass]`
- Verdict: **satisfied**
- Evidence: `evals/results/2026-08-04T15-20-05-729Z-HEAD.json` — every arm
  carries `"incomplete": false`; `candidate.brainstorm-precedes-code.judge` is
  `{"graded": 5, "followedRate": 0, "meanScore": 3, "errors": 0}`;
  `candidate["lazy-reachable"].rate` is `1`.
- Caveat, non-blocking on this requirement but material: the clause is satisfied
  by a run whose scenario prompt differs from the one the plan specifies. See R-B.

### R-B. "The result is information. **Do not adjust any skill, scenario or threshold to make it come out well** — that would destroy the measurement." (plan, Task 11)
- Passes: no / partial / no
- Verdict: **disagreement: escalate**
- Pass 1: no — "The failing result was not accepted as information; the scenario
  prompt, thresholds' target, and skill/description wording were all altered
  specifically because the run came out FAIL, and the re-run then scored PASS —
  the exact adjustment-to-make-it-pass the requirement forbids."
- Pass 2: partial — "Evidence shows the FAIL result was addressed by rewriting the
  scenario prompt, threshold-adjacent skill/gate behavior, and the eval itself
  until it passed, not left as pure information — the justification may be
  legitimate but the evidence as quoted does not establish that skills/scenario/
  threshold were left untouched to preserve the measurement."
- Pass 3: no — "The scenario prompt and skill/threshold wiring were rewritten
  specifically because the initial run failed, and the re-run then passed — this
  is adjusting skill and scenario to make the result come out well, which is
  exactly what the requirement forbids regardless of the stated justification."
- Correction to pass 1's reasoning: `evals/thresholds.json` was **not** changed
  between the two runs — `lazy-reachable: { "minFiringRate": 0.5 }` is identical
  in both. The verdict does not rest on that point in passes 2 or 3.
- Action required: the user decides. The two readings are stated under
  §Disagreements.

### R-C. "Reduce its length by **extraction only** — move duplicated policy into the `lazy` and `terse` modifiers — with no behaviour-shaping sentence shortened." (spec §Goals)
- Passes: no / no / no
- Verdict: **not satisfied**
- Evidence: `skills/brainstorm/SKILL.md` is now **164 lines**. The prior report
  recorded 163 as the extraction-only result against a 196-line control, so the
  file has grown, and the growth is newly authored prose rather than extraction:

  ```
  -Apply `lazy` (what you build) and `terse` (how you talk) throughout.
  +1. **Invoke `lazy` and `terse` before anything else.** `lazy` governs what you
  +   build, `terse` how you talk; both stay on for the rest of the session. Their
  +   description lines are not their content — you have not read either skill until
  +   you have invoked it.
  ```

- Pass 2's reading is the sharpest: "re-expands the one-line lazy/terse delegation
  into a longer inline paragraph in SKILL.md itself, growing the file and
  duplicating policy back in rather than keeping it extracted."
- Mitigating fact the passes were not given: the growth is 1 line net (163 → 164),
  and no pre-existing behaviour-shaping sentence was shortened or deleted. The
  requirement's second clause holds; its first clause does not.

### R-D. "**Changing the eval harness.** It is used as built." (spec §Non-goals — negative requirement)
- Passes: no / no / no
- Verdict: **not satisfied** — the non-goal is violated
- Evidence: `evals/run.mjs` gained `extractJson()` and `judgeTranscript()` was
  rewired to call it:

  ```
  +export function extractJson(text) {
  +  const s = String(text ?? '')
  +  const start = s.indexOf('{')
  +  const end = s.lastIndexOf('}')
  +  return start === -1 || end < start ? s : s.slice(start, end + 1)
  +}
  ...
  -    return JSON.parse(outer.result)
  +    return JSON.parse(extractJson(outer.result))
  ```

  The prior report recorded this same non-goal as satisfied on the evidence "no
  `evals/*.mjs` file changed". That is no longer true.
- Pass 1: "this is a direct edit to the eval harness, contradicting the non-goal
  that it 'is used as built'".

### R-E. "No shipped file may name a project vibekit only borrows from." `[single-pass]`
- Verdict: **satisfied** — `tests/no-external-references.test.mjs` passes within
  the 111-test green run above, and it covers every `skills/*/SKILL.md` including
  the four files `6ef25c3` edited.

### R-F. Plan bookkeeping `[single-pass]`
- Verdict: **not satisfied**
- Evidence: Task 11's seven steps are all `- [ ]` and none are `- [x]`. The task
  was executed (twice) but never marked complete, so the plan does not reflect the
  repo.

## Disagreements

**R-B — "do not adjust to make it come out well".**

- Pass 1: no — the scenario prompt and skill wording were altered after a FAIL and
  the re-run passed.
- Pass 2: partial — the justification may be legitimate, but the quoted evidence
  does not establish the measurement was preserved.
- Pass 3: no — adjusting skill and scenario after a failing result is what the
  clause forbids regardless of justification.

The two defensible readings, stated fairly:

*Reading 1 — the clause was broken.* A failing measurement was followed by edits
to four skill files and the scenario prompt, and the re-run passed. Whatever the
motive, run B cannot be compared to run A: the artefact under test and the probe
both changed. The 0.00 → 1.00 delta is not an effect size, and treating it as one
is the failure the clause exists to prevent.

*Reading 2 — the clause does not reach this case.* The clause forbids tuning to
make a number look good. What run A exposed was a defect: `using-vibekit` told the
agent not to invoke the modifiers, so `lazy`'s body reached zero sessions; and
`brainstorm`'s hard gate ends a single-turn session before any coding prompt can
reach `lazy`, so the planned prompt could not have scored above 0 under any
behaviour. Both were confirmed by live probe sessions before any edit. On this
reading run A measured a bug, the bug was fixed, and run B measures the fixed
system — with the honest cost disclosed (footprint up ~2,900 tokens, the earlier
"−444 saved" retracted).

**Action required from the user.** These are not reconcilable by more evidence;
they are a judgment about what the clause was written to protect. The choice
determines the remedy — see §Overall verdict.

## Overall verdict

**not ready**

Blockers:

1. **Surgical-diff returned `orphans-found`** — eleven orphaned hunks across seven
   files, all from `6ef25c3`, a commit authored live in a chat session with no
   plan task behind it. This alone bars `ready` under the skill's own rule.
2. **R-D not satisfied** — the spec's non-goal "Changing the eval harness. It is
   used as built." is violated by the `extractJson` change to `evals/run.mjs`.
3. **R-C not satisfied** — `brainstorm` is 164 lines against the 163 the
   extraction-only goal produced, and the growth is newly authored prose.
4. **R-B disagreement** — unresolved, user-actionable.
5. **R-F not satisfied** — Task 11's checkboxes are unticked; the plan does not
   reflect what was executed.

None of these say the change is wrong. The repair is well-evidenced and the tests
are green. What they say is that it arrived outside the process the spec and plan
define, and that two of the spec's own boundaries were crossed to make it.

Suggested next step: **amend the spec and plan, then re-verify.** Concretely — add
a task covering the four skill edits and the `evals/run.mjs` change; strike or
reword the "Changing the eval harness" non-goal, since the harness demonstrably
needed a fix to produce a usable judge signal; restate the extraction goal to
account for the delegation being an instruction rather than a reference; tick Task
11. Then re-run this gate. The alternative — reverting `6ef25c3` to restore
conformance — would reinstate a plugin whose modifier skills never load, and is
not recommended.
