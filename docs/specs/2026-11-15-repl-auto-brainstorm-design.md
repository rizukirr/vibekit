---
title: repl auto brainstorm
date: 2026-11-15
status: approved
---

# repl auto brainstorm: Design

## Problem

`repl` runs `brainstorm` fully interactively, so a `repl` run still needs the user for every clarifying question, the pushback, the approach, each design section and the spec review, and then once more for run limits. The user wants `repl` to answer its own brainstorm questions by taking the recommendation, with no stop for the user, all the way to a plan, and then to show a plain summary of the plan before any code is written. That summary is the user's one review of every choice the agent made.

A second problem surfaced while running this spec: `repl` creates its run branch as `repl/<topic>`, and git refuses that name whenever a local branch called `repl` exists.

## Goals

1. `repl` invokes `decide` before `brainstorm`. Observable: in `skills/repl/SKILL.md`, the first numbered section invokes `decide`, and the line invoking `brainstorm` comes after it.
2. `repl` answers `brainstorm`'s questions itself and never waits for the user during brainstorm. Observable: `skills/repl/SKILL.md` says that wherever `brainstorm` would wait for the user, `repl` answers through `decide`, names the clarifying questions, the pushback, the approach, the design sections and the spec review, and gives the one-line format `Asked: ... Picked: ... because ...`.
3. `repl` approves the spec and writes the default run limits itself. Observable: `skills/repl/SKILL.md` contains `Run limits: at most 3 verify rounds, at most $0 on paid runs` and no instruction to ask the user for run limits before the summary.
4. `repl` prints the summary and waits. Observable: `skills/repl/SKILL.md` contains the summary template with the lines `Summary`, `These are the choices we made:`, `How we'll know it works:`, `Limits:` and `Reply "go" to start building, or tell me what to change.`, and the instruction to wait for the user's reply before `exec`.
5. A correction re-plans. Observable: `skills/repl/SKILL.md` says a correction becomes a settled answer, the spec is amended, `plan` rewrites the plan, and the summary prints again.
6. `decide` never pauses a brainstorm question. Observable: `## 4. Two-way doors` in `skills/decide/SKILL.md` contains a line saying every brainstorm question is a two-way door that takes the recommendation, and the product-direction bullet in `## 2. One-way doors` says it does not apply to brainstorm questions.
7. The run branch no longer collides with a branch named `repl`. Observable: `skills/repl/SKILL.md` contains `repl-run/<topic>` and does not contain `repl/<topic>`.
8. Evals: the new scenario `repl-stops-at-summary` (`n` 5) exists in `evals/scenarios.json` with the expectations under Testing, and `repl-runs-unattended` carries the go in its prompt. Observable: the scenarios are present with those keys, and each of `repl-stops-at-summary`, `repl-runs-unattended` and `repl-fires` meets its floor when run.
9. `npm run check` exits 0 and `npm test` exits 0.

## Non-goals

- No change to `brainstorm`, `plan`, `exec`, `verify` or `debug`.
- No change to a normal, non-`repl` run.
- No change to `repl` from `exec` onward: the pipeline table, rounds, amendments, the log format, the endings and the report stay as they are.
- No pause for sensitive topics such as money, personal data, security or legal questions during brainstorm. The summary is where the user catches them.
- No repl mode toggle. That is a separate spec.

## Constraints

- Every edited string obeys `plain`'s rules, which `npm test` checks.
- Generated files are regenerated with `npm run generate`, never hand-edited.
- No shipped file names an outside source, as `tests/no-external-references.test.mjs` requires, except the README's `## Credits` section.
- Run limits: at most 3 verify rounds, at most $0 on paid runs

## Approach

