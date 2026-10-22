---
title: retro
date: 2026-10-22
status: approved
---

# retro: Design

## Problem

When a vibekit run goes wrong, `debug` finds the cause in the code and routes a fix with a guard test. The guard test stops that one bug from coming back. Nothing stops the class of mistake behind it, and nothing records friction that never failed a check, like turns lost to a command that errors for a predictable reason. In this repo, a scenario missing `repo: true` cost a paid eval run that `npm test` could have caught for free, and no skill would have proposed that check.

## Goals

1. A new skill `skills/retro/SKILL.md` exists with frontmatter `name: retro`, `gate: none`, `command: true` and the trigger `Invoked explicitly as a slash command, never fires on its own`. Observable: the file exists with those values, and after `npm run generate` the file `commands/retro.toml` and a `retro` row in the `CLAUDE.md` trigger table exist.
2. `retro`'s procedure is in the skill text. Observable: `skills/retro/SKILL.md` contains the three suggestion types `check`, `rule` and `pointer`, the cap of at most five suggestions, the heading `## Rules` as the destination for rules, and the spec path `docs/specs/YYYY-MM-DD-retro-checks-design.md`.
3. `debug`'s report carries a `Class:` field. Observable: the report block in `skills/debug/SKILL.md` contains a line starting `Class:` directly after the line starting `Guard:`.
4. `verify`'s ending points at `retro` on a troubled run. Observable: `## The ending` in `skills/verify/SKILL.md` contains `/vibekit:retro`.
5. Four eval scenarios exist in `evals/scenarios.json`: `retro-fires`, `retro-proposes-and-waits`, `retro-does-not-auto-fire` and `debug-reports-class`, each with `n` of 10 and the expectations listed under Testing. Observable: the scenarios are present with those keys, and `npm run eval -- --scenarios <id>` meets the default `minFiringRate` of 0.8 for each when run.
6. `npm run check` exits 0 and `npm test` exits 0.

## Non-goals

- `retro` never fires on its own, and no skill invokes it.
- `retro` does not read earlier session transcripts or git history.
- `retro` does not edit or remove rules it did not write in the current run.
- `retro` does not write checks itself, fix the session's code, or create branches.
- No change to `brainstorm`, `plan`, `exec` or `quick`.

## Constraints

- Every edited string obeys `plain`'s rules, which `npm test` checks.
- Generated files are regenerated with `npm run generate`, never hand-edited.
- No new dependency.

## Approach

Pushback response: the user rejected the smaller framing (`debug` routes the cheap check as a second task, no new skill) and chose the larger one. The smaller version adds the check before `verify` confirms the cause, and misses friction that never failed a check.

Decisions from the clarifying questions: `retro` is a slash command, and `verify` mentions it in one line at the end of a troubled run. It reads only the current session's conversation. It writes accepted rules itself and hands accepted checks to `plan` as an approved spec. Rules go under `## Rules` in the rules file the current runtime loads. The user picked approach A, a standalone skill, over folding the procedure into `verify`. Goal 1 was amended after PR #58 stopped generating Claude Code command wrappers: `commands/retro.md` no longer exists by design, and `commands/retro.toml` remains for codex.

### Units

`debug` gets one report field, directly after `Guard:`:

```
Class:    none | the class of mistake, and the cheap check that would have caught it
```

A paragraph in the report section names the four signs that make a cause a class: it is mechanical and could recur elsewhere, an expensive instrument caught what a cheap one could have, the same cause appears twice in the session, or the tooling was at fault rather than the code. With none of them, the field reads `none`. The fix spec does not copy `Class:`.

`verify`'s `## The ending` gets one sentence covering both exits. If this run contained a `not ready` verdict, a failed `exec` clause or a `debug` report, the ending adds one line: the count of failures, every `Class:` line verbatim, and that `/vibekit:retro` proposes checks and rules that catch them next time. A clean run adds nothing.

`retro` is new. Its description: "Use when the user types /vibekit:retro: looks back over this session's failures and friction, proposes checks and rules that would catch them next time, and writes only what the user picks."

### Procedure

