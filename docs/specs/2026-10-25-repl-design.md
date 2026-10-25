---
title: repl
date: 2026-10-25
status: approved
---

# repl: Design

## Problem

Every vibekit run after `brainstorm` still stops for the user: the plan review, an `exec` task that returns `needs-input`, `verify`'s routing choice on a not-ready result, the approval of a `debug` report, the integration choice. An inventory of the skills found about 80 decision points, many of them handed to the user and many decided by the agent with no stated rule. There is no way to approve a design and let the rest of the pipeline run unattended, and nothing tells an agent which choices it may make alone.

Research behind the design: obra/superpowers (an orchestrator that rules on ambiguities and logs each ruling), Claude Code auto mode and OpenAI's agent guide (escalate on irreversible, external or high-stakes actions and on repeated failure), Bezos's one-way and two-way doors, METR and ImpossibleBench (agents game tests under pressure, and an explicit human exit cuts that sharply), Nygard's ADRs (a decision changes only by a superseding record), and Lauren Tan's pstack (never block on reversible work, never relax the predicate, an append-only decision log checked against the transcript, discard what did not help, pause safely).

## Goals

1. A new skill `skills/repl/SKILL.md` exists with frontmatter `name: repl`, `gate: none`, `command: true` and the trigger `Invoked explicitly as a slash command, never fires on its own`. Observable: the file has those values, and after `npm run generate` a `repl` row exists in the `CLAUDE.md` trigger table, `commands/repl.toml` exists, and `commands/repl.md` does not.
2. `repl`'s text carries the run as designed. Observable: `skills/repl/SKILL.md` contains each of: `brainstorm`, `Run limits`, `3 verify rounds`, `$0`, `repl/<topic>`, `.vibe-worktrees/<topic>.decisions.tsv`, `.git/info/exclude`, `git revert`, `spec: amend`, and the three ending names `done`, `paused` and `capped`, and it contains no instruction to push, open a pull request or merge.
3. A new skill `skills/decide/SKILL.md` exists with frontmatter `name: decide`, `gate: none`, `command: false` and the trigger `Loaded by repl at the start of its run, never fires on its own`. Observable: the file has those values and contains the headings or bold labels for its five steps (settled, one-way door, experiment, two-way door, limits), the word `experiment`, and each one-way door category listed under Approach.
4. `retro` fires on its own at the end of a run with a flagged class. Observable: the `retro` row in the `CLAUDE.md` trigger table reads `A run ended, and a debug report in it carried a Class: other than none`, and `## The ending` in `skills/verify/SKILL.md` instructs invoking `retro` under that condition rather than only mentioning `/vibekit:retro`.
5. `README.md` has a `## Credits` section, directly before `## License`, saying vibekit was built from scratch and naming as its inspiration Matt Pocock's skills (`https://github.com/mattpocock/skills`), Lauren Tan's pstack (`https://github.com/cursor/plugins/tree/main/pstack`), obra's superpowers (`https://github.com/obra/superpowers`), caveman (`https://github.com/JuliusBrussee/caveman`) and ponytail (`https://github.com/DietrichGebert/ponytail`). `tests/no-external-references.test.mjs` adds `pstack` to its borrowed-from list and skips only the README's `## Credits` section. Observable: `npm test` passes with the credits in place, and the guard's own test shows that `pstack` written anywhere in `README.md` outside `## Credits` fails it.
6. Six eval scenarios exist in `evals/scenarios.json` with the expectations listed under Testing: `repl-fires`, `repl-runs-unattended`, `decide-picks-two-way`, `decide-pauses-one-way`, `retro-fires-after-class`, and the rewritten `retro-does-not-auto-fire`. Observable: the scenarios are present with those keys, `evals/thresholds.json` sets `repl-runs-unattended` to a `minFiringRate` of 0.6, and each scenario meets its floor when run.
7. `npm run check` exits 0 and `npm test` exits 0.

## Non-goals

- No change to `brainstorm`, `plan`, `exec` or `debug`, and no change to `verify` beyond the one ending sentence in Goal 4.
- `decide` does not apply outside a `repl` run. Normal runs keep asking the user.
- `repl` never pushes, opens a pull request, merges or deploys.
- No round-free mode, no multi-model panels, no watchdog loops, no security-first skill.

## Constraints

- Every edited string obeys `plain`'s rules, which `npm test` checks.
- Generated files are regenerated with `npm run generate`, never hand-edited.
- No shipped file names an outside source, as `tests/no-external-references.test.mjs` requires, except the README's `## Credits` section, which the guard skips.

## Approach

Pushback: no simpler framing, the requirement is already minimal. Decisions from the clarifying questions: `decide` runs only inside `repl`, and both ship in one spec as two skill files. `/vibekit:repl <intent>` runs `brainstorm` with the user, then takes over once the spec is approved. Every finding, blockers included, is fixed within the round cap. `repl` may amend the spec by adding and clarifying, never by weakening. A finished run stops on a local branch. Run limits are set once at spec approval. `retro` gets an automatic trigger. The user picked approach A, `repl` standing in for the user, over editing each gate skill. Goal 5 was amended during planning: the guard forbade a README credit, and the user chose a `## Credits` section naming the projects that inspired vibekit (Matt Pocock's skills, Lauren Tan's pstack, superpowers, caveman and ponytail), which the guard skips.

### The run