Pushback: the agent writes and approves the spec's goals alone, so a summary of decisions would never show the user what `verify` grades against. The user chose the larger framing: the summary closes with `How we'll know it works:`, the spec's goals in one plain sentence.

Decisions from the clarifying questions: after the summary, `repl` waits for the user's go or a correction. Each auto-picked decision prints as one line as it happens and gets a log row. Brainstorm never stops for the user, sensitive topics included, because the summary already shows every choice before code is written (amended 2026-11-17 at the user's request).

### The flow

1. `repl` invokes `decide` and starts the decision log at `.vibe-worktrees/<topic>.decisions.tsv`, the topic taken from the intent.
2. `repl` invokes `brainstorm`, which runs unchanged. Wherever it would wait for the user (each clarifying question, the pushback, the choice of approach, each design section, the spec review), `repl` answers through `decide`. Settled by the request or the repo: follow it. Otherwise take the recommendation, which `brainstorm` gives for the pushback and the approaches and which `repl` forms for a clarifying question. Each answer prints as `Asked: <question>. Picked: <answer>, because <reason>.` and gets a log row.
3. `repl` approves the spec (`status: approved`) and writes `Run limits: at most 3 verify rounds, at most $0 on paid runs` under Constraints.
4. Setup is as today, except the branch is `repl-run/<topic>`: worktree, branch, spec commit. `plan` writes the plan, and its self-review stands in for the user's review.
5. `repl` prints the summary and waits. A go accepts the plan and the limits, and everything from `exec` on runs unattended as today. A correction is a settled answer: the spec is amended, `plan` rewrites the plan, and the summary prints again. New run limits in the reply are written into the spec first.

### The summary

```
Summary
Build <the feature, in one plain sentence>. These are the choices we made:

1. <a decision from brainstorm, in plain words>
2. <the next one>

How we'll know it works: <the spec's goals, in one plain sentence>
Limits: up to N review rounds, $M on paid checks.

Reply "go" to start building, or tell me what to change.
```

It lists only decisions that change what gets built: the approach, the pushback outcome, and answers that shaped the design. It uses plain words a 12-year-old would follow, with no file paths, function names or jargon unless the user used them.

### decide

A new line in `## 4. Two-way doors`: in a brainstorm, every question is a two-way door. Take the recommendation `brainstorm` gives, or the one formed for it. The summary before `exec` is the user's review of these answers.

The bullet in `## 2. One-way doors` about choosing behaviour that would pick a product direction gains a clause saying it does not apply to brainstorm questions. Without it, nearly every brainstorm question would pause, since design is choosing a product direction.

## Alternatives considered

- Pause on sensitive topics (money, customer or personal data, security or auth, legal or compliance), with the list held in `decide`. This was the approved design until 2026-11-17. Rejected by the user: the summary before any code already gives them the review, and a mid-brainstorm stop defeats the unattended run.
- Continue straight into building after the summary, or wait only when a decision was close. Rejected by the user for one checkpoint before any code.
- Print nothing until the summary, or print each full question. Rejected for one line per decision.

## Testing

`npm test` covers `plain`'s rules on the edited skills, and `npm run check` covers generated drift. Each plan task's verify clause greps for its key text.

| id | Setup | Expect | n |
|---|---|---|---|
| `repl-stops-at-summary` (new) | repo scenario, "Use the vibekit:repl skill to add a formatBytes helper to src/format.js that turns a byte count into a human-readable string." | `skill: vibekit:plan`, `after: [vibekit:repl, vibekit:brainstorm]`, `skillAbsent: vibekit:exec`, final text matching `How we'll know it works` | 5 |
| `repl-runs-unattended` (updated) | its prompt adds: "Treat this message as my go when you print the plan summary." | unchanged | 5 |
| `repl-fires` (unchanged, rerun) | | unchanged | 10 |

The floors are the defaults, except `repl-runs-unattended`, which keeps 0.6. `repl-stops-at-summary` uses the default 0.8. Evals cost money, so the runs in Goal 8 are a manual gate, and `verify` reports any that did not run as unobserved.

Not observed by any eval: a correction reply that triggers a re-plan. It needs more than one turn.

## Open questions

N/A: every question raised during design was answered.
