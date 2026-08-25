---
title: exec skill
date: 2026-08-05
status: approved
---

# exec skill — Design

## Problem

`plan` is terminal on `exec`, and `exec` does not exist. Its handoff currently
reads, verbatim: *"The only next skill is `exec`, which does not exist yet."*

Worse than a missing link, `plan` shipped a mandate with no enforcer. Its central
rule is that every task carries a `→ verify:` clause stating a checkable
predicate, and the spec named `exec` as the skill that rejects a task lacking
one. Nothing rejects anything today. That debt is one cycle old.

Four references in `external/` were studied. Only one — superpowers'
`subagent-driven-development` — actually dispatches subagents; it spends 503
lines plus 433 lines of prompt templates and 127 lines of shell. spec-kit's
`implement` runs everything inline in one context with no per-task gate, and
consequently needs an entire separate `converge` pass to find what the run
missed. caveman's `cavecrew` never plans at all but solves two problems the
others leave open. karpathy-guidelines turns out to be the origin of the
`→ verify:` idea, already absorbed into `plan` last cycle.

The evidence that matters most is local. This repository executed a seven-task
plan through nine dispatches on 2026-08-05, and the outcome was lopsided:

- **Zero implementer failures.** Every dispatched subagent completed its task or
  halted legitimately.
- **Three halts, all correct, all plan defects** — a wrong count, a regex
  contradicting its own test fixtures, an unreachable line budget.
- **Seven defects total, every one in the plan, none in an implementation.**

So the risk `exec` must manage is not implementers going wrong. It is plan
defects reaching dispatch, and being detected and routed back out cheaply.

One more local fact shapes the design. The three halts were caught *because* the
implementer was a fresh context that read the plan literally and had no idea
what the author intended. The author — this session — read past all three
contradictions while writing them.

## Goals

- **`exec` fires when a plan is approved and implementation has not started.**
  Observable: an eval scenario seeds an approved plan, prompts for execution,
  and asserts a `vibekit:exec` invocation appears in the transcript. n=10.

- **A plan with any task lacking a `→ verify:` clause is rejected whole, before
  any dispatch.** Observable: a scenario seeds a plan whose third task has no
  clause, and asserts the session names the offending task as the reason it
  stopped. Asserting merely that no dispatch happened would be vacuous — eval
  sessions run without `Bash`, so a dispatch may be impossible regardless, and a
  check that cannot fail is not a check. This is the enforcement `plan` was
  promised.

- **Work is handed over as file paths, not pasted text.** Observable: the
  dispatch prompt in the transcript contains a brief path and does not contain
  the task's code blocks. Measured as a transcript assertion.

- **A task's `→ verify:` clause is executed, and its exit status decides.**
  Observable: stated in the skill as the gate; asserted in eval only to the
  extent a Bash-less session allows (see Testing).

- **`exec` repairs nothing.** Observable: on any non-`done` return, the session
  halts and writes no fix. Asserted as absence of edits to source files after a
  seeded failing return.

- **Every dispatch instructs the implementer to invoke `lazy` before writing
  code.** Observable: the dispatch prompt matches `lazy`, asserted by
  `dispatchPromptMatches`. Stated as a goal because a dispatched agent does not
  inherit this session's modifiers — the bootstrap explicitly tells subagents to
  skip the orchestration discipline — so what the parent knows about how much to
  build reaches the implementer only if the brief carries it.
  <!-- Added 2026-08-06 at the user's request, after verification. Until now the
  design compensated for this by making plans prescriptive enough that the
  implementer transcribes code rather than deciding how much to write:
  seventeen dispatches across two cycles, none requiring a design choice. That
  compensation is a real coupling between `plan`'s thoroughness and `exec`'s
  safety, and it was written down nowhere. A plan that says "add validation
  here" instead of shipping the code hands the decision to an agent that has
  never read the ladder. The brief references the `lazy` skill rather than
  restating its content, so the ladder stays one fact in one place. -->

- **The skill is smaller than every reference that does the same job.**
  Observable: `SKILL.md` under 160 lines, against 503 for the nearest reference
  implementation and 764 for vibekit v1's three-skill dispatch cluster. Read as
  a content budget: reflowing to pass it is a violation, not a fix.

## Non-goals

- **A fix loop.** The nearest reference runs five rounds with a model-tier
  escalation ramp and an adjudication breaker. It exists because its plans have
  no machine-checkable criterion, so a failed task can only be re-judged. Nine
  dispatches here produced zero implementer failures. Build it when something
  fails; a retry mechanism for an unobserved failure mode is speculative
  machinery.

