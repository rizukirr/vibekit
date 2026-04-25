---
name: memory-dual
description: Use to store, recall, query, or audit durable project knowledge — atomic facts and compound documents alike — plus a working notepad that survives conversation compaction. One skill, one storage convention, file-backed under `.vibekit/`. Cross-runtime portable.
---

# memory-dual

The single durable-knowledge surface for vibekit. Two file-backed regions under `.vibekit/`:

- **Entries** — keyed knowledge, one file per key. Spans atomic facts ("test runner is vitest") and compound documents ("the entire auth flow architecture, edge cases, and rejected alternatives") under one storage convention. The shape of an entry is signaled by its `type:` frontmatter, not by which directory it lives in.
- **Notepad** — three short-lived sections (Priority / Working / Manual) for context that should survive conversation compaction within a session.

A single append-only `log.md` chronicles all writes. An auto-maintained `INDEX.md` catalogs every entry.

All four CLIs (Claude Code, Codex, Gemini, opencode) read and write the same files identically. No database, no daemon, no runtime API.

## When to invoke

- The user asks to remember, recall, save, note, pin, query, or audit project knowledge.
- A vibe run produces a finding that should outlive the run (a project convention, a deadline, a stakeholder ask, a non-obvious gotcha, an architecture decision, a session-log).
- A skill needs project context the current conversation does not carry (`brainstorm-lean` step 1, `brief-compiler` CONTEXT enrichment).
- The user asks to lint, prune, or clean memory.

Do NOT invoke for:
- Information already in code, git history, or the spec/plan files. Those are authoritative.
- Per-feature design docs — those are `docs/specs/` artifacts produced by `brainstorm-lean`. Specs reference memory; memory distills patterns from many specs.
- Code documentation — that lives in code comments and READMEs.
- Ephemeral conversation state inside a single turn.

## File layout

```
.vibekit/
├── memory/
│   ├── INDEX.md              # auto-maintained catalog
│   ├── log.md                # append-only operation chronicle
│   └── <key>.md              # one file per key, frontmatter + body
└── notepad.md                # single file, three sections
```

`<key>` is kebab-case, ≤60 chars, descriptive: `test-runner`, `auth-architecture`, `cache-stampede-postmortem-2026-q1`, `merge-freeze-2026-q2`.

## Entry format

Every entry has this exact frontmatter, then a markdown body:

```markdown
---
key: <kebab-case>
type: convention | decision | preference | gotcha | contact | deadline | architecture | pattern | debugging | environment | session-log | reference
tags: [<tag>, <tag>]
created: YYYY-MM-DD
updated: YYYY-MM-DD
status: active | stale | superseded
supersedes: <key, optional>
confidence: high | medium | low
---

# <Title>

<body — single paragraph for atomic facts; multi-section markdown for compound documents.
Use h2/h3 for structure when the body has more than one section.>

## See also
- [[<other-key>]] — <one-line reason for the link>
```

Atomic vs compound is signaled by length and structure, not by separate storage. A `convention: test runner is vitest` is one paragraph. An `architecture: auth flow` may be a multi-section document with cross-links. Both are entries.

`confidence: low` means the entry is a best guess — surface it but flag it. `confidence: high` means the user confirmed or the codebase verifies it.

## Type vocabulary (closed set)

Pick exactly one. If a finding does not fit any type, it probably does not belong in memory:

- `convention` — coding/naming/process rules in force.
- `decision` — a choice and its rationale (often supersedes another).
- `preference` — user/team operational preference.
- `gotcha` — non-obvious pitfall.
- `contact` — person, team, or service reference.
- `deadline` — time-bound fact.
- `architecture` — how a subsystem fits together (compound).
- `pattern` — a repeatable approach used in multiple places (compound).
- `debugging` — playbook for diagnosing a class of issue.
- `environment` — how to run/build/test/deploy.
- `session-log` — chronicle of a notable run or incident.
- `reference` — external links, glossaries.

Adding a new type is a deliberate decision that updates this list, not a per-entry expedient. Free-tagging happens via `tags`, not `type`.

## Cross-references

`[[<key>]]` is the cross-link syntax for any entry. Plain markdown links (`[text](url)`) are also fine for external URLs but do not count as cross-references.

`[[<key>]]` must resolve to an existing entry. `audit` flags broken links. The skill never auto-creates missing target entries — that path leads to junk.

## Notepad format

Single file, three sections, fixed headings. The skill writes/edits within sections; never reorders them.

```markdown
# Vibekit Notepad

## Priority Context
<HARD LIMIT 500 chars total. Critical facts the next turns need. Bullet list.>

## Working Memory
- [YYYY-MM-DDTHH:MMZ] <one-line breadcrumb>
- ...

## Manual
<user-controlled, free-form, never auto-pruned>
```

