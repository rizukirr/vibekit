---
title: verify severity and the bounded fix loop
date: 2026-08-07
status: approved
---

# verify severity and the bounded fix loop — Design

## Problem

`verify` shipped without a severity model. It assigns goals `satisfied`,
`not satisfied` or `partial`, and for the `lazy` read it says only *"Report each
violation as `file:line` and the rung it breaks."* Nothing states whether a
violation gates.

As written, every finding reads as a blocker. A naming nit would set
`not ready`, halt the pipeline, and route a whole new `exec` task — expensive,
and wrong. The defect survived the skill running on itself only because that
run's `lazy` read happened to find nothing.

There is a second gap of the same origin. `verify` has two exits and neither has
a destination. On `ready` it hands to `review`; on `not ready` its most likely
blocker — a failing test — hands to `debug`. Both are unbuilt.

The pushback on building `review` held: with `verify` already owning spec
coverage, plan fidelity, the surgical diff and the simplicity read, `review`
reduced to three actions — show the diff, name the risks, wait. That is a
section, not a skill.

## Goals

- **Only evidence-backed findings gate.** Observable: `skills/verify/SKILL.md`
  defines `blocker`, `warn` and `nit`, states that only a blocker produces
  `not ready`, and scenario `verify-nit-does-not-gate` at n=10 shows a session
  whose sole finding is cosmetic does not return `not ready`.

- **Findings that cannot change behaviour are fixed without asking.**
  Observable: the skill dispatches one fresh subagent carrying every
  auto-fixable finding, and scenario `verify-dispatches-the-fix` at n=10 shows
  a dispatch occurred.

- **The loop terminates by construction, not by budget.** Observable: the skill
  states both stopping conditions — a round producing no new findings, or one
  round completed, whichever comes first — and states that anything still open
  is carried to the ending rather than retried.

- **`verify` never edits what it gates.** Observable: the skill dispatches the
  fix and re-runs its own checks against the result; no step instructs it to
  edit a file.

- **Both exits end with the user.** Observable: on `ready` the skill presents a
  diff summary, remaining warns and nits, three ways the change could be wrong
  that the tests would not catch, and waits for approve / fix / abort; on
  `not ready` it presents blockers with evidence and waits for a routing choice
  of `plan`, `exec`, or an explicit override.

- **The pipeline has no dead ends.** Observable: no shipped file names `review`
  as a next skill; `verify`'s handoff names `finish`.

- **The skill stays under its budget.** Observable: `wc -l
  skills/verify/SKILL.md` is at most 200. Read as a content budget: reflowing to
  pass it is a violation, not a fix.

  **Amended mid-execution, 2026-08-07.** This goal originally said 180. The
  approved content measured 187 — observed on a scratch copy, not estimated —
  and the implementer halted rather than cut it. The ceiling was raised to 200
  because the content is what was approved, unwrapped and uncut; the alternative
  was deleting an approved section to satisfy a number invented before the text
  existed.

  The original wording claimed the ceiling was *"chosen rather than predicted —
  this project has estimated a line delta twice and been wrong twice."* It was
  then wrong a third time, in the spec that said so. **A ceiling chosen before
  the content exists is a prediction wearing a different word.** The durable fix
  is to derive the number after drafting, or to state the budget as a property.
  Three failures from one habit.

## Non-goals

- **A `review` skill.** Dropped from the frame. The pipeline becomes
  `brainstorm → plan → exec → verify → finish`.

- **Running the loop to convergence.** Considered and rejected. A `lazy` finding
  has no exit status, so a loop whose exit condition is *a judgement returned
  nothing* has no guaranteed fixed point: a fresh reader can always find one more
  thing to shorten, and each round costs a dispatch plus a full re-verify. The
  bound is what makes termination a property rather than a hope.

- **Auto-fixing anything that can change behaviour.** Severity decides gating;
  fixability decides who fixes. A finding is auto-fixable only if fixing it
  cannot change behaviour. A nit whose fix would alter behaviour still reaches
  the user, and a blocker that is a pure rename is fixed without asking.

- **Amending the plan mid-run.** Routing fixes through `exec` would require an
  approved plan task carrying a `→ verify:` clause, so `verify` would have to
  patch the plan mid-execution — which `exec` forbids at
  `skills/exec/SKILL.md:97-100` because the plan and the work then drift apart
  and the drift is found later, by a reviewer.

- **Demoting unmeasured goals.** An unmeasured goal stays a blocker. Both real
  verdicts so far were `not ready` on exactly this, which means a cycle that
  ships without paying for evals cannot reach sign-off except by an explicit
  override. That is the intent: the gap stays named rather than quietly becoming
  a warn the reader scrolls past.

- **`debug`.** Still unbuilt. `not ready` on a failing test names the route and
  waits; it does not repair.

- **Proving the bound.** No scenario can show the loop stops after one round —
  that needs a session able to run commands. Ships stated and unproven.

## Constraints

- **Dependency free.** No shipped file under `skills/` names a project vibekit
  borrows from; `tests/no-external-references.test.mjs` enforces it.
- **One directory, one file.** `skills/verify/SKILL.md`. `CLAUDE.md`,
  `README.md` and `AGENTS.md` are regenerated by `npm run generate` and
  committed together, never hand-edited.
- **No `Co-Authored-By` trailers. Branch names carry no prefix. Artefacts stay
  committed under `docs/`.**