1. Invoke `lazy`, `terse` and `plain`.
2. Gather every failure (`not ready` verdicts, failed clauses, `debug` reports with their `Class:` lines) and every friction point (turns lost to a predictably failing command, or to searching for something the repo could have pointed to). Each cites the command, the error or the turn.
3. Read the rules file and the project's test and check commands. Drop any suggestion an existing rule or check already covers. A repo with no tests and no rules file gets that as its first suggestion.
4. Sort each item into at most one suggestion, typed `check` (a mechanical mistake a script can catch), `rule` (a judgement call, one line of prose) or `pointer` (where something lives, one line of prose). An item with nothing to prevent is dropped, and the drop count is reported.
5. Present at most five, ranked by the turns or money each would have saved, the top one marked recommended, in this shape, then wait for the user's pick:

```
1. check    scenarios expecting a committed file must set repo: true
   Seen:    eval run 1 scored 0.00, no session could commit
   Where:   tests/, run by npm test
```

6. Write accepted rules and pointers under `## Rules` in the rules file and commit that file alone on the current branch. The pick is the approval.
7. Write accepted checks into one spec at `docs/specs/YYYY-MM-DD-retro-checks-design.md` with `status: approved`. Each check gets a goal: it fails on a fixture reproducing the session's mistake and passes on the repo at HEAD. Commit the spec and invoke `plan` with its path.

### Edge cases

| Case | Behaviour |
|---|---|
| Nothing to look back on, or a clean session | says nothing to propose and stops |
| The user picks none | says nothing was written and stops |
| Rules file has a generated region | `## Rules` sits outside every `<!-- vibekit:generated -->` region, appended to if it exists |
| Rules file missing | created with the heading and the rules only |
| Which rules file | `CLAUDE.md` on Claude Code, `AGENTS.md` on the other runtimes, never the one the runtime does not load |
| On the base branch | commits anyway and names the branch in its report |
| Spec path matched by `git check-ignore` | writes the file, says it is ignored, asks before any `git add -f` |
| A check needs a dependency | left out of the spec and noted as wanting `brainstorm` |

The only files `retro` writes are the rules file and the check spec.

## Alternatives considered

- Fold the procedure into `verify`'s ending, with `/vibekit:retro` as a thin command pointing at it. Fewest new files, but two homes for one procedure, and about 40 lines in a hard gate that matter only on troubled runs. Rejected by the user in favour of a standalone skill.
- Route the cheap check from `debug` as a second task, with no `retro`. Rejected at the pushback turn.
- Read earlier transcripts from disk. The format belongs to Claude Code, opencode stores sessions differently, and one transcript can overflow the context.
- Write checks directly, as `quick` does. Puts unreviewed test code past every gate.

## Testing

`npm run check` and `npm test` cover the new skill's frontmatter, `plain`'s rules on all three edited files, and drift in the generated `commands/retro.md` and trigger table rows.

Four eval scenarios, each `n` 10 on sonnet with the default floor of 0.8:

| id | Prompt | Expect |
|---|---|---|
| `retro-fires` | "Use the vibekit:retro skill." with a short narrative of a failed eval run caused by a missing `repo: true` | `skill: vibekit:retro` |
| `retro-proposes-and-waits` | the same prompt | `skill: vibekit:retro`, final text matching a numbered `check`, `rule` or `pointer` line, no new files |
| `retro-does-not-auto-fire` | the `debug-fires` prompt and fixture | `skill: vibekit:debug`, `skillAbsent: vibekit:retro` |
| `debug-reports-class` | the `debug-fires` prompt and fixture | `skill: vibekit:debug`, final text matching `Class:` |

The narrative in the `retro` prompts stands in for a session's history, since replaying a real troubled session costs too much. Evals cost money and need an authenticated `claude` CLI, so the run in Goal 5 is a manual gate, and `verify` reports it unobserved if it was not run.

Three behaviours have no eval and are reported unobserved: the `verify` mention, the rules file write and the check spec handoff to `plan`. Each would need a full pipeline run in one scenario.

## Open questions

N/A: every question raised during design was answered.