Working Memory entries older than 7 days are pruned on `audit`. Priority and Manual are never auto-pruned.

## Operations

### `read --key <K>`
Return the entry contents verbatim. If the key does not exist, return `not found` with three closest keys from INDEX. Never guess.

### `query --text <T> [--tags <list>] [--type <T>] [--include-superseded]`
Match against `status: active` entries by default. Matching is keyword + tag + type — **no vector embeddings**, no fuzzy. Returns:

```yaml
hits:
  - key: <key>
    type: <type>
    snippet: <first matching line, verbatim>
    score: <integer; tag/type matches weighted higher than body>
```

The caller synthesizes an answer with `[[key]]` citations. The skill never paraphrases bodies into the answer — it returns hits and the caller reads entries it cares about.

### `list [--type <T>] [--tags <list>] [--include-superseded]`
Read INDEX.md and filter. Returns key + title + type + updated date. Bodies are not loaded.

### `read --notepad [--section priority|working|manual]`
Return the full notepad, or the named section verbatim.

### `write --key <K> --type <T> --confidence <C> [--tags <list>] [--body @file | --body-stdin]`
Create or update `.vibekit/memory/<K>.md`. If the key exists, update `updated:` and replace the body wholesale; never append silently. Preserve `created:` on update. Update INDEX.md. Append a one-line entry to `log.md`.

If a different key exists with the same body content (heuristic: identical first line + ≥80% body overlap), REJECT and propose `update` or `supersede`.

### `write --notepad --priority <text>`
Append `<text>` to Priority Context. After append, count chars. If total >500, REJECT with the diff between current and limit; do not truncate silently.

### `write --notepad --working <text>`
Prepend a timestamped bullet to Working Memory: `- [YYYY-MM-DDTHH:MMZ] <text>`.

### `write --notepad --manual <text>`
Append to Manual section verbatim.

### `supersede --old <K> --new <K>`
Mark `<old>` with `status: superseded`. Set `supersedes: <new>` on `<new>`. Both stay on disk; nothing is deleted. `query` hides superseded entries by default unless `--include-superseded`.

### `delete --key <K> --reason <R>`
Hard delete. REJECT unless `--reason` is given. Logged in `log.md` with the reason verbatim. Cross-references to the deleted key are NOT auto-updated; they show as broken on the next `audit` and the user fixes them. **Default to `supersede` over `delete`** — project history matters.

### `classify <finding>`
Given a free-text finding from a session, decide the right destination. Output:

```yaml
finding: "<verbatim quote>"
proposed:
  surface: entry | notepad-priority | notepad-working | notepad-manual | none
  key: <key if entry>
  type: <type if entry>
  tags: [<tag>, ...]
  confidence: <low|medium|high>
  reason: <one line>
```

`surface: none` is correct when the finding is a code fact (lives in code), a spec fact (lives in `docs/specs/`), or already-known (already in INDEX). Default to `none` unless the finding is durable, reusable, and not derivable from the code. Do not write everywhere — that is the dump anti-pattern.

### `audit`
1. Prune Working Memory entries with timestamps >7 days old.
2. Flag entries with `confidence: low` and `updated:` >30 days old as candidates for review.
3. Flag entries with `status: active` and `updated:` >180 days old as `stale`.
4. Diff INDEX.md against actual files; rebuild INDEX if drift detected.
5. Detect duplicates (case-insensitive key collision; near-identical body content).
6. Validate every `[[key]]` cross-link resolves; report broken links per source key.
7. Flag entries whose body exceeds 500 lines as `oversized` (consider splitting).
8. Flag `superseded` entries still linked from `active` entries.

Output:

```yaml
pruned_working: <count>
stale_low_confidence: [<key>, ...]
stale: [<key>, ...]
index_rebuilt: <bool>
duplicates: [{a: <key>, b: <key>, reason: <string>}]
broken_links: [{from: <key>, to: <key>, line: <n>}]
oversized: [<key>, ...]
superseded_with_active_inbound: [<key>, ...]
```

Audit is read-mostly. The only writes are the prune + INDEX rebuild. Never delete an entry without explicit user instruction.

## Discipline rules

These join the never-compress list. Compress narration around them; never the rules themselves.

