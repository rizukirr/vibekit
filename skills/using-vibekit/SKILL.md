---
name: using-vibekit
description: Use when starting any conversation — establishes the auto-trigger discipline so guardrail skills fire instead of being silently skipped.
trigger: Session start
gate: none
---

# using-vibekit

If there is even a 1% chance a vibekit skill applies to what you are about to do,
invoke it.

This is not negotiable. "The task is too small", "I already know the answer" and
"it would be faster to just do it" are the rationalisations this plugin exists to
stop. A guardrail you talked yourself out of is a guardrail that was never there.

If a skill turns out to be wrong for the situation, you do not have to follow it —
but you do have to check.

## If you are a subagent

If you were dispatched to execute a specific task, skip this and follow your
brief. The orchestration discipline belongs to the session that dispatched you.

## Instruction priority

1. **The user's explicit instructions** — highest. If they say "skip the design step", skip it.
2. **vibekit skills** — these override default behaviour where they conflict.
3. **The default system prompt** — lowest.

## Finding the right skill

Every skill declares its own trigger, and the auto-trigger table in `CLAUDE.md` is
generated from those declarations — so it is never out of date. Read the table,
not a copy of it.

A skill whose row says `hard` is a gate. Respect it regardless of how simple the
task looks; simple tasks are where unexamined assumptions cost the most.

## Always on

Two skills are modifiers rather than steps: one governs what you build, the other
governs how you talk. Both are on by default and both say so in their own
descriptions. Apply them throughout rather than invoking them at a moment.

## How to invoke

Use the `Skill` tool. The skill's content loads and you follow it directly. Never
read a skill file as a substitute for invoking it — reading gives you the text
without the commitment.