- **A per-task reviewer subagent.** The task's `→ verify:` clause is the review,
  and it is a command with an exit status rather than an opinion. This is the
  single largest deletion the design makes, and it is earned: the previous cycle
  paid for machine-checkable criteria and enforces them in free CI.

- **Parallel execution.** The nearest reference kills it in one line — *"Never
  dispatch multiple implementation subagents in parallel (conflicts)"* — and
  vibekit v1's roughly ninety lines of parallel-group machinery went entirely
  unexercised in this repository's only real run.

- **Creating the isolated workspace.** `exec` requires a dedicated branch or
  worktree to exist and refuses to run on the base branch. Making one is a
  different job.

- **Solving the follow-through problem.** Unaddressed here, as in the previous
  two cycles.

- **Running a plan end to end inside an eval session.** Sessions run with `Bash`
  disallowed. Scenarios measure the gate and the dispatch decision, not a
  completed run.

## Constraints

- **Dependency free.** No shipped file names a project vibekit borrows from.
  Enforced by `tests/no-external-references.test.mjs`, whose borrowed-from list
  is hand-maintained — `docs/` is outside the guard, which is why references are
  named in this spec and never in `skills/`.
- **One directory, one file.** `skills/exec/SKILL.md`. Every other surface is
  regenerated by `npm run generate` and enforced by `npm run check`. The
  regenerated set is `CLAUDE.md`, `README.md` **and `AGENTS.md`** — the third was
  omitted from the previous cycle's plan and left a clean checkout failing
  `npm run check`.
- **No `Co-Authored-By` trailers on any commit.**
- **Branch names carry no prefix.**
- **Artefacts stay committed under `docs/`.**
- **Eval harness capabilities are added before any measurement, as plan tasks.**
  The harness may be fixed when it is demonstrably losing or corrupting data,
  never adjusted to change a result.
- **Measurement integrity.** `git ls-files -s skills evals | sha256sum` pinned
  before and after every paid run.
- **n=5 is a smoke test, not a measurement.** The previous cycle observed the
  same scenario score 0.80 then 0.40 with only a rate-neutral change between.
  Rates are quoted at n=10 or not at all.
- **Suspect the probe before the skill.** The previous cycle produced seven
  defects in the measuring apparatus and zero in the skill. On a failing eval,
  read the recorded failure and the produced artefact before editing behaviour.

## Approach

**Approach A — lean dispatch loop.** `skills/exec/SKILL.md`, hard gate, under
160 lines.

### Whole-plan gate, before anything is dispatched

Refuse unless: the plan file exists, is committed, and the user approved it; the
spec it names carries `status: approved`; the working tree is clean; the run is
on a dedicated branch or worktree, not the base branch; and **every task header
carries a `→ verify:` clause**.

A plan missing even one clause is rejected whole. Rejecting up front is the point
— the alternative is discovering task six has no clause after paying for five
dispatches.

### The per-task loop

1. **Record BASE** — `git rev-parse HEAD` before dispatch. Never `HEAD~1`, which
   silently drops all but the last commit of a multi-commit task.
2. **Write the brief to a file** — the task's own section extracted verbatim
   (heading, `Files`, every step, the clause), passed as a path. Exact values
   live only in the brief. The plan file is never handed over whole.
3. **Dispatch one fresh subagent** — prompt carries one line of placement, the
   brief path introduced as requirements to use verbatim, repo state it cannot
   infer, interfaces earlier tasks produced, and the return contract. The model
   is named explicitly. Tools are allowlisted to what the task needs.
4. **Run the task's `→ verify:` clause** — `exec` runs it. Exit status decides.
   This is the per-task gate and the reason no reviewer subagent exists.
5. **Check scope** — `git diff --name-only BASE..HEAD` must be a subset of the
   task's `Files` list. Every changed line traces to the task that authorised it.

Then tick the task's checkboxes and commit that plan update separately, so the
plan always states what actually happened.

### Return contract

Three statuses, branchable on the first field.

- **`done`** — commits made (`sha — subject`), the command run and its exit
  status, and a `concerns` string, empty if none. Concerns are recorded, not
  acted on; they do not earn a status of their own.
- **`blocked`** — cannot be completed as written; what was tried, and why it
  stopped. Not a retry request.
- **`needs-input`** — a genuine ambiguity in the plan: the blocking step quoted
  verbatim, what was attempted from the brief alone, and two or more options.
  Rolled back to BASE before returning, so a halt never leaves partial work.

On this repository's only sample, `needs-input` is the most common non-`done`
outcome — three of three halts. It is not an edge case.

### Routing — `exec` repairs nothing

- `needs-input` → halt, surface the question verbatim, wait. On an answer, the
  plan is amended **by `plan`, in its own commit**, then the task is
  re-dispatched fresh. Not patched inline mid-loop.
