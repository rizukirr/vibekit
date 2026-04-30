# vibekit

Vibekit is a discipline-first vibe-coding plugin for Claude Code, OpenAI Codex, OpenCode, Gemini CLI, and Pi. One command — `/vibe <intent>` — drives a 7-stage pipeline (brainstorm → plan → isolate → exec → verify → review → integrate) that produces a verified, user-approved feature. For autonomy, `/ralph-loop` re-runs `/vibe` across iterations until verify-gate is satisfied, bounded by budgets, and never bypassing sign-off.

Token-efficient per feature: subagent briefs are RTCO-compressed and reports are schema-stripped, while every guardrail — evidence quotes, plans, constraints, degradation warnings — stays verbatim.

Guardrails are non-negotiable. If the plan is wrong or the tests don't pass, the pipeline **halts loudly** — it does not silently commit the wrong thing.

---

## What you get

- **`/vibe <intent>`** — the full 7-stage pipeline in one command.
- **`/ralph-loop <intent>`** — autonomous bounded re-run of `/vibe` with a blocker classifier and thrashing critic. Same gates, never bypasses sign-off.
- **Thirteen invocable skills** that also work standalone, plus an auto-loaded priming layer (`using-vibekit`) that carries the trigger map.
- **Auto-trigger discipline.** A SessionStart hook (Claude Code) and equivalent adapters (Codex native discovery, Gemini `@`-import, opencode plugin, Pi `before_agent_start` extension) load `using-vibekit` into every session so pipeline skills cannot be silently skipped.
- **Evidence-based verification.** Every "done" claim is backed by the exact test output, verbatim.
- **Halt-and-report discipline.** Real live eval caught two plan defects cleanly; neither reached a commit.
- **Token-efficient by design.** Compression is applied to agent framing; every guardrail stays verbatim.
- **Karpathy-aligned discipline.** Four-axis authoring contract: PEG (substance), Karpathy (behavior), Caveman (style), Quad-Adapter (cross-runtime portability).
- **Parallel-group dispatch** when a plan marks tasks as independent, with honest sequential fallback on runtimes that lack parallel subagents.
- **Cross-session knowledge.** `memory-dual` captures durable project knowledge — atomic facts, compound documents, and a working notepad — under one file-backed convention.

---

## Install

### Claude Code

From a marketplace that hosts this plugin:

```
/plugin marketplace add rizukirr/vibekit
/plugin install vibekit@vibekit
```

From a local clone:

```bash
git clone <this repo>
cd vibekit
# then add the repo path as a plugin source in Claude Code settings
```

After installation, restart Claude Code. The `/vibe` command and all skills become available.

### OpenCode

Tell the agent:

```
Fetch and follow instructions from https://raw.githubusercontent.com/rizukirr/vibekit/refs/heads/main/.opencode/INSTALL.md
```

That keeps installation instructions centralized in one file and avoids README drift.

### OpenAI Codex

Tell Codex:

```
Fetch and follow instructions from https://raw.githubusercontent.com/rizukirr/vibekit/refs/heads/main/.codex/INSTALL.md
```

Manual installation is also documented in `.codex/INSTALL.md`.

### Gemini CLI

Tell Gemini CLI:

```bash
Fetch and follow instructions from https://raw.githubusercontent.com/rizukirr/vibekit/refs/heads/main/INSTALL.gemini.md
```

Detailed Gemini docs: `INSTALL.gemini.md` and `docs/README.gemini.md`.

### Pi

Tell Pi:

```
Fetch and follow instructions from https://raw.githubusercontent.com/rizukirr/vibekit/refs/heads/main/docs/INSTALL.pi.md
```

Manual installation is also documented in `docs/INSTALL.pi.md`. Quick path:

```bash
npm install -g @mariozechner/pi-coding-agent
pi install git:github.com/rizukirr/vibekit
```

---

## Quick start

```
/vibe add a toKebabCase utility with tests
```

What happens:

1. **Brainstorm.** The pipeline asks a few clarifying questions (edge cases, scope, testing approach), proposes 2–3 approaches with trade-offs, and writes a short design doc you sign off on.
2. **Plan.** It produces a TDD-shaped implementation plan — every step is bite-sized, every command is exact, every commit is named.
3. **Isolate.** A git worktree gets created so your main branch is untouched.
4. **Execute.** Each task runs in a fresh subagent with a tight brief. On any "Expected" mismatch, the agent halts and reports — no improvised fixes.
5. **Verify.** Every spec requirement is checked against the actual evidence. Three independent verdict passes per requirement.
6. **Review.** A self-critique surfaces blocks / warns / nits. You see the full diff.
7. **Integrate.** You pick: merge locally, open a PR, keep the branch, or abandon. Nothing ships without your explicit choice.

