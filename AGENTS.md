# AGENTS.md

Guidance for any AI agent — Claude, Codex, Gemini, or otherwise — working in this repository. Read this file before making any change.

## What this repo is

`vibekit` is a 12-skill plugin that turns a short user intent into a verified, user-approved feature through a disciplined pipeline: brainstorm → plan → isolate → exec → verify → review → integrate. The orchestrator is `vibe`; every other skill composes beneath it. `memory-dual` is the cross-cutting durable-knowledge surface (atomic facts + compound documents + working notepad, one storage convention). `vibekit-doctor` is a diagnostic utility. Future Phase 3 work fuses parallel dispatch into `exec-dispatch` and adds long-running iteration, observability, and visual-review skills.

## Repository layout

```
vibekit/
├── .claude-plugin/            # plugin manifest and marketplace metadata
├── agents/                    # (reserved for agent definitions)
├── commands/                  # slash commands; commands/vibe.md triggers the pipeline
├── docs/
│   ├── evals/                 # static and live eval reports — update after skill changes
│   ├── specs/                 # design docs produced by brainstorm-lean
│   ├── plans/                 # implementation plans produced by plan-write
│   ├── reviews/               # review docs produced by review-pack
│   └── verifications/         # verification reports produced by verify-gate
├── hooks/                     # (reserved; no hooks yet)
├── skills/
│   ├── _authoring/            # local-only authoring references (not shipped)
│   ├── vibe/                  # orchestrator
│   └── <eleven other skills>/ # each with SKILL.md, self-contained
├── tests/
│   └── eval/                  # throwaway test repos for live evals
├── .gitignore
├── AGENTS.md                  # this file
└── README.md                  # product front door
```

## The skills

Every skill is **self-contained**. Do not reference external plugins (superpowers, caveman, oh-my-claudecode, etc.) in any shipped skill. If a skill needs a concept from elsewhere, inline the relevant discipline.

| Skill | Responsibility |
|-------|----------------|
| `vibe` | 7-stage orchestrator. |
| `brainstorm-lean` | Socratic design gate with HARD-GATE and frontmatter-based status. |
| `plan-write` | TDD-shaped, bite-sized plan with exact commands and verified predictions. |
| `brief-compiler` | RTCO brief template for subagent dispatch. |
| `exec-dispatch` | One fresh subagent per task, two-stage review. |
| `report-filter` | Syntactic schema validation of subagent returns. |
| `verify-gate` | Evidence-based completion, three independent verdict dispatches per requirement. |
| `review-pack` | Reflexion-style self-critique + user sign-off. |
| `finish-branch` | Integration endpoint — merge / PR / keep / abandon, never auto. |
| `isolate` | Worktree or branch per run; clean slate, cheap rollback. |
| `memory-dual` | Durable project knowledge under `.vibekit/memory/` — atomic facts and compound documents in one storage convention, plus working notepad; keyword + tag + type search, `[[key]]` cross-links, audit pass. |
| `vibekit-doctor` | Diagnostic health check — skill files, runtime registrations, `.vibekit/` health, `docs/` subdirs, authoring contracts. Read-only by default; `--fix` for safe repairs. |

Before editing any skill, read its current `SKILL.md` in full. Skills are behavior-shaping prompts; small edits change agent behavior.

## Compression policy (load-bearing)

**Compress:** agent status chatter, subagent briefs, subagent reports (capped), wiki/memory entries, progress logs, commit messages, review comments, orchestrator-level stage announcements.

**Never compress — verbatim or drop, never rewrite:**

- Questions asked to the user, and the user's answers when quoted.
- Plan files, spec files, design-doc templates.
- TDD step markers (red / green / refactor).
- Verification evidence (test output, error messages, stack traces).
- Destructive-operation warnings.
- Commit SHAs, file paths, line numbers, code snippets.
- PR / merge / commit final text.

If a compression would reduce guardrail clarity by any amount, do not compress.

## Guardrails (non-negotiable)

These are the plugin's reason to exist. None of them can be bypassed by a flag.

- No implementation without an approved spec (`status: approved` in frontmatter).
- No dispatch without a plan whose commands and expected outputs have been validated.
- No commit without the task's exact test command running and passing.
- No "done" claim without evidence quoted verbatim.
- No merge / PR / push without explicit user sign-off in this invocation.
- On any "Expected" mismatch: **halt and report**. Never improvise a fix.

## How to work on this repo

### Read before you write
- Read `AGENTS.md` (this file) and `README.md`.
- For skill work, read the relevant `SKILL.md` in full.
- For pipeline work, read `skills/vibe/SKILL.md` and the skill it most immediately affects.

### Edit only the canonical source
- Each skill is its own `SKILL.md`. There is no auto-sync yet.
- Do not copy a skill's content into another file; reference by skill name instead.

### Keep skills self-contained
- A shipped skill must not reference `external/`, `superpowers/`, `caveman/`, `oh-my-*/`, or any local-only path.
- If you need a concept from elsewhere, inline it.

### Default paths
- Specs: `docs/specs/YYYY-MM-DD-<topic>-design.md`
- Plans: `docs/plans/YYYY-MM-DD-<feature>.md`
- Reviews: `docs/reviews/YYYY-MM-DD-<feature>-review.md`
- Verifications: `docs/verifications/YYYY-MM-DD-<feature>-verify.md`

User settings can override these; honor the user's paths when they are set.

### Commits
- Conventional Commits. Short subject, body only when the "why" is non-obvious.
- One logical change per commit.
- Do not use `--no-verify`, `--amend`, or `--force` unless the user explicitly asks.
- Never add Co-Authored-By trailers unless the user asks.

### Evals
- After any substantive skill change, update or add an eval report in `docs/evals/`.
- Static eval: walk the skill as if executing it; log ambiguities and guardrail leaks.
- Live eval: set up a throwaway repo under `tests/eval/<run-id>/`, actually dispatch subagents, capture the output verbatim.
- Tests/eval sub-repos are git-ignored; they are not part of the plugin.

### Things that do not belong in shipped code
- Project-specific configuration, domain-specific logic, local paths.
- References to external plugins by name.
- "For future use" code with no current caller.
- Fabricated benchmarks or evals. Real runs only.

## Non-Claude runtime specifics

All agents read this file the same way. There is no runtime-specific guidance that belongs here today. As cross-CLI adapters (Codex, Gemini CLI, Cursor, Windsurf, Cline, Copilot) land, any adapter-specific notes will be added here in a dedicated section — not duplicated into runtime-specific files.

## If in doubt

- Prefer halting and asking the user over improvising.
- Prefer files over prose summaries for stage-to-stage handoffs.
- Prefer a specific, citable piece of evidence over a confident claim.

## License

MIT.
