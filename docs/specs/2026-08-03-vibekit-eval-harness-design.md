---
title: vibekit eval harness
date: 2026-08-03
status: approved
---

# vibekit eval harness — Design

## Problem

vibekit's skills are behaviour-shaping prompts. Their value depends entirely on
whether they *fire at the right moment* — a skill that never triggers is dead
weight on disk, and nothing in the repo currently detects that.

This matters now because of a decision already taken: the pipeline (spec 3) will
be authored **compressed**, applying meta-prompting's structure-over-content
principle throughout, including to gate language. That is the aggressive choice.
Superpowers — the baseline this project follows — states the opposing position
explicitly in its contributor guide:

> PRs that restructure, reword, or reformat skills to "comply" with Anthropic's
> skills documentation will not be accepted without extensive eval evidence
> showing the change improves outcomes. The bar for modifying behavior-shaping
> content is very high.

Their skills average ~227 lines because rationalization tables and red-flag lists
are what stop a model talking itself out of a gate. Compressing that content may
be free, or may quietly break triggering. There is no way to know by reading.

A prior attempt in this project built a behavioural slot, measured 0/5, and was
abandoned — the failure was discovered only after the work was done. Building the
measurement *before* the compression is the direct response to that.

## Goals

- Detect whether a given skill fires at its trigger point, as a rate over
  repeated runs, deterministically and without a judge.
- Detect whether it fires *before* the actions it is supposed to precede.
- Measure vibekit's own input-token footprint — the number compression must move.
- Compare any two git refs (baseline vs candidate) so a compression change can be
  accepted or rejected on evidence.
- Optionally judge whether a skill was *followed*, not merely invoked.
- Zero dependencies, consistent with the rest of the repo.
- Never ship to users.

## Non-goals

- **Running on every PR.** Each run costs real money and needs authenticated
  credentials. This is a local and manual gate, optionally a `workflow_dispatch`
  job. The existing free CI (`check`, `test`, `check:hook`) is untouched.
- **Gating on token metrics.** Token deltas are reported, never enforced. A
  compression that halves input tokens while holding firing rate is a success,
  and a threshold would only get in its way.
- **Authoring the pipeline.** Which skills exist is spec 3. This harness is built
  and validated against the three existing stub skills.
- **Testing runtimes other than Claude Code.** `--plugin-dir` and
  `--output-format stream-json` are Claude Code affordances. Codex has no
  equivalent verified here.
- **A scenario DSL.** Scenarios are JSON data, not a language.

## Constraints

- Zero dependencies. Bare Node plus the `claude` binary already on the machine.
- Requires an authenticated `claude` CLI; the harness fails fast with a clear
  message if absent rather than producing misleading zeros.
- Sessions are stochastic. Every metric is a rate over `n` runs, never a single
  boolean.
- Cost is a real constraint: a trivial probe measured **$0.089** on haiku. A full
  A/B of 10 scenarios × 5 repeats × 2 variants is 100 sessions, plus 100 more
  with `--judge`.
- `evals/` must stay out of `package.json` `files[]`.

## Approach

### Verified foundations

Every mechanism below was proven with live probes before this spec was written,
not inferred from documentation:

- `claude -p "<prompt>" --output-format stream-json --verbose --plugin-dir . --model haiku`
  exits 0 and emits JSONL.
- `--plugin-dir .` loads the plugin **from the repo**, not from
  `~/.claude/plugins/cache`. The transcript contained `You have vibekit`,
  confirming the SessionStart hook fired from the working tree. This removes a
  known trap: an eval that measures the installed copy instead of the edits.
- The `init` event lists `tools` (`Skill` present) and `slash_commands` —
  including the generated `vibekit:example-command` and `vibekit:example-plain`,
  independently confirming spec 1's command emission reaches a live session.
- `assistant` events carry typed content blocks, so a `Skill` invocation is
  detectable without a judge.
- The `result` event carries `usage` (`input_tokens`,
  `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`) and
  `total_cost_usd`. Token measurement needs no instrumentation.

`--output-format stream-json` requires `--verbose`; omitting it is a hard error.

### Variants are git refs

`--plugin-dir` accepts any path, so an A/B is two checkouts of the same repo:

```
node evals/run.mjs --baseline main --candidate HEAD [--judge]
```

The runner materialises each ref as a throwaway worktree under
`.eval-worktrees/<ref>/` and points a session at it. **No second `skills/` tree
ever exists in the repo.** This is deliberate: v1's duplicate `plugins/vibekit/`
drifted to 12 of 16 skills unnoticed, and re-introducing a parallel tree inside
the harness meant to protect skill quality would repeat that mistake with better
intentions. Variants exist only for the duration of a run, and any two refs are
comparable.

`.eval-worktrees/` is gitignored, alongside `.vibe-worktrees/`.

### A scenario is a prompt plus an ordered expectation

```json
{
  "id": "brainstorm-precedes-code",
  "prompt": "Let's make a react todo list",
  "expect": { "skill": "brainstorm-lean", "before": ["Write", "Edit", "NotebookEdit"] },
  "n": 5,
  "model": "sonnet"
}
```

The naive assertion is "did the skill fire." The real property, taken from
superpowers' own acceptance test, is stronger: brainstorming must fire *before
any code is written*. A skill that fires after the agent has already written the
file has failed while still looking like a pass. The runner walks the JSONL in
order and asserts the `Skill` invocation precedes any tool in `before`.
Order-sensitivity is free because the stream is already sequential.

`before` is optional; a scenario without it asserts firing only.

**The scenario above is illustrative, not shipped.** `brainstorm-lean` does not
exist yet — it is spec 3's work. The initial `evals/scenarios.json` targets what
actually exists today: the bootstrap injection (a trivial prompt whose transcript
must contain the `using-vibekit` content the SessionStart hook injects) and the
generated slash command (`vibekit:example-command` present in the `init` event's
`slash_commands`). Both were confirmed by probe. Spec 3 adds a scenario per real
skill as it authors them.

### Sessions run in a disposable directory, not plan mode

The safe-looking choice is `--permission-mode plan`, and it is wrong here: plan
mode blocks edits, and "did the agent write code before brainstorming" is exactly
what is being measured. Plan mode would mask the failure it is meant to observe.

Each session instead runs with its **cwd set to a fresh temp directory** and edits
permitted. The repo is never the session's working directory.

A temp cwd alone is **not** containment, though: `bypassPermissions` grants the
session `Bash`, and no working directory bounds arbitrary command execution. The
spawn therefore also passes `--disallowedTools Bash`, which removes the execution
path while leaving `Write` and `Edit` attemptable — the ordering measurement only
needs the attempt to be observable, not to succeed.

Residual risk is stated rather than hidden: a `Write` to an absolute path can
still land outside the temp directory. Eliminating that requires an OS-level
sandbox (container, VM, or dedicated user), which conflicts with the
zero-dependency constraint, so it is accepted knowingly.

### Metrics

Deterministic, all derived from the stream:

| Metric | Source |
|---|---|
| Firing rate | `fired / n` per scenario per variant |
| Order compliance | `Skill` block index vs first index of any `before` tool |
| Input footprint | `result.usage.cache_creation_input_tokens` on a trivial-prompt scenario |
| Output tokens | `result.usage.output_tokens` |
| Cost | `result.total_cost_usd` |

The input footprint gets a dedicated scenario whose prompt does nothing but force
a session to start (`"Say only: ok"`). That measures vibekit's cost of merely
existing — 12,892 cache-creation tokens in the probe — and is the single number
spec 3's compression must move.

### Errored runs are never scored

Only runs where `result.subtype === "success"` count toward a rate. A
rate-limited or errored session produces no `Skill` invocation, which is
indistinguishable from a skill failing to fire unless checked — the probe emitted
a `rate_limit_event`, so this is observed behaviour, not a hypothetical. Without
this rule an API hiccup reads as a behavioural regression and sends someone
debugging skills that are fine.

Errored runs are reported in a separate `errors` block and re-run up to a small
retry budget. If a scenario cannot complete `n` successful runs, it is reported
as `incomplete` and fails the run — loudly, and distinctly from a low rate.

### The judge is opt-in

With `--judge`, each successful transcript is passed to a second `claude -p`
invocation together with `evals/judge.md`, returning:

