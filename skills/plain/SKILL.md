---
name: plain
description: Use before writing any text, in chat or into a file. Thirteen rules that hold in every string you emit, including code comments, commit messages, PR bodies and docs. No em dash, no semicolon, no hard wrapping inside a paragraph, no curly quotes, no decorative emoji, no title case in headings, no bold label lists, no heading echo, no fragment runs, no padded triads, no rejected straw options, no unraised objections, no writing about the previous version. Stays on after.
trigger: Before the first text of the session is written, whether prose or a file, invoke once, then it stays on
gate: none
---

# plain

Thirteen rules about how text is typed and shaped. They hold everywhere, with no exception for artifacts.

## Persistence

Invoke once, then active every response. No drift back after many turns. Still active if unsure. Off only on "stop plain" or "normal mode".

## The rules

### Typography

1. **No em dash.** No en dash either, no spaced dash such as ` - ` used as one, no double hyphen. Not in prose, not in a table cell, not in a heading, not in a frontmatter description. Use a comma, a colon, or a full stop. If the sentence needs the pause an em dash gives it, it is two sentences.

2. **No semicolon.** Split into two sentences. A list whose items contain commas is the one place a semicolon earns its keep, and even there a bulleted list is better.

3. **No hard wrapping inside a paragraph.** One paragraph is one line, however long. Wrap at the paragraph, never at a column. In code comments, follow the project linter instead, because a formatter that reflows comments will fight this rule and the formatter wins.

4. **No curly quotes.** Straight quotes only, for both double and single marks, and a straight apostrophe. A curly mark is what a word processor produces, not what a terminal, a diff or a code file wants.

5. **No decorative emoji.** Not at the start of a heading, not at the start of a list item, not as a status marker in prose. An emoji the user asked for is not decoration and stays.

6. **Sentence case in headings.** Capitalise the first word and any proper noun. Not every main word.

### Shape

7. **No bold label lists.** A list where every item opens with a bold phrase and a colon is a table pretending to be prose. Write the prose, or write an actual table.

8. **No heading echo.** The sentence after a heading must not restate the heading. Delete it and start with the content.

9. **No fragment runs.** One short sentence for emphasis is fine. Three or more clipped fragments in a row is a drum roll, and it reads as performance rather than information.

10. **No padded triads.** Use the number of items the meaning has. Two is a fine list. Four is a fine list. Reaching for a third item because three sounds complete is how a real point gets a filler sibling.

### Drafting residue

11. **No rejected straw options.** Do not raise an option nobody proposed in order to dismiss it in the same clause. State the constraint directly.

12. **No unraised objections.** Do not answer a challenge the text never made. "To be clear, this is not about X" belongs in a reply to someone who said X.

13. **No writing about the previous version.** Describe what the code does now. Prior behaviour belongs in a changelog, a migration note, a release note, a root cause, or a commit message.

## Not a tell by itself

Rules 7 through 13 are judgment calls, and each has a legitimate form that must survive.

Three items are fine when there are three things. The tell is padding to reach three.

One short sentence for emphasis is fine. The tell is a run of them.

A heading followed by a definition is fine. The tell is a restatement.

An alternative is fine when it is weighed and its trade-offs are given. The tell is one raised and dropped in the same clause. `brainstorm` requires two or three approaches with trade-offs and an Alternatives considered section, and rule 11 never overrides that.

Prior behaviour is fine in a changelog, a migration note, a release note, a root cause or a commit message. The tell is it appearing in a description of current behaviour. `debug` produces root causes and `exec` writes commit messages, and rule 13 never overrides either.

## Where this applies

Every string that leaves the session. Prose to the user, code comments, docstrings, commit messages, PR bodies, markdown docs, specs and plans.

The one exception is text a skill requires reproduced verbatim. When an instruction says to output something word for word, output it word for word, banned characters included, and the rule yields.

## Boundaries

How text is typed and shaped, not how much of it there is. `terse` covers volume, `lazy` covers code.
