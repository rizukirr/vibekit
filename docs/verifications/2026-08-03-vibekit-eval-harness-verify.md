# Verification Report — vibekit eval harness

**Date:** 2026-08-03
**Spec:** docs/specs/2026-08-03-vibekit-eval-harness-design.md
**Plan:** docs/plans/2026-08-03-vibekit-eval-harness.md
**Commit verified:** 477fbc4 (branch `vibekit-eval-harness`, base `v2`@65b0894)

**Rigor:** critical-requirements-only three-pass, chosen by the user. Eight
requirements received three independent passes; eleven received a single pass and
are marked `[single-pass]` — weaker evidence, but a single-pass `no` or `partial`
still blocks the verdict, and one did.

## Repo-level checks

- Tests: **pass** — `npm test` → exit 0

  ```
  ℹ tests 98
  ℹ suites 0
  ℹ pass 98
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
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

- Dry run spawns nothing: **pass** — `npm run eval -- --dry-run`

  ```
  9 sessions — est. $0.18-$0.81
  candidate: HEAD
    candidate:footprint x3
    candidate:bootstrap-injected x3
    candidate:skill-invocable x3
  dry run — nothing spawned
  ```

- Type checker: N/A — no TypeScript in this repo.
- Linter: N/A — none configured (zero dependencies).

- `git status --porcelain`:

  ```
  ```
  (empty)

- Surgical-diff pass: **clean** — zero orphans across all 24 changed files. Re-run
  after Task 10 so the audit covers the full range, not just the original nine tasks.

- **Live evidence.** Two real runs were executed against this branch:

  Acceptance run (Task 9), 9 sessions:
  ```
  results: evals/results/2026-08-03T13-43-02-824Z-HEAD.json
    footprint: rate=1.00 footprint=9956 errors=0
    bootstrap-injected: rate=1.00 footprint=9956.666666666666 errors=0
    skill-invocable: rate=1.00 footprint=10286.666666666666 errors=0
  PASS
  ```

  Two-ref A/B run (performed during verification to close CR4), 6 sessions:
  ```
  $ npm run eval -- --baseline HEAD~1 --candidate HEAD --scenarios footprint
  6 sessions
  candidate: HEAD
  baseline: HEAD~1
  ......
    footprint: rate=1.00 footprint=9961.666666666666 errors=0
  PASS
  ```
  with both variant blocks recorded:
  ```
  candidate: {"id":"footprint","rate":1,"successful":3,"errored":0,"inputFootprint":9961.666666666666,...}
  baseline : {"id":"footprint","rate":1,"successful":3,"errored":0,"inputFootprint":9968,...}
  ```

  **15 live sessions total. Zero errored runs. No leaked worktree or temp directory.**

## Requirements

### CR1. "Detect whether a given skill fires at its trigger point, as a rate over repeated runs, deterministically and without a judge."
- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: `evals/parse.mjs` records `{type:"tool_use", name:"Skill"}` blocks with position — no model call. `evals/score.mjs`: `rate: good.filter(r => satisfied(scenario, r)).length / good.length`. Live: `skill-invocable: rate=1.00` over 3 runs with no judge.

### CR2. "Detect whether it fires *before* the actions it is supposed to precede."
- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: tool_use blocks carry a monotonic index across the whole stream, so ordering survives across separate assistant events. `evals/score.mjs`:
  ```
  const earlier = run.tools.find(t => t.name === forbidden && t.index < hit.index)
  if (earlier) return false
  ```
  `evals/fixtures/late-skill.jsonl` encodes the violating case. Tests: `✔ order expectation fails when the skill comes after a forbidden tool`, `✔ order expectation passes when the skill comes first`.
- Noted by all three passes: no shipped scenario uses `before` yet; the capability is unit-tested, and per-skill scenarios are spec 3's work.

### CR3. "Measure vibekit's own input-token footprint — the number compression must move."
- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: `inputFootprint: mean(good.map(r => r.usage?.cache_creation_input_tokens ?? 0))`. Dedicated non-gating `footprint` scenario. Live: `acceptance ok — footprint 9956 tokens`. Shown ref-sensitive across two refs (9961.67 vs 9968).

### CR4. "Compare any two git refs (baseline vs candidate) so a compression change can be accepted or rejected on evidence."
- Passes: yes / yes / yes (after a real two-ref run; see below)
- Verdict: **satisfied**
- **Pass 1 initially returned `partial`** — the comparison path was unit-tested but had never run against a real baseline, and the acceptance run recorded `baseline: null`. Rather than argue the point, a real two-ref run was executed (6 sessions, ~$0.13). It produced distinct candidate and baseline blocks in one results file and removed both worktrees. The three passes were then run against that evidence.
- Evidence: `git worktree add --detach <path> <ref>` per variant; `--plugin-dir <worktree>` per session; no `skills/` tree anywhere under `evals/`.

### CR5. "Zero dependencies, consistent with the rest of the repo."
- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: `deps: {} devDeps: {}`, no `node_modules`, no lockfile. All modules import only `node:` builtins. The judge shells out to the same `claude` binary rather than adding an SDK.

### CR6. "Never ship to users." / "`evals/` must stay out of `package.json` `files[]`."
- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence: `files: [".claude-plugin/",".codex-plugin/","commands/","hooks/","skills/","AGENTS.md","CLAUDE.md","LICENSE","README.md"]`; `evals shipped? false`. `files` is a generated allowlist that never mentions `evals/`.

### CR7. "Errored runs are never scored."
- Passes: yes / yes / yes (against the amended wording; see below)
- Verdict: **satisfied**
- **Pass 1 initially returned `partial`** against the original wording, which promised errored runs would be "re-run up to a small retry budget". No retry was built. The user chose to correct the sentence rather than the code: excluding errored runs from scoring is the correctness property, retry is a sample-size convenience, and on a paid run a rate limit is arguably better surfaced than silently absorbed. Amended at commit 98cb16c; passes re-run against the new text.
- Evidence: `ok: subtype === 'success' && isError !== true`; a missing result event returns `{ok: false, error: 'no result event'}` rather than an empty skills array; zero successful runs yields `incomplete: true, rate: null`. Tests: `✔ an unparseable transcript is an error, never a silent non-firing run`, `✔ a scenario with no successful runs is incomplete, not a zero rate`.

### CR8. "Sessions run in a disposable directory, not plan mode" (including the Bash hardening).
- Passes: yes / yes / yes
- Verdict: **satisfied**
- Evidence:
  ```
  const cwd = mkdtempSync(join(tmpdir(), 'vibekit-eval-'))
  ...
  '--permission-mode', 'bypassPermissions',
  '--disallowedTools', 'Bash',
  ...
  } finally { rmSync(cwd, { recursive: true, force: true }) }
  ```
  Tests assert the cwd is under `os.tmpdir()`, is not `process.cwd()`, no longer exists after the call, and that `--disallowedTools Bash` is passed.
- **This requirement exists because of a mid-run correction.** A security review flagged the original implementation: `bypassPermissions` grants `Bash`, and a temp cwd does not contain arbitrary command execution — yet the spec and plan both described the blast radius as "a directory the runner deletes". The task was rolled back, both documents amended at 875c08a, and the task re-run. Residual risk (an absolute-path `Write` escaping the temp dir) is now stated in the spec and accepted, since closing it needs an OS-level sandbox that conflicts with the zero-dependency constraint.

### G5. "Optionally judge whether a skill was *followed*, not merely invoked." `[single-pass]`
- Verdict: **satisfied**
- Evidence: `evals/judge.md` specifies the `{followed, score, why}` contract; `judgeTranscript` is wired behind `opts.judge`; unparseable judge output returns `judge_error` rather than throwing, so one bad response cannot abort a paid run.

### N1. "Running on every PR." `[single-pass]`
- Verdict: **satisfied** (correctly not done)
- Evidence: `git diff --name-only 65b0894..HEAD -- .github/` returned nothing. README states it is "a manual gate — not part of the free CI".

### N2. "Gating on token metrics." `[single-pass]`
- Verdict: **satisfied** (correctly not done)
- Evidence: all three `failures.push` calls in `compare()` are rate-based; no token value appears in any failure path.

### N3. "Authoring the pipeline." `[single-pass]`
- Verdict: **satisfied** (correctly not done)
- Evidence: `skills/` still contains exactly `example-command`, `example-plain`, `using-vibekit`.

### N4. "Testing runtimes other than Claude Code." `[single-pass]`
- Verdict: **satisfied** (correctly not done)
- Evidence: grep for `codex|opencode|cursor|gemini` across `evals/` returned nothing. Only `claude` is spawned.

### N5. "A scenario DSL." `[single-pass]`
- Verdict: **satisfied** (correctly not done)
- Evidence: `scenarios.json` is a plain JSON array; `expect` has three optional keys handled by conditionals. No parser, no custom syntax.

### C1. "Zero dependencies. Bare Node plus the `claude` binary." `[single-pass]`
- Verdict: **satisfied** — same evidence as CR5.

### C2. "Fails fast with a clear message if the `claude` CLI is absent." `[single-pass]`
- Verdict: **satisfied**
- Evidence:
  ```
  function requireClaude() {
    const probe = spawnSync('claude', ['--version'], { encoding: 'utf8' })
    if (probe.status !== 0) {
      throw new Error('claude CLI not available or not authenticated — cannot run evals')
    }
  }
  ```
  Called after the dry-run early return and before any worktree or session.

### C3. "Every metric is a rate over `n` runs, never a single boolean." `[single-pass]`
- Verdict: **satisfied**
- Evidence: `rate` is a fraction; thresholds are rates (`minFiringRate`, `maxRateRegression`); live output `rate=1.00` over 3 runs per scenario.

### C4. "Cost control is first-class... a `--dry-run` that prints the run plan and an estimated cost." `[single-pass]`
- Verdict: **satisfied** (was `partial`; fixed by Task 10)
- **The single pass initially returned `partial`**: the dry run printed a session count but no monetary estimate, while both spec and README promised one. The user chose to implement rather than drop the claim, on the grounds that this is the guardrail between a typo in `--scenarios` and an unexpectedly large bill. Task 10 was appended to the plan at ebf7bdb and executed.
- Evidence: `9 sessions — est. $0.18-$0.81`, and with `--judge`, `9 sessions + 9 judge calls — est. $0.36-$1.62`. Ranges are measured from real runs recorded in `evals/results/*.json`, not derived from token prices, and the flat per-model approximation carries a `vibekit:` marker naming its upgrade path.

### C5. "`evals/` must stay out of `package.json` `files[]`." `[single-pass]`
- Verdict: **satisfied** — same evidence as CR6.

## Disagreements

None outstanding.

Three requirements returned `partial` on first evaluation. None was a
disagreement between passes — each was a single verdict identifying a real gap,
and all three were resolved before the final verdict:

- **CR4** — closed by producing the missing evidence (a real two-ref run).
- **CR7** — closed by correcting an over-promising spec sentence.
- **C4** — closed by building the missing feature.

Worth recording as a pattern: all three were cases where a **spec sentence
described something the plan never built**. Verification caught them, but the
plan's premortem did not, and no verify clause would have — each task's clause
tested what the task built rather than what the spec promised.

## Overall verdict

**ready**

All 19 requirements satisfied. All repo-level checks pass. No disagreements. The
surgical-diff pass returned `clean` with zero orphans, re-run to cover Task 10.
15 live sessions executed with zero errored runs and no leaked state.

**The headline number: vibekit's input footprint is 9,956 tokens.** That is what
the plugin costs to merely exist in a session, measured rather than estimated,
and it is the baseline spec 3's compression must move.

Two items carried forward, neither blocking:

- `evals/worktree.mjs` guards deletion with `resolve(path).startsWith(ROOT)`, so
  a sibling directory named `.eval-worktrees-old` would pass the prefix test.
  Unreachable in practice — `remove()`'s only caller passes paths built by
  `materialise()`. Originates in the plan, not the implementation.
- The `before` ordering capability is unit-tested but exercised by no shipped
  scenario. Spec 3 adds per-skill scenarios that use it.

Next: review-pack, then user sign-off, then finish-branch.