```json
{ "followed": true, "score": 4, "why": "<one line>" }
```

This answers "did it *follow* the skill", which no tool_use check can see — a
session can invoke `brainstorm-lean` and then ignore its checklist entirely. Off
by default because it doubles session count and cost.

The judge is the same `claude` binary, so it adds no dependency.

### Comparison and thresholds

`evals/thresholds.json`:

```json
{
  "defaults": { "minFiringRate": 0.8, "maxRateRegression": 0.2 },
  "scenarios": { "brainstorm-precedes-code": { "minFiringRate": 1.0 } }
}
```

Two gates, both on rates:

- **Absolute floor** — candidate rate below `minFiringRate` fails.
- **Relative** — candidate rate more than `maxRateRegression` below the baseline
  rate fails. Skipped entirely when `--baseline` is omitted, since there is
  nothing to compare against; the absolute floor still applies.

Token metrics are reported as deltas and never gate.

Exit 0 when every scenario passes both gates; exit 1 otherwise, printing the
failing scenarios with both rates.

### Results are files, git is the trend store

Each run appends `evals/results/<iso>-<candidate-ref>.json` containing the run
plan, per-scenario rates for both variants, token deltas, errors, and judge
output when enabled. These are committed. History, diffing, and blame come from
git; there is no database, no storage layer, and no reporting UI.

### Cost control

- `--scenarios <id,id>` runs a subset.
- `-n <int>` overrides repeat count.
- Per-scenario `model`, so cheap scenarios can run on haiku.
- `--dry-run` prints the run plan and an estimated cost, spawning nothing.
- `--baseline` omitted runs the candidate alone (half the sessions), which is the
  common case while iterating.

### Failure modes

| Condition | Behaviour |
|---|---|
| `claude` not on PATH / not authenticated | Fail fast, name the problem, exit 1. Never emit zero rates. |
| `--output-format stream-json` without `--verbose` | Prevented — the runner always passes both. |
| Ref does not exist locally | Fail before spawning any session. |
| Worktree path already exists | Reuse if clean, fail if dirty. Never force. |
| Session times out | Counted as an error, not a non-firing run. |
| Judge returns unparseable JSON | Recorded as `judge_error`; deterministic metrics still stand. |

## Alternatives considered

**Variant directories inside the repo** (`evals/variants/{baseline,compressed}/skills/…`).
Dead simple to run and to hand-edit for a quick hypothesis. Rejected because it
is a second `skills/` tree — precisely the duplication spec 1 was built to
eliminate. The variants would drift from `skills/`, and the harness would end up
measuring something that no longer ships.

**Rubric-first, judge on every scenario.** Richest signal: it catches "invoked
the skill but ignored its checklist", which a firing check cannot see. Rejected
as the foundation because there is then no cheap mode — every run costs judge
calls, so it can never be a routine gate — and the harness's own correctness
starts depending on judge stability, where a drifting rubric produces regressions
that are not real. Retained as the opt-in `--judge` layer instead.

**A small deterministic-only runner with no judge and no A/B.** Proposed during
the pushback turn: roughly a hundred lines, since the probes showed the
mechanisms are all one-liners. The user chose the larger framing explicitly, on
the grounds that "compress everything, measure after" needs to detect quality
regressions and not merely triggering ones.

## Testing

The harness is test infrastructure, so it is tested at two levels:

- **Unit, offline, free.** Stream parsing is a pure function over JSONL: given a
  recorded transcript, extract firing, order, usage and result subtype. Fixture
  transcripts are committed (including a rate-limited one and an errored one), so
  the scoring rules — especially "errored runs are never scored" — are tested
  without spawning anything. Threshold comparison and the exit-code decision are
  likewise pure and unit-tested.
- **Live, manual, paid.** `--dry-run` is asserted to spawn nothing. One real
  end-to-end run against the current three stub skills validates the whole path;
  it is run by hand, not in CI.

Acceptance: running the harness against `HEAD` with the existing stubs produces a
results file with a firing rate for each scenario, a non-zero input footprint,
and exit code 0.

## Open questions

None. Deferred items are listed under Non-goals; the pipeline itself is spec 3.