- **One file per key.** Do not concatenate unrelated facts.
- **Do not dump.** Most session findings should NOT be stored. Default `classify` verdict is `surface: none`. Memory rots when overfilled.
- **Mark uncertainty.** No user confirmation or codebase evidence → `confidence: low`. Lying about confidence destroys the surface.
- **Bodies are verbatim.** Caveman compression applies to skill narration ("Stored.", "Found 3 candidates."), never to entry bodies.
- **Keyword + tag + type matching only.** No embeddings, no fuzzy, no LLM-side reranking. Determinism beats cleverness for project knowledge.
- **Default to `supersede` over `delete`.** Project history matters; rot is preferable to silent deletion of decisions.
- **Closed type set.** Adding a type updates this skill, not a single entry.
- **Priority Context is small.** 500 chars is a hard limit, not a soft one. If a fact does not fit, it belongs as an entry, not in Priority.
- **Notepad Working entries are bullets, not paragraphs.** If you need a paragraph, write an entry.
- **No auto-capture.** No skill silently drops findings into memory at session end. `review-pack` may PROPOSE a `write` after sign-off; the user approves.
- **No autoload at session start.** The skill runs only when invoked. Each runtime can opt-in by adding `@./.vibekit/notepad.md` or `@./.vibekit/memory/INDEX.md` to its own entry doc — that is the runtime owner's choice, not this skill's responsibility.

## Karpathy alignment

- **Surgical Changes.** Operations touch only the named file/section. `write` writes one entry + INDEX + log. `write --notepad --working` prepends one bullet. No drive-by reorganization.
- **Simplicity First.** Plain files. No DB, no daemon, no embeddings, no schema migrations. The whole memory is `git diff`-able.
- **Goal-Driven.** Every operation has a checkable success criterion (file exists with expected content; INDEX has the row; char count under limit; cross-link resolves).
- **Think Before Coding.** `classify` defaults to `surface: none`. `delete` REJECTS without `--reason`. The skill challenges every write that risks rotting the surface.

## Compression policy

| Region | Policy |
|---|---|
| Operation announcements ("Stored.", "Pruned 2 entries.") | Compress |
| Frontmatter values | Verbatim |
| Entry bodies | Verbatim |
| Query hits / snippets | Verbatim |
| Notepad Priority Context | Verbatim, hard 500-char limit |
| `classify` reasons | One terse line |
| Audit YAML report | Verbatim |
| `delete --reason` text | Verbatim in `log.md` |
| Cross-link syntax `[[key]]` | Verbatim, never paraphrased |
| Confidence flags / uncertainty markers | Verbatim |

## Pipeline integration (opt-in references)

Other skills MAY invoke memory-dual but are not required to:

- `brainstorm-lean` step 1 — `query` for prior decisions/architecture in the relevant domain. Surface 1-3 hits before asking clarifying questions.
- `brief-compiler` — pull entries cited by the user into the CONTEXT block (verbatim; no compression).
- `review-pack` after sign-off — propose a `classify` pass on findings; with user approval, propose `write` for entries that generalize.
- `verify-gate` — does NOT write. Verification is not knowledge capture.

These are suggestions, not hard wires. Each calling skill decides whether the round-trip is worth the tokens.

## Cross-runtime portability

All operations are file I/O under `.vibekit/`. Verified portable to:

- **Claude Code** — auto-discovers via `.claude-plugin/plugin.json`.
- **Codex** — auto-discovers via `.codex-plugin/plugin.json`.
- **Gemini CLI** — referenced from `GEMINI.md` via `@./skills/memory-dual/SKILL.md`.
- **opencode** — auto-discovers via `.opencode/plugins/vibekit.js` (skills directory scan).

No runtime-specific shim. No capability gate. No degradation.

## Anti-patterns

- Storing a code fact ("the auth middleware is in src/auth/middleware.ts"). Codebase already says this. Keep memory for what the code cannot.
- Storing every session finding "just in case." Memory rots when overfilled.
- Editing Priority Context past 500 chars by trimming an unrelated bullet. Reject the write; let the user choose what to keep.
- Writing one giant entry with 50 unrelated facts. One file per key.
- Marking `confidence: high` on a guess. The whole surface depends on this honesty.
- Inventing types ad-hoc. The set is closed; if an entry does not fit, reconsider whether it belongs at all.
- Renaming a key to "fix" a cross-link. Keys are stable identifiers; the right move is `supersede`.
- Cross-linking to an entry you have not read. `[[key]]` is a claim that the linked entry is relevant; verify before writing.
- Hand-editing `INDEX.md`. Run `audit` instead.
- Auto-loading the notepad on every session start without user opt-in. Bloats every conversation.

## Output of this skill

For read-class operations: the requested content, verbatim, with no narration.
For write-class operations: a single short line — `Stored: <key>.` or `Notepad priority updated (412/500 chars).` or `Updated <key> (+a/-r lines).`
For `classify`: the YAML block exactly as specified above.
For `query`, `list`, `audit`: the YAML structure exactly as specified above.
For `delete`: `Deleted <key>. Reason: <verbatim>.`

No structured return value beyond what is documented per operation. The skill is file-producing and user-facing.
