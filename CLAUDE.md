# CLAUDE.md

Guidance for Claude Code (and Codex / Gemini / opencode) when working in this repository.

## Project: vibekit

A fused plugin for Claude Code, Codex, Gemini, and opencode. Goal: one-command vibe-coding — user types short intent, plugin runs a disciplined brainstorm → plan → exec → verify pipeline that produces the feature the user actually wants, while keeping token usage low.

Three design pillars:

1. **Superpowers** — process discipline (brainstorming, writing-plans, TDD, verification, debugging, subagent dispatch). Guardrails are load-bearing and must not be compressed away.
2. **OMC (oh-my-claudecode / oh-my-codex)** — orchestration boost (teams, ralph, ultrawork, wiki, subagent-driven-development). Enables parallel power.
3. **Caveman** — output compression layer. Cuts prose/agent chatter ~60-75% without touching semantic content.

The combination: **powerful + token efficient, with zero guardrail loss.**

## Repository layout

```
vibekit/
├── external/                      # source plugins (read-only references)
│   ├── caveman/                   # token compression plugin
│   ├── superpowers/               # process-discipline skills
│   ├── oh-my-claudecode/          # CC orchestration toolkit
│   ├── oh-my-codex/               # Codex orchestration toolkit
│   └── Prompt-Engineering-Guide/  # technique reference (authoring input)
├── skills/                        # fused skills (to be built)
├── agents/                        # agent definitions
├── commands/                      # slash-command entrypoints
├── hooks/                         # harness hooks
└── .claude-plugin/                # plugin manifest
```

`external/` is never modified. It is the canonical source for ideas, patterns, and when in doubt, the existing behavior we must not regress.

## Role of Prompt-Engineering-Guide

**Critical authoring reference.** Every skill prompt and agent brief in this repo must be written using techniques from `external/Prompt-Engineering-Guide/`. This is non-negotiable — it is how we achieve *maximum output quality per token*.

Skills are prompts. Prompt quality determines product quality. Caveman compresses *style*; PEG structures *substance*. Both compound.

Which technique applies where:

| Skill type | Primary PEG technique |
|------------|-----------------------|
| Brainstorming (intent → requirements) | Socratic / Self-Ask |
| Planning (requirements → steps) | Plan-and-Solve, structured decomposition |
| Agent brief (dispatch) | Role + Task + Constraints + Output-format (RTCO) |
| Subagent execution (tool use) | ReAct (thought → action → observation) |
| TDD / stepwise reasoning | Chain-of-Thought (only where reasoning pays) |
| Verification | Self-consistency (multiple passes on critical output) |
| Debugging | Tree-of-Thought, competing hypotheses |
| Review | Reflexion (critique own first pass) |
| Report output | Structured output (JSON/YAML schema), no prose |

Before authoring any skill, consult `external/Prompt-Engineering-Guide/` for the specific technique, then cite it in the skill header. **Every token in a skill prompt must justify itself** — if a line is not doing role-set, task-spec, constraint, example, or output-format, cut it.

A distilled one-page reference (`skills/_authoring/peg-cheatsheet.md`) must be the first artifact produced, so all subsequent skills inherit a consistent standard.

## The vibe pipeline

Flagship skill: `/vibe <intent>`. Runs end-to-end autonomously; user only answers brainstorm questions.

```
/vibe add dark mode toggle
  └─ brainstorm-lean      Socratic Q&A, requirements crystallized
  └─ plan-write           plan.md written in normal prose (guardrail)
  └─ worktree-isolate     safe sandbox
  └─ exec-dispatch        OMC team/subagents execute, caveman briefs + reports
  └─ tdd-gate             red/green/refactor, verbatim
  └─ verify-gate          evidence-based completion, uncompressed quotes
  └─ review-pack          self + user review
  └─ finish-branch        merge or PR
```

## Compression policy (load-bearing)

Compress: agent status chatter, subagent briefs, subagent reports (capped), wiki/memory entries, progress logs, commit messages, review comments.

**Never compress:** questions asked to the user, user's quoted answers, plan files, TDD step markers (red/green/refactor), verification evidence, destructive-operation warnings, error message quotes, code blocks, checklist items, PR/commit final text.

If a compression would reduce guardrail clarity by *any* amount, do not compress.

## Cross-CLI portability

Target runtimes: Claude Code, Codex (via oh-my-codex), Gemini CLI, opencode.

Strategy: single source-of-truth skill files → `quad-adapter` skill emits per-CLI wrappers (CC `Skill` format, Codex AGENTS.md, Gemini `activate_skill`, opencode shim). CC and Codex are first-class native; Gemini and opencode are adapted.

## Working conventions

- **Never edit `external/`.** Fork patterns into `skills/` or `agents/` instead.
- **Read the source when extending a behavior.** If fusing a superpowers skill, read the original first. If extending an OMC agent, check the OMC skill it relies on.
- **No new features beyond task scope.** No speculative abstractions. No backwards-compat shims.
- **No comments in prompts or code unless the *why* is non-obvious.** Skill files are prompts — every line must earn its place.
- **Tests and verification are not optional.** Any skill that mutates code must route through `verify-gate`.
- **Guardrails are not style.** If a superpowers skill has a checklist, keep every item. Caveman applies to the *narration around* the checklist, never the checklist itself.

## Ship order

**Phase 0 — Foundation**
- `skills/_authoring/peg-cheatsheet.md` (authoring standard)

**Phase 1 — MVP vibe loop**
- `brief-compiler` (RTCO template, caveman pass)
- `report-filter` (structured schema, caveman pass)
- `brainstorm-lean` (Socratic + Self-Ask, guardrails intact)
- `plan-write` (normal prose, Plan-and-Solve)
- `exec-dispatch` (ReAct subagents)
- `verify-gate` (self-consistency)
- `vibe` (orchestrator wiring 1-6)

**Phase 2 — Quality gates**
- `tdd-gate`, `review-pack`, `finish-branch`, `debug-trace-lean`

**Phase 3 — Compound + portability**
- `wiki-dual`, `memory-dual`, `quad-adapter`, `commit-caveman`

## Guardrail regression tests

Before any skill ships, it must pass:

1. Brainstorm flow fires all four phases (intent, requirements, design, edge cases), one question per turn, user answers quoted exact.
2. Destructive operations surface full uncompressed warnings.
3. Debug evidence quotes are byte-identical to source.
4. Plan-exec checklist items are 1:1 with plan file.
5. TDD red/green/refactor markers are explicit, never fragmented.

Any failure = compression zone too aggressive. Pull back, do not ship.

## Quick references

- Caveman rules and levels: `external/caveman/skills/caveman/SKILL.md`
- Superpowers skills index: `external/superpowers/skills/`
- OMC agent catalog: `external/oh-my-claudecode/` (see its own CLAUDE.md)
- Codex parity toolkit: `external/oh-my-codex/`
- Prompt technique library: `external/Prompt-Engineering-Guide/`
