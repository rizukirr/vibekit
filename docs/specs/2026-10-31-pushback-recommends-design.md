---
title: pushback recommends
date: 2026-10-31
status: approved
---

# pushback recommends: Design

## Problem

`brainstorm`'s pushback template, at `skills/brainstorm/SKILL.md:61`, names a simpler framing and asks the user to choose between it and the larger one, but it asks for no recommendation. An agent following it exactly hands the whole judgement to the user, even though the agent has just read the code and formed a view.

## Goals

1. The pushback template in `skills/brainstorm/SKILL.md` carries a recommendation. Observable: the line starting `> **Pushback:** Before I sketch approaches` contains `I recommend` followed by a slot for the side and a slot for the reason, before the question to the user.
2. The `No simpler framing` variant is unchanged. Observable: `git diff` of `skills/brainstorm/SKILL.md` changes only the template line.
3. An eval scenario `brainstorm-pushback-recommends` exists in `evals/scenarios.json` with `n` of 10, expecting `vibekit:brainstorm` and a final text matching `I recommend`. Observable: the scenario is present with those keys, and it meets the default `minFiringRate` of 0.8 when run.
4. `npm run check` exits 0 and `npm test` exits 0.

## Non-goals

- No other change to `brainstorm`, including the rule of exactly one pushback turn.
- No change to the repl mode work, which has its own spec.

## Constraints

- Every edited string obeys `plain`'s rules, which `npm test` checks.
- Generated files are regenerated with `npm run generate`, never hand-edited.

## Approach

Pushback: no simpler framing, this is one line of template and one eval. The user chose a separate change, before repl mode.

The template becomes:

> **Pushback:** Before I sketch approaches, one challenge. `<one-sentence simpler framing or hidden assumption>`. I recommend `<smaller | larger>`, because `<one-sentence reason>`. Is the smaller version what you want, or do you need the larger framing? (If the larger framing is correct, say so and I'll proceed.)

The recommendation sits before the question, so the user reads the agent's view and can still choose either side.

A session under `claude -p` ends at the first question, so the eval's prompt answers the clarifying questions up front and asks for the pushback turn directly, with a request whose simpler framing is plain: a full theme engine for one static page.

## Alternatives considered

- Fold this into the repl mode spec. One pull request, but it mixes an unrelated fix into a new mode. Rejected by the user.
- Leave it to each user's own saved preferences. Other users would never get the recommendation.

## Testing

`npm test` covers `plain`'s rules on the edited line. `npm run check` covers generated drift. The eval runs 10 sessions on sonnet, about $1 to $4.50, as a manual gate, and `verify` reports it unobserved if it did not run.

## Open questions

N/A: every question raised during design was answered.
