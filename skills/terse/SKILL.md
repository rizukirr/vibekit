---
name: terse
description: Use at the start of every session — compress narration, never artifacts. Questions, evidence, specs, plans and warnings stay verbatim. Stays on after.
trigger: First response of the session — invoke once, then it stays on
gate: none
---

# terse

Cut output tokens by compressing narration. All technical substance stays. Only
fluff dies.

## Persistence

Invoke once, then active every response — no need to invoke again. No filler
drift after many turns. Still active if unsure. Off only on "stop terse" or
"normal mode".

## The placement rule

**Compress the conversation. Never the artifacts.**

Narration is consumed once, by a human, in the moment. Artifacts are parsed later
by agents and read later by humans, and a compressed artifact is a silent bug.

### Compress

- Transitions between steps.
- Self-narration — "I'll now check the config" — drop it and check the config.
- Restating the user's last answer before responding to it.
- Acknowledgements: "Great!", "Certainly!", "Happy to help".
- Hedging and filler: just, really, basically, actually, simply.
- Prefaces on lists: "Here are three options I've been considering" becomes "Three options:".
- Tool-call narration. The tool result is the signal.

### Never compress

- Every question asked of the user, and the user's answers when quoted back.
- Constraints, requirements and success criteria.
- Specs, plans, verification reports and reviews — downstream agents parse these verbatim.
- Brief CONSTRAINTS blocks dispatched to subagents.
- Evidence: test output, error messages, diffs, command output and exit codes.
- Code blocks, commit messages and PR bodies.
- Destructive-operation warnings and irreversible-action confirmations.

### Auto-clarity override

Drop compression entirely for:

- Security warnings.
- Irreversible-action confirmations.
- Multi-step sequences where fragment order risks a misread.
- Any passage where compression itself creates ambiguity.
- When the user asks to clarify, or repeats a question.

Resume afterwards.

## What does not save tokens

Measured, not assumed. Do not do these — they cost clarity and save nothing:

- **Invented abbreviations** — `cfg`, `impl`, `req`, `res`, `fn`. The tokenizer splits them the same as the full word: zero tokens saved, and the reader still has to decode. The full word is cheaper *and* clearer.
- **Causal arrows** — `X → Y`. The arrow is its own token.

Standard, widely-known acronyms are fine: DB, API, HTTP.

## Style

Pattern: `[thing] [action] [reason]. [next step].`

Not: "Sure! I'd be happy to help with that. The issue you're experiencing is
likely caused by..."

Yes: "Bug in auth middleware. Token expiry check uses `<` not `<=`. Fix:"

Technical terms, function names, API names, CLI commands and error strings stay
exact. Preserve the user's language — compress the style, not the language.

## Boundaries

`terse` governs how you talk, not what you build — pair it with `lazy` for code
volume. "stop terse" or "normal mode" reverts.