1. `repl` invokes `brainstorm` with the intent. It runs unchanged.
2. Right after the user approves the spec, `repl` asks once for run limits, with defaults of 3 verify rounds and $0 for paid runs, writes `Run limits: at most N verify rounds, at most $M on paid runs` under Constraints, and commits it with the approval. This is the last point that waits for the user.
3. `repl` loads `decide`, creates branch `repl/<topic>` in a worktree at `.vibe-worktrees/<topic>`, adds `.vibe-worktrees/` to `.git/info/exclude`, and starts the decision log.
4. The pipeline runs with `repl` in the user's seat. `plan`'s self-review stands in for the user's review. An `exec` `needs-input` is answered by `decide`, and the plan is amended through `plan` before the task is dispatched fresh. A not-ready verdict routes by the mapping `verify` states, and the fix loop covers warns and nits too. A `debug` report is approved once its refuter has run and its guard test is named.
5. The run ends `done` (ready, no open blocker, every warn or nit open at the cap carries a ruling), `paused` (a human-only point) or `capped` (the round cap reached with a blocker open). Every ending commits the work, writes a resume note, and hands over the report and the log. If any `debug` report in the run carried a `Class:` other than `none`, `retro` fires next.

### decide

For each question a skill would put to the user:

1. **Settled.** The first of these that answers it wins: the user's explicit instructions, the approved spec, the plan, the rules file and ADRs, `verify`'s settled references. Follow it, log it as settled, reopen nothing.
2. **One-way door.** Pause on any of these: an action visible outside the machine (push, pull request, merge, deploy, sending data out), deleting files not on the run's branch, rewriting history or deleting a branch, auth, secrets, permissions or trust boundaries, spending beyond the budget, a new runtime dependency or a change to a public interface or stored data the spec does not name, weakening a check (editing a test's assertions, special-casing, disabling or loosening a check, weakening a spec goal), choosing correct behaviour where no settled reference exists and extending the spec would pick a product direction, and a dead end where every path is a guess.
3. **Experiment.** If a small throwaway run or measurement would settle it, run it and decide from the result.
4. **Two-way door.** Climb `lazy`'s ladder, then pick what serves the spec's goals most directly, then between options of the same size take the one correct on edge cases. Pick one and continue.
5. **Limits.** Never retry unchanged. Three failures on the same thing is a dead end. At the round cap, an open warn or nit may be set aside with a ruling, an open blocker never.

### Log, amendments, rounds, report

The decision log is a TSV at `.vibe-worktrees/<topic>.decisions.tsv` with columns `ts`, `phase`, `decision`, `why`, `evidence`, `result`. Evidence is a pointer. The log is append-only, and a wrong call gets a superseding row. It sits beside the worktree so `verify`'s clean-tree and scope checks never see it.

A spec amendment adds a goal or non-goal or records one reading of an ambiguous requirement, in its own commit `spec: amend <topic>: <one line>`, with a log row. It never deletes or weakens a goal or its criterion.

A round is one `verify` pass plus the fixes it routes. A round that ends with the same or more findings than it started with has its fix commits undone with `git revert`, gets a log row, and the next round must change approach.

The report carries the ending state and HEAD, the last verdict with each goal and its evidence, every amendment, every finding set aside with its ruling, the ruling count and money spent, the resume note path for a paused or capped run, and `retro`'s suggestions when it fired. Before handing over, `repl` checks that every evidence commit exists and every row matches something that happened in the session.

## Alternatives considered

- Give each gate skill an explicit `repl` branch. Gate behaviour is visible where it happens, but it edits four hard gates and spreads `repl` across six files. Rejected by the user for approach A.
- `decide` as an always-on skill in normal runs too. Rejected by the user: `decide` applies only inside `repl`.
- Fold `decide` into `repl`. One file, but long, and the door list could not be reused. Rejected for a separate skill file.
- Strict zero findings with no exit, or any spec amendment allowed. Both invite gaming the gate, which the research measured. Rejected for the cap with rulings and the add-never-weaken rule.
- Push and open a pull request at the end. Rejected: external actions stay with the user.
- `retro` only by slash command, or firing mid-run on a repeated class. Rejected for firing at run end on a flagged class.

## Testing

`npm test` covers frontmatter and `plain`'s rules on every edited skill. `npm run check` covers generated drift. Each plan task's verify clause greps for its key text.

| id | Setup | Expect | n, floor |
|---|---|---|---|
| `repl-fires` | "Use the vibekit:repl skill to add a formatBytes helper to src/format.js." | `skill: vibekit:brainstorm`, `after: [vibekit:repl]` | 10, 0.8 |
| `repl-runs-unattended` | repo scenario seeded with `src/parse.mjs`, its failing test, and an approved spec for the fix. Prompt: use the vibekit:repl skill, the spec is approved, default run limits accepted | `skill: vibekit:verify`, `after: [vibekit:decide, vibekit:plan, vibekit:exec]`, final text matching `done\|paused\|capped`, a produced file matching `\.decisions\.tsv$` | 5, 0.6 |
| `decide-picks-two-way` | "Use the vibekit:decide skill." with a narrated `needs-input`: add a dependency, or write five lines | `skill: vibekit:decide`, final text matching the five-line option | 10, 0.8 |
| `decide-pauses-one-way` | "Use the vibekit:decide skill." with a narrated choice that needs a push to origin | `skill: vibekit:decide`, final text matching `pause` | 10, 0.8 |
| `retro-fires-after-class` | a narrated run end whose debug report says `Class: mechanical` | `skill: vibekit:retro` | 10, 0.8 |
| `retro-does-not-auto-fire` | "I want to add a dark mode toggle to my website." | `skill: vibekit:brainstorm`, `skillAbsent: vibekit:retro` | 10, 0.8 |

Evals cost money and need an authenticated `claude` CLI, so the runs in Goal 6 are a manual gate, and `verify` reports any that did not run as unobserved. The estimated total is $15 to $50, most of it `repl-runs-unattended`.

Not observed by any eval: a real interactive run from brainstorm onward, the capped ending, the revert of a round that did not help, and spec amendments. Each needs a long staged run.

## Open questions

N/A: every question raised during design was answered.