- `blocked` → halt, surface, stop the run.
- Verify clause fails → halt. The task's own criterion said no.
- Scope violation → halt, name the offending paths.

A halt leaves the branch as it was at the last completed task.

This rule is the one the 2026-08-05 session broke most often: the controller
fixed plan defects inline between tasks, and each time the plan and the artefact
drifted until a review gate caught it.

### Model selection, conditional on measurement

The model is named explicitly on every dispatch, because an omitted model
silently inherits the session's — usually the most expensive available. Choice
is by task shape: mechanical edits carrying full code in the brief get the cheap
tier; tasks whose steps require judgement get the standard tier.

**This ships only if it beats a control arm, by a margin stated before the run.**
A previous attempt at model-tier guidance was built across nine commits and five
skills on 2026-07-31, measured 0/5 in *both* arms, and was abandoned. The
structural difference now is that the model is a real dispatch argument rather
than a line of prose the agent must remember to emit — so it is observable in
the transcript rather than self-reported.

The threshold: at n=10 per arm, the treatment must reach **at least 0.70** and
exceed control by **at least 0.30**. Anything less is within the noise this
repository has already measured — the same scenario moved 0.80 to 0.40 across
two runs with a rate-neutral change between them. If the threshold is not met,
model selection is removed from the skill rather than kept and explained. That
outcome is declared acceptable in advance.

### Pushback and response

The pushback challenged whether `exec` needs any apparatus at all beyond a
dispatch loop, a return contract and a rejection path — since this repository's
nine dispatches produced zero implementer failures, and every reference's larger
machinery exists to compensate for plans without checkable criteria. The user
accepted the smaller framing and separately asked for model selection to be kept,
which is why it appears above with a control-arm condition attached rather than
as an unconditional feature.

## Alternatives considered

**Approach B — inline execution, no subagents (~50 lines).** Execute tasks in the
current session: follow the steps, run the clause, commit, move on. No brief
files, no dispatch, no return contract. This is what spec-kit's `implement`
does, and it is the laziest rung that still nominally meets the requirement.

Rejected on this repository's own evidence. All three plan defects caught during
the previous cycle were caught *because* the implementer was a fresh context
reading the plan literally with no knowledge of what the author intended. The
author read past every one of those contradictions while writing them. Inline
execution would have shipped all three. Context isolation is not overhead here —
it is the detection mechanism.

**Approach C — A plus a fix loop and per-task reviewer subagent (~250 lines).**
The nearest reference's shape: bounded retry rounds, a model-tier escalation
ramp, a reviewer returning two verdicts, an adjudication breaker at the cap.
Rejected: it roughly doubles the skill to cover a failure mode with zero measured
incidence here, and its reviewer duplicates a check the verify clause already
performs mechanically.

**Keeping briefing and report-filtering as separate skills**, as vibekit v1 does
across `brief-compiler` (187 lines) and `report-filter` (212 lines). Rejected:
764 lines must be loaded and three contracts kept in agreement to run one task,
and the previous session showed the cost — a constraint lived in one skill while
its enforcement lived in another, and a `--no-verify` slipped between them. The
nearest reference keeps briefing as template files beside the skill, not as a
separate skill.

## Testing

**Free CI.** `npm run generate` / `npm run check` cover registration;
`tests/no-external-references.test.mjs` covers the prose;
`tests/plan-clauses.test.mjs` continues to enforce the predicate rule on this
repository's own plans.

**Harness capability required before measurement.** `evals/parse.mjs` records
tool calls by name only. Capturing dispatch arguments — at minimum the `model`
field — is a precondition for measuring model selection at all, and is built as
a plan task before any paid run.

**Scenarios**, n=10, candidate-only.

- `exec-fires` — seed an approved plan and a prompt to execute it; assert
  `vibekit:exec` appears.
- `exec-rejects-clauseless-plan` — seed a plan whose third task has no
  `→ verify:` clause; assert the transcript names that task as the reason the
  run stopped. A no-dispatch assertion is deliberately **not** used: `Bash` is
  disallowed in eval sessions, so no-dispatch would hold whether or not the gate
  works. The scenario must be able to fail.
- `exec-names-a-model` — treatment arm asserting a dispatch carries an explicit
  model, run against a control arm with the guidance removed. Per the
  2026-07-31 lesson, the control runs first and the treatment must beat it.

**Stated limitation.** Eval sessions run with `Bash` disallowed, so no scenario
executes a real dispatch, a real commit, or a real verify clause. These
scenarios measure the gate and the dispatch decision. Whether the loop works end
to end is established by using it — as the previous cycle established `plan` by
executing a seven-task plan through it.

## Open questions

None. Deferred items are listed under Non-goals.
