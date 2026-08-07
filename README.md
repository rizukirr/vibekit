# vibekit

Guardrailed vibe-coding pipeline for coding agents. Dependency free.

## Skills

<!-- vibekit:generated:skill-list -->
- `brainstorm` — Use before any creative or implementation work — features, components, behavior changes. Hard gate, no code before an approved design.
- `example-command` — Fixture skill that exercises slash-command emission.
- `example-plain` — Fixture skill that exercises the plain-skill path.
- `exec` — Use when a plan is approved and implementation has not started — dispatches one fresh subagent per task, runs each task's verify clause, and routes failures back instead of repairing them. One task, one commit.
- `lazy` — Use at the start of any coding work — writing, adding, refactoring, fixing, designing. The laziness ladder: stdlib and native features before new code, one line before fifty. Stays on after.
- `plan` — Use when a spec is approved and implementation has not started — turns it into a task-by-task plan with exact paths and checkable verification. No code here.
- `terse` — Use at the start of every session — compress narration, never artifacts. Questions, evidence, specs, plans and warnings stay verbatim. Stays on after.
- `using-vibekit` — Use when starting any conversation — establishes the auto-trigger discipline so guardrail skills fire instead of being silently skipped.
- `verify` — Use before claiming a change is done, fixed or passing — checks the whole change against its spec, runs the checks no single task could, and returns ready or not ready. Evidence or it did not happen.
<!-- /vibekit:generated -->

## Runtime support

| Runtime | Emitter | Verified |
|---|---|---|
| Claude Code | `runtimes/claude-code.mjs` | Yes — SessionStart hook smoke-tested in CI on Linux and Windows |
| Codex | `runtimes/codex.mjs` | **No** — output shape is modelled on a previously-shipped package, never confirmed against a live Codex install |

The Codex emitter's tests assert that it produces what we decided it should
produce, which says nothing about whether Codex accepts it. Treat Codex support
as unproven until someone installs the generated plugin and reports back.

## Evals

Skills are behaviour-shaping prompts, so the only way to know one works is to
watch it fire in a real session.

```
npm run eval                                  # candidate only, deterministic
npm run eval -- --baseline main --candidate HEAD   # A/B two refs
npm run eval -- --dry-run                     # print the plan and cost, spawn nothing
npm run eval -- --judge                       # also grade whether the skill was followed
```

Variants are git refs materialised as throwaway worktrees, so there is never a
second `skills/` tree to drift. Sessions run in a disposable temp directory, not
the repo.

This costs real money and needs an authenticated `claude` CLI, so it is a manual
gate — not part of the free CI (`check`, `test`, `check:hook`).

## Install

Claude Code: `/plugin marketplace add rizukirr/vibekit`

## Development

- `npm run generate` — regenerate every derived file
- `npm run check` — fail if any generated file is out of date
- `npm test` — run the unit tests