You only talk to the pipeline during brainstorm and at each gate. The rest is autonomous.

---

## The skills

All 13 invocable skills live in `skills/` and can be used standalone. A 14th skill, `using-vibekit`, is the priming layer — it is auto-loaded on session start by every supported runtime and is not invoked manually.

**Pipeline:**

| Skill | Role |
|-------|------|
| `vibe` | Orchestrator for the 7-stage pipeline. |
| `brainstorm-lean` | Disciplined Socratic design gate with a HARD-GATE before implementation; pushback turn challenges framing before approaches are proposed. |
| `plan-write` | TDD-shaped, bite-sized implementation plan with exact commands; mandatory `→ verify:` clause per task; optional `parallel-group` markers. |
| `brief-compiler` | Turns verbose intents into tight RTCO subagent briefs with surgical-change constraints baked in. |
| `exec-dispatch` | One fresh subagent per task, two-stage review, parallel-group fan-out where the runtime supports it. |
| `report-filter` | Validates subagent returns against the declared schema; rejects drift. |
| `verify-gate` | Evidence-based completion check, three independent verdict dispatches per requirement, plus a fail-closed surgical-diff pass. |
| `review-pack` | Reflexion-style self-critique with simplicity + surgical-diff passes, then user sign-off on the diff. |
| `finish-branch` | Integration endpoint — merge / PR / keep / abandon, no auto-actions. |
| `isolate` | Dedicated worktree or branch per run; rollback is cheap. |

**Cross-cutting:**

| Skill | Role |
|-------|------|
| `memory-dual` | Durable project knowledge under `.vibekit/memory/` — atomic facts and compound documents in one storage convention, plus a working notepad. Keyword + tag + type search; `[[key]]` cross-links; audit pass. |
| `vibekit-doctor` | Diagnostic health check — skill files, runtime registrations, `.vibekit/` health, `docs/` subdirs, authoring contracts. Read-only by default; `--fix` for safe repairs. |
| `ralph-loop` | Autonomous-driver peer to `vibe` — bounded persistence loop with blocker classifier and thrashing critic. Same gates, same sign-off, no shortcuts. Cross-runtime with degraded checkpoint mode where native loops are absent. |

---

## The guardrails

Non-negotiable. None of them can be bypassed by a flag.

- No implementation without an approved spec.
- No dispatch without a plan.
- No commit without the task's exact test command running and passing.
- No "done" claim without evidence quoted verbatim.
- No merge / PR / push without explicit user sign-off.
- On any "Expected" mismatch: **halt and report**, never improvise a fix.

This is what keeps vibe-coding from turning into vibe-disasters.

---

## Token budget

Measured in live eval on a small feature (toKebabCase utility, 2-task plan, 1 verification pass):

- Total subagent tokens: ~118k across 4 dispatches.
- Wall clock: minutes per dispatch; dominated by test-runner I/O.
- Compression concentrated in agent briefs + reports; guardrails stay full prose.

Large features scale linearly with task count. Verification cost scales with requirement count × 3 (self-consistency). For large specs the `verify-gate` skill offers a critical-only mode.

---

## Philosophy

- **Form compresses, guardrails don't.** Agent framing is fragmented; evidence and constraints are verbatim.
- **Halt is a feature.** The pipeline would rather stop and surface a defect than improvise.
- **One thing per run.** No mega-runs. One feature, one spec, one plan, one integration choice.
- **Files over summaries.** Stages hand off via committed files, never prose summaries.
- **Cross-runtime portability is a contract, not a hope.** Every runtime-coupled skill declares its required capabilities and ships a documented fallback for runtimes that lack them — with a verbatim degradation warning, never a silent skip.

---

## Evals

Three evals are on record under `docs/evals/`:

- `2026-04-21-static-eval-run-01.md` — initial static walkthrough; found 3 blocking defects, 7 warns, 4 nits.
- `2026-04-21-static-eval-run-02.md` — post-fix re-walk; all blockers resolved, no regressions.
- `2026-04-21-live-eval-run-03.md` — live dispatch on a throwaway repo; the halt-and-report discipline was proven twice under real subagents.

Re-running the evals after substantive skill changes is recommended. A packaged harness will come in a later release.

---

## License

MIT.

## Acknowledgements

Thanks to all plugins that inspired this one, especially:

- [superpowers](https://github.com/obra/superpowers)
- [omc](https://github.com/Yeachan-Heo/oh-my-claudecode)
- [andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills)
- [caveman](https://github.com/JuliusBrussee/caveman)
- [Prompt-Engineering-Guide](https://github.com/dair-ai/Prompt-Engineering-Guide)
