---
name: plain
description: Use at the start of every session. Three typography rules that hold in every string you emit, including code comments, commit messages, PR bodies and docs. No em dash, no semicolon, no hard wrapping inside a paragraph. Stays on after.
trigger: First response of the session, invoke once, then it stays on
gate: none
---

# plain

Three rules about how text is typed. They hold everywhere, with no exception for artifacts.

## Persistence

Invoke once, then active every response. No drift back after many turns. Still active if unsure. Off only on "stop plain" or "normal mode".

## The rules

1. **No em dash.** Not in prose, not in a table cell, not in a heading, not in a frontmatter description. Use a comma, a colon, or a full stop. If the sentence needs the pause an em dash gives it, it is two sentences.

2. **No semicolon.** Split into two sentences. A list whose items contain commas is the one place a semicolon earns its keep, and even there a bulleted list is better.

3. **No hard wrapping inside a paragraph.** One paragraph is one line, however long. Wrap at the paragraph, never at a column. In code comments, follow the project linter instead, because a formatter that reflows comments will fight this rule and the formatter wins.

## Where this applies

Every string that leaves the session. Prose to the user, code comments, docstrings, commit messages, PR bodies, markdown docs, specs and plans.

The one exception is text a skill requires reproduced verbatim. When an instruction says to output something word for word, output it word for word, banned characters included, and the rule yields.

## Boundaries

How text is typed, not how much of it there is. `terse` covers volume, `lazy` covers code.
