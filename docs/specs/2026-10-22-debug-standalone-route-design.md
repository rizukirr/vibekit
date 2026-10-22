---
title: debug standalone route
date: 2026-10-22
status: draft
---

# debug standalone route: Design

## Problem

`debug` routes a local fix to `exec` as a new task, and a structural one to `plan`. Both assume a pipeline run is in flight. Outside one, `exec` refuses without a committed plan and a spec carrying `status: approved`, and `plan` refuses without an approved spec. A failure the user reports directly, which is the third source in `debug`'s trigger, therefore has no route to a fix short of starting over at `brainstorm` and re-deriving what `debug` already established.

## Goals

1. `skills/debug/SKILL.md` routes a standalone local diagnosis to a fix spec and then `plan`, and a standalone structural diagnosis to `brainstorm`. Observable: the Route section names both standalone destinations, and a reported failure is named as what makes a diagnosis standalone.
2. The skill carries the fix spec template in full. Observable: `skills/debug/SKILL.md` contains each of the eight headings `## Problem`, `## Goals`, `## Non-goals`, `## Constraints`, `## Approach`, `## Alternatives considered`, `## Testing`, `## Open questions` and a `status: approved` frontmatter line, plus the three fixed goals listed under Approach below.
3. Inside-run routing is unchanged. Observable: the Route section still routes a local diagnosis inside a run to `exec` as a new task, and a structural one to `plan`.
4. `debug` still edits no code. Observable: the `Repair nothing yourself` section is unchanged by the diff, and the existing `debug-edits-nothing` scenario in `evals/scenarios.json` is unchanged.
5. A new scenario `debug-standalone-writes-spec` exists in `evals/scenarios.json` with `n` of 10, expecting `vibekit:debug`, `vibekit:plan` after it, and a produced file matching `^docs/specs/.*fix.*-design\.md$`. Observable: the scenario is present with those keys, and `npm run eval -- --scenarios debug-standalone-writes-spec` meets the default `minFiringRate` of 0.8 when run.
6. `npm run check` exits 0 and `npm test` exits 0.

## Non-goals

- No new skill, and no change to `plan`, `exec`, `verify` or `quick`.
- No change to the unreproducible and refuted-twice outcomes, which still route to the user.
- `debug` does not create a branch or worktree. `exec` keeps refusing to run on the base branch.

## Constraints

- Every edited string obeys `plain`'s rules, which `npm test` checks.
- Generated files are regenerated with `npm run generate`, never hand-edited.

## Approach

Pushback response: the user asked for a recommendation, accepted the smaller framing (make a debug report an approved input to the existing chain, no new skill), and picked approach A below.

`debug` tells inside a run from standalone by its entry point. A verdict from `verify` or a failed `exec` clause is inside a run, and routing is as today. A reported failure is standalone.

| Route | Inside a run | Standalone |
|---|---|---|
| Local | `exec` as a new task | user approves the report, `debug` writes and commits the fix spec, routes to `plan` |
| Structural | `plan` | `brainstorm`, with the report as its problem statement |
| unreproducible, refuted twice | user | user |

The approval is the user accepting the report `debug` already prints. The fix spec is written to `docs/specs/YYYY-MM-DD-fix-<topic>-design.md` and committed on the current branch, with every field copied verbatim from the report:

| Spec heading | Content |
|---|---|
| frontmatter | `title: fix <topic>`, the date, `status: approved` |
| Problem | the report's `Failure`, `Repro` and `Isolated` lines |
| Goals | the three fixed goals below |
| Non-goals | No behaviour change other than the one the cause names. |
| Constraints | No interface change. |
| Approach | the `Cause` and `Refuted` lines |
| Alternatives considered | `N/A: a diagnosis, not a design. The refuter's result is under Approach.` |
| Testing | the `Guard` line |
| Open questions | `N/A: the report was approved as written.` |

The three fixed goals:

1. The guard test named in the report fails at BASE and passes at HEAD.
2. The failing command from `Failure` exits 0 at HEAD.
3. The full test suite passes at HEAD.

Edits, all in `skills/debug/SKILL.md`: the Route section gains the standalone column, the report section gains the one exception to "write nothing, commit nothing" with the template above, and the Handoff section names `brainstorm`. `Repair nothing yourself` is untouched: the spec is not a fix, and the guard test is still never written here.

## Alternatives considered

- **`plan` accepts a debug report in place of a spec.** Keeps `debug` write-nothing, but `plan`, `exec`'s whole-plan gate and `verify`'s preconditions would each need a second accepted source. Three gates with an "or" branch drift apart. Rejected for diff size.
- **A new `fix` skill** running plan, exec and verify for one task. Duplicates the rules of three hard gates. Rejected by `lazy`'s ladder.
- **Write the fix in session, gated by the guard test only.** Rejected by the user in favour of keeping author separation.

## Testing

`npm run check` and `npm test` for generated-file drift and `plain`'s rules. The new eval scenario `debug-standalone-writes-spec` reuses the `parse.mjs` fixture of the existing `debug-*` scenarios with the approval written into the prompt. Evals cost money and need an authenticated `claude` CLI, so the run in Goal 5 is a manual gate, and `verify` reports it unobserved if it was not run.

## Open questions

N/A: every question raised during design was answered.