- **Measurement integrity.** `git ls-files -s skills evals | sha256sum` pinned
  before and after every paid run.
- **Rates are quoted at n=10 or not at all.**
- **Suspect the probe before the skill.** Every cycle so far has produced more
  defects in the plan and the measuring apparatus than in any implementation.

## Approach

One file changes: `skills/verify/SKILL.md`, from 132 lines against a new ceiling
of 180. Four edits.

### Edit 1 — severity

Findings gain three levels, orthogonal to the goal verdicts, which are about
evidence rather than consequence:

- **`blocker`** — a failed sweep check, a goal observed to fail, an unmeasured
  goal, a violated non-goal. Only a blocker produces `not ready`.
- **`warn`** — a `lazy` finding whose fix would change behaviour, or a `partial`
  goal.
- **`nit`** — a `lazy` finding whose fix cannot change behaviour.

Fixability is the second axis and it is not severity: **a finding is auto-fixable
only if fixing it cannot change behaviour.**

### Edit 2 — the bounded loop

After the four stages, collect every auto-fixable finding and dispatch **one**
fresh subagent carrying all of them as a single brief. Never one dispatch per
finding: two implementers on one diff conflict, the same reason `exec` never
dispatches two at once.

The fix agent is confined to files already in the diff. A fix touching anything
outside it is a blocker, not a fix. Without this, every auto-fix would trip the
sweep's scope check on the next round, because the fix belongs to no plan task's
`Files` block.

Then the sweep and the `lazy` read run again from the top. **The re-run is the
gate on the fix**, so a fix that breaks a test needs no special handling — it
returns as a failed check, which is a blocker, and the loop ends `not ready`.

Stop on the first of: a round produced no new findings, or one round completed.
Anything still open is carried to the ending as information, never retried.

This makes `verify` a dispatching skill, which its own previous spec ruled out.
That is the cost, stated plainly. What it preserves is the property that
matters: `verify` still never edits what it gates, so its verdict is never
self-graded.

### Edit 3 — one ending, two shapes

`verify` always finishes by presenting and waiting.

On `ready`: a `git diff --stat` summary, the remaining warns and nits, three ways
this could be wrong that the tests would not catch, then approve / fix / abort.

On `not ready`: the blockers with their evidence, then a routing choice — `plan`,
`exec` as a new task, or an explicit override that goes on the record.

Approval is always available on `ready`. Only the user blocks. The risk critique
is judgement with nothing behind it, and letting an unevidenced guess veto the
person whose code it is inverts who decides.

### Edit 4 — handoff

`review` is removed from the hard-gate sentence and from the handoff. The next
skill on `ready` is `finish`.

### Pushback and response

The pushback proposed that `review` need not exist at all, since with `verify`
owning every evidenced check it reduces to three actions. The user took the
smaller version. The design then grew in a different direction on the user's
question — whether warns and nits should re-dispatch automatically — and the
user chose the bounded form over the unbounded one after the termination
argument.

## Alternatives considered

**A tiny `review` skill, roughly forty lines.** Preserves the twelve-skill frame
and leaves `verify` untouched. Rejected: most of those lines would be
frontmatter, gate, preconditions and handoff wrapped around three actions, and it
adds a trigger that must fire reliably — the failure this project has measured
more than any other.

**Folding sign-off into `finish` instead.** Sign-off is a decision about an
outward-facing action, so it could live with the skill that performs one. Keeps
`verify` mechanical and keeps its budget. Rejected because `finish` does not
exist, so `verify`'s ready path would stay a dead end until it does, and the risk
critique would be separated from the evidence assessment that motivates it.

**An unbounded fix loop.** Rejected under Non-goals.

**Severity attached to goals rather than findings.** Rejected: a goal verdict is
a statement about evidence, and overloading it with consequence is what produced
this defect in the first place.

## Testing

**Free CI.** `npm run generate` / `npm run check` cover registration;
`tests/no-external-references.test.mjs` covers the prose.

**Paid, two new scenarios at n=10.**

- `verify-nit-does-not-gate` — a fixture whose only finding is cosmetic must not
  return `not ready`. Asserted with `finalTextOmits`, the expectation added in
  the previous cycle. This is the shipped defect turned into an assertion.
- `verify-dispatches-the-fix` — a fixture carrying an auto-fixable finding must
  produce a dispatch. Asserted with `dispatchPromptMatches`, which exists and is
  unit-tested but has never been used by a scenario. It is the only new
  assertion that distinguishes the loop existing from the prose describing it.

**The three existing `verify` scenarios must not regress** — and they have never
run, so that is a comparison against nothing. Five `verify` scenarios will then
exist, none measured.

**What stays unmeasured.** The bound, the confinement of the fix agent, the
re-run, the sign-off wait. All need a session that can run commands. The
per-scenario `allowBash` capability would close them and remains unbuilt with no
spec. This change adds unmeasurable surface to a skill that already had two
thirds of it, so the debt grows within `verify` rather than spreading.

**Stated weakness.** This change makes `verify` bigger and gives it a dispatch
loop, on the strength of a defect found by reading rather than by measurement,
in a skill whose own behaviour has never been measured once. The honest framing
is that the severity fix is well-evidenced — the hole is plainly visible in the
shipped text — while the loop is a design bet. If the next cycle's `lazy` read
produces nothing auto-fixable, the loop will have cost more to build than it
saved.

## Open questions

None. Deferred items are listed under Non-goals.
