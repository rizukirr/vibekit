---
name: wiki-dual
description: Use to capture, query, or maintain compound project knowledge — architecture notes, design decisions, patterns, debugging playbooks — that should outlive any single vibe run. File-backed under `.vibekit/wiki/` with keyword + tag search, `[[slug]]` cross-links, and a lint pass for orphans/staleness. Cross-runtime portable.
---

# wiki-dual

A persistent markdown knowledge base for **compound** project knowledge. Where `memory-dual` stores atomic facts (one fact per file), `wiki-dual` stores **documents** — multi-section pages with diagrams, edge cases, alternatives, cross-links.

Both surfaces are file-backed under `.vibekit/`. Both are cross-runtime portable. Use the right one:

| Knowledge shape | Surface |
|---|---|
| "test runner is vitest" | `memory-dual` |
| "the entire auth flow architecture, edge cases, and rejected alternatives" | `wiki-dual` |
| "user prefers single bundled PR" | `memory-dual` |
| "our domain model for billing — entities, invariants, lifecycle" | `wiki-dual` |
| "merge freeze 2026-Q2" | `memory-dual` |
| "post-mortem of the cache stampede incident" | `wiki-dual` |

If you're unsure, the test is **length**: < 1 paragraph + < 5 facts → memory; otherwise wiki.

## When to invoke

- The user wants to record an architecture decision, a design pattern in use, a debugging playbook, or an environment note that other contributors should read.
- A vibe run has produced a generalizable lesson (not a one-off finding) — propose a wiki page with `add`.
- A skill needs cross-feature context the conversation does not carry — `brainstorm-lean` step 1 is a natural caller.
- The user asks to query, read, list, lint, or delete project knowledge.

Do NOT invoke for:
- Per-feature design docs — those are `docs/specs/` artifacts produced by `brainstorm-lean`. Specs reference wiki; wiki distills patterns from many specs.
- Atomic facts — those are `memory-dual`.
- Code documentation — that lives in code comments and README files.

## File layout

```
.vibekit/
└── wiki/
    ├── index.md                  # auto-maintained catalog
    ├── log.md                    # append-only operation chronicle
    └── <slug>.md                 # one page per slug
```

`<slug>` is kebab-case, ≤60 chars, derived from the title: `auth-architecture`, `cache-stampede-postmortem-2026-q1`, `domain-model-billing`.

## Page format

```markdown
---
title: <human-readable title>
slug: <kebab-case>
category: architecture | decision | pattern | debugging | environment | session-log | reference | convention
tags: [<tag>, <tag>]
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: active | stale | superseded
supersedes: <slug, optional>
---

# <Title>

<body — multi-section markdown is fine. Use h2/h3 for structure.>

## See also
- [[<other-slug>]] — <one-line reason for the link>
```

The body is plain markdown. Use h2 for top-level sections. Use `[[slug]]` for cross-links. The trailing `## See also` section is optional but preferred when the page references other pages.

## Categories

Closed set. Pick one:

- `architecture` — how a subsystem fits together, components, data flow.
- `decision` — a choice and its rationale (often supersedes another decision).
- `pattern` — a repeatable approach used in multiple places.
- `debugging` — playbook for diagnosing a class of issue.
- `environment` — how to run/build/test/deploy.
- `session-log` — chronicle of a notable run or incident.
- `reference` — external-facing links, glossaries, contact tables.
- `convention` — coding/naming/process rules in force.

If a page does not fit any category, the page probably belongs in `memory-dual` or not in vibekit at all.

## Operations

### `add --title <T> --category <C> --tags <t1,t2> [--body @file | --body-stdin]`

Create a new page. Slug auto-derives from title (kebab-case, deduped against existing slugs by appending `-2`, `-3` if collision). Sets `created` and `updated` to today, `status: active`. Updates `index.md` and appends to `log.md`.

If a slug already exists with the same title, REJECT with the existing slug and suggest `update` or `supersede`.

### `update --slug <S> [--body @file | --body-stdin] [--tags ...] [--status ...]`

Modify an existing page. Updates `updated:` to today. Preserves `created:`. Body replaces previous body — never appends silently. Appends to `log.md` with the diff line count.

### `supersede --old <slug> --new <slug>`

Mark `<old>` with `status: superseded` and `supersedes: <new>` is set on `<new>`. Both pages stay on disk; nothing is deleted. Lint will hide superseded pages from default queries unless `--include-superseded` is passed.

### `query --text <T> [--tags <list>] [--category <C>] [--include-superseded]`

Match against all `status: active` pages by default. Matching is keyword + tag + category — **no vector embeddings**, no fuzzy. Returns:

```yaml
hits:
  - slug: <slug>
    title: <title>
    category: <category>
    snippet: <first matching line, verbatim>
    score: <integer; tag matches weighted higher than body>
```

The caller synthesizes an answer with `[[slug]]` citations from the hits. The skill never paraphrases page bodies into the answer — it returns hits and the caller reads pages it cares about.

### `read --slug <S>`

Return the page contents verbatim. If the slug does not exist, return `not found` and three closest slugs from index. Never guess.

### `list [--category <C>] [--tags <list>] [--include-superseded]`

Read `index.md` and filter. Returns slug + title + category + updated date. The full body is not loaded.

### `delete --slug <S> --reason <R>`

Hard delete. The skill REJECTS unless `--reason` is given. Logged in `log.md` with the reason verbatim. Cross-references to the deleted slug are NOT auto-updated; they show as broken on the next `lint` and the user fixes them. Default to `supersede` over `delete`.

### `lint`

Health check. Reports without modifying:

