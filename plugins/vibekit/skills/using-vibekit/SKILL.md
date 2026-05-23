---
name: using-vibekit
description: Use when starting any conversation — establishes vibekit's auto-trigger discipline so pipeline skills (brainstorm, brief, plan, exec, verify, review, finish, memory) actually fire at their trigger points instead of being silently skipped.
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill. Subagents follow their RTCO brief, not the orchestration discipline.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a vibekit skill applies to what you are about to do, you MUST invoke it via the Skill tool.

This is not negotiable. You cannot rationalize "the task is too small," "I already know the answer," or "it would be faster to just do it." Skipping a guardrail skill is the failure mode this plugin exists to prevent.
</EXTREMELY-IMPORTANT>

## Instruction priority

1. **User's explicit instructions** (CLAUDE.md, AGENTS.md, GEMINI.md, direct messages) — highest.
2. **Vibekit skills** — override default behavior where they conflict.
3. **Default system prompt** — lowest.

If the user says "skip the brainstorm" or "just write the code," follow the user. Otherwise, follow the trigger map below.

## Auto-trigger map

| Trigger condition | Skill that MUST fire |
|---|---|
| User says "vibe" or gives a short intent ("add X", "build Y", "fix Z") | `vibe` |
| About to start any creative or implementation work, before code is written | `brainstorm-lean` |
| Spec is approved, implementation has not started | `plan-write` |
| Plan is approved, before any implementation dispatch | `isolate` |
| About to dispatch any subagent / Task / Agent call | `brief-compiler` (compile RTCO brief first) |
| Executing an approved plan task-by-task | `exec-dispatch` |
| Just received output from a subagent, tool chain, or dispatched task | `report-filter` |
| About to claim work is done, fixed, complete, or passing | `verify-gate` |
| `verify-gate` returned `ready`, before any outward-facing action | `review-pack` |
| `review-pack` returned `yes` and user signed off on the diff | `finish-branch` |
| Driving a vibe run autonomously across iterations | `ralph-loop` |
| Storing, recalling, or auditing durable project knowledge | `memory-dual` |
| User reports vibekit feels broken, skills not firing, or cross-runtime drift | `vibekit-doctor` |

## Hard gates (never bypass)

- **No code before brainstorm-approved design.** `brainstorm-lean` has a HARD-GATE; respect it on every project regardless of perceived simplicity.
- **No "done" claim before verify-gate.** Evidence before assertions, always.
- **No merge / push / PR before review-pack sign-off.** `finish-branch` is the only outward-facing endpoint.
- **No subagent dispatch without a compiled brief.** `brief-compiler` runs first; `report-filter` runs on return.

## How to access skills

- **Claude Code / Copilot CLI:** `Skill` tool. The skill content loads — follow it directly. Never `Read` a skill file as a substitute for invoking it.
- **Codex:** skills are referenced from `AGENTS.md`; invoke by following the named workflow.
- **Gemini CLI:** `activate_skill` tool.
- **opencode:** see the per-runtime adapter shim.
- **Pi:** `prompts/vibe.md` is registered via the `pi` key in package.json; skills auto-discovered from `skills/` and primed by the .pi-plugin extension. Invoke via `/skill:<name>` or by following the auto-trigger map.

## Compression policy reminder

Compress agent chatter, briefs, capped reports, progress logs. **Never compress** questions to the user, user answers, plan files, TDD markers, verification evidence, error quotes, code blocks, destructive-operation warnings, or final commit/PR text. If a compression would reduce guardrail clarity by any amount, do not compress.

## Anti-patterns

- "This is too simple to need brainstorm." → Wrong. Run `brainstorm-lean`. The design can be three sentences, but it must exist and be approved.
- "I'll skip verify-gate, the diff is obviously right." → Wrong. The diff being obvious is not evidence. Run the verification.
- "I'll dispatch this subagent with a quick inline prompt." → Wrong. Run `brief-compiler` to produce an RTCO brief, every time.
- "The subagent's report looks fine, I'll just use it." → Wrong. Run `report-filter` to enforce schema and strip restatements.