```yaml
broken_links: [{from: <slug>, to: <slug>, line: <n>}]
orphans: [<slug>]                   # active pages with no inbound [[link]] from any other active page
stale: [<slug>]                     # status: active and updated > 180 days ago
oversized: [<slug>]                 # body > 500 lines (consider splitting)
superseded_with_active_inbound: [<slug>]  # superseded but still linked from active pages
contradictions: [{a: <slug>, b: <slug>, hint: <string>}]   # heuristic; manual review required
category_outliers: [<slug>]         # category mismatched against tags/title heuristic
```

Lint is read-only. It never modifies pages.

### `refresh`

Rebuild `index.md` from disk. Use after manual edits to wiki files (e.g., the user edited a `.md` directly without going through this skill). Logs the diff.

## Cross-references

`[[<slug>]]` is the only cross-link syntax. Plain markdown links (`[text](path)`) are also fine for external URLs but do not count as wiki cross-references.

`[[<slug>]]` must resolve to an existing page. `lint` flags broken links. The skill never auto-creates missing target pages — that path leads to junk pages.

## Auto-capture (off by default)

Some sources auto-capture session-end findings as `session-log` pages. **vibekit-dual does not.** Auto-capture is the most common path to wiki rot: discoveries get logged that nobody will ever search for, and the signal-to-noise ratio collapses.

If a vibe run produces a generalizable lesson, the calling skill (typically `review-pack` after sign-off) should explicitly propose `wiki add --category session-log ...` and the user approves the title and tags. Manual capture, manual approval.

## Discipline rules

These join the never-compress list. Compress narration around them; never the rules themselves.

- **Compound knowledge only.** Atomic facts go to `memory-dual`. If a page would be < 1 paragraph, it does not belong here.
- **Keyword + tag matching only.** No embeddings, no fuzzy, no LLM-side reranking. Determinism beats cleverness for project knowledge.
- **Page bodies are verbatim.** Skill output for `read` and `query` snippets is byte-identical to disk content.
- **Never auto-delete; never auto-supersede; never auto-stale.** Status changes require an explicit operation.
- **Default to `supersede`, not `delete`.** Project history matters; wiki rot is preferable to silent deletion of decisions.
- **Closed category set.** Adding a category is a deliberate decision, not a per-page expedient. Free-tagging happens via `tags`, not `category`.
- **No autoload.** The skill runs only when invoked. Each runtime can opt-in to autoload `index.md` by adding `@./.vibekit/wiki/index.md` to its own entry doc.

## Karpathy alignment

- **Surgical Changes.** Each operation modifies exactly one page (plus index + log). Never bulk-edit. `update` replaces a body wholesale; never appends silently.
- **Simplicity First.** Plain markdown files. No DB, no daemon, no embeddings. The whole wiki is `git diff`-able.
- **Goal-Driven.** Every operation has a checkable success criterion (page exists with expected frontmatter; index has the row; lint has no broken links the operation introduced).
- **Think Before Coding.** `add` REJECTS on title/slug collision. `delete` REJECTS without `--reason`. The skill challenges every write that risks rotting the surface.

## Compression policy

| Region | Policy |
|---|---|
| Operation announcements ("Page added: <slug>.") | Compress |
| Frontmatter values | Verbatim |
| Page bodies | Verbatim |
| Query hits / snippets | Verbatim |
| Lint reports | Verbatim YAML |
| `delete --reason` text | Verbatim in `log.md` |
| Cross-link syntax `[[slug]]` | Verbatim, never paraphrased |

## Pipeline integration (opt-in references)

Other skills MAY invoke wiki-dual but are not required to:

- `brainstorm-lean` step 1 — `query` for prior architecture/decision pages in the relevant domain. Surface 1-3 hits before asking clarifying questions.
- `review-pack` after sign-off — for runs that produced architecture-level decisions or new patterns, propose `wiki add` with the proposed title, category, tags. User approves before write.
- `verify-gate` — does NOT write. Verification is not knowledge capture.
- `memory-dual` `classify` — when a finding is too compound for memory, propose redirect to `wiki-dual add`.

## Cross-runtime portability

All operations are file I/O under `.vibekit/wiki/`. Verified portable to:

- **Claude Code** — auto-discovers via `.claude-plugin/plugin.json`.
- **Codex** — auto-discovers via `.codex-plugin/plugin.json`.
- **Gemini CLI** — referenced from `GEMINI.md` via `@./skills/wiki-dual/SKILL.md`.
- **opencode** — auto-discovers via `.opencode/plugins/vibekit.js` (skills directory scan).

No runtime-specific shim. No capability gate. No degradation.

## Anti-patterns

- Storing every session finding as a session-log. Wiki rot kills the surface; capture only what generalizes.
- Using wiki for atomic facts. That is `memory-dual`.
- Using wiki for per-feature design docs. Those are `docs/specs/`.
- Inventing categories ad-hoc. The set is closed; if a page does not fit, reconsider whether it belongs at all.
- Renaming a slug to "fix" a link. Slugs are stable identifiers; the right move is `supersede`.
- Cross-linking to a page you have not read. `[[slug]]` is a claim that the linked page is relevant; verify before writing.
- Hand-editing `index.md`. Run `refresh` instead.

## Output of this skill

For read-class operations: the requested content, verbatim, with no narration.
For write-class operations: a single short line — `Page added: <slug>.` or `Updated <slug> (<+a>/<-r> lines).`
For `query`, `list`, `lint`: the YAML structure exactly as specified above.
For `delete`: `Deleted <slug>. Reason: <verbatim>.`

No structured return value beyond what is documented per operation. The skill is file-producing and user-facing.
