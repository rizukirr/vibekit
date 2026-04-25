---
name: memory-dual
description: Use to store, recall, or audit durable project knowledge and short-lived working notes that survive across vibe runs. Two surfaces — durable Memory (one file per key) and a Notepad with Priority/Working/Manual sections — both backed by plain files under `.vibekit/`. Cross-runtime portable; no autoload (callers ask explicitly).
---

# memory-dual

Two file-backed surfaces for context that should outlive a single conversation:

- **Memory** — durable project knowledge. One file per key. Survives forever until explicitly removed.
- **Notepad** — three short-lived sections (Priority / Working / Manual) for context that should survive conversation compaction within a session.

Both surfaces are **plain files** under `.vibekit/` at the repo root. No database, no daemon, no runtime API. All four CLIs (Claude Code, Codex, Gemini, opencode) read and write the same files identically.

## When to invoke

- The user asks to remember, recall, save, note, or pin something.
- A vibe run produces a finding that should outlive the run (a project convention, a deadline, a stakeholder ask, a non-obvious gotcha).
- A skill needs project context the current conversation does not carry (`brainstorm-lean` step 1, `brief-compiler` CONTEXT enrichment).
- The user asks to audit, prune, or clean memory.

Do NOT invoke for:
- Information already in code, git history, or the spec/plan files. Those are authoritative; memory is for what the codebase cannot tell you.
- Ephemeral conversation state inside a single turn — that is not memory's job.

## File layout

```
.vibekit/
├── memory/
│   ├── INDEX.md                  # auto-maintained list of keys + 1-line descriptions
│   └── <key>.md                  # one entry per key, frontmatter + body
└── notepad.md                    # single file, three sections
```

`<key>` is kebab-case, ≤40 chars, descriptive: `test-runner`, `merge-freeze-2026-q2`, `prefers-bundled-prs`.

## Memory entry format

Every memory file has this exact frontmatter, then a body:

```markdown
---
key: <kebab-case>
type: convention | decision | preference | gotcha | contact | deadline
scope: project          # always project for v1; user/global reserved
created: YYYY-MM-DD
updated: YYYY-MM-DD
confidence: high | medium | low
---

<one or more paragraphs of plain prose. The body is never compressed.>
```

`confidence: low` means the entry is a best guess — surface it but flag it. `confidence: high` means the user confirmed or the codebase verifies it.

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

### `read --memory <key>`
Return the file contents verbatim. If the key does not exist, return `not found` (do not guess a similar key — list candidates from INDEX instead).

### `read --memory --search <text>`
Grep INDEX.md descriptions and entry bodies for `<text>`. Return matching keys + 1-line descriptions. Caller decides which to read in full.

### `read --notepad [--section priority|working|manual]`
Return the full notepad, or the named section verbatim.

### `write --memory <key> --type <T> --confidence <C>`
Create or update `.vibekit/memory/<key>.md`. If the key exists, update `updated:` and replace the body. If it does not, create the file and add a one-line entry to `INDEX.md`. Always preserve `created:` on update.

### `write --notepad --priority <text>`
Append `<text>` to the Priority Context section. After append, count chars. If total >500, REJECT with the diff between current and limit; do not truncate silently.

### `write --notepad --working <text>`
Prepend a timestamped bullet to Working Memory. Format: `- [YYYY-MM-DDTHH:MMZ] <text>`.

### `write --notepad --manual <text>`
Append to Manual section verbatim.

### `classify <finding>`
Given a free-text finding from a session, decide the right surface and propose the entry. Output:

```yaml
finding: "<verbatim quote>"
proposed:
  surface: memory | notepad-priority | notepad-working | notepad-manual | none
  key: <key if memory>
  type: <type if memory>
  confidence: <low|medium|high>
  reason: <one line>
```

`surface: none` is correct when the finding is a code fact (lives in code), a spec fact (lives in `docs/specs/`), or already-known (already in INDEX). Do not write everywhere; that is the dump anti-pattern.

### `audit`
1. Prune Working Memory entries with timestamps >7 days old.
2. Scan all memory entries; flag entries with `confidence: low` and `updated:` >30 days old as candidates for review.
3. Diff INDEX.md against actual files; rebuild INDEX if drift detected.
4. Look for duplicate keys (case-insensitive collision) and duplicate body content.
5. Output a report:

```yaml
pruned_working: <count>
stale_low_confidence: [<key>, ...]
index_rebuilt: <bool>
duplicates: [{a: <key>, b: <key>, reason: <string>}]
```

Audit is read-mostly; the only write is the prune + INDEX rebuild. Never delete a memory entry without explicit user instruction.

## Discipline rules

These join the never-compress list. Compress narration around them; never the rules themselves.

- **One file per key.** Do not concatenate multiple unrelated facts into one entry.
- **Do not dump.** Most session findings should NOT be stored. Default `classify` verdict is `surface: none` unless the finding is durable, reusable, and not derivable from the code.
- **Mark uncertainty.** If you cannot point to user confirmation or codebase evidence, write `confidence: low`. Lying about confidence destroys the value of the surface.
- **Bodies are verbatim.** Caveman compression applies to skill narration ("Stored.", "Found 3 candidates."), never to entry bodies.
- **Priority Context is small.** 500 chars is a hard limit, not a soft one. If a fact does not fit, it belongs in Memory, not Priority.
- **Notepad Working entries are bullets, not paragraphs.** If you need a paragraph, it is durable Memory.
- **Never autoload at session start.** The skill runs only when invoked. Each runtime can opt-in to autoload by adding `@./.vibekit/notepad.md` to its own entry doc — that is the runtime owner's choice, not this skill's responsibility.

## Karpathy alignment

- **Surgical Changes.** Operations touch only the named file/section. `write --memory <key>` writes one file. `write --notepad --working` prepends one bullet. No drive-by reorganization.
- **Simplicity First.** Plain files, no schema migrations, no daemons, no indexes besides INDEX.md. If you cannot diff the storage with `git diff`, the design is wrong.
- **Goal-Driven.** Every operation has a checkable success criterion (file exists with expected content; INDEX has the entry; char count under limit).
- **Think Before Coding.** `classify` defaults to `surface: none`. The skill challenges the framing that "this finding should be stored" before writing anything.

## Compression policy

| Region | Policy |
|---|---|
| Operation announcements ("Stored.", "Pruned 2 entries.") | Compress |
| Frontmatter values | Verbatim |
| Entry bodies | Verbatim |
| Notepad Priority Context | Verbatim, hard 500-char limit |
| `classify` reasons | One terse line |
| Audit report | Verbatim YAML |
| Confidence flags and uncertainty markers | Verbatim |

## Pipeline integration (opt-in references)

Other skills MAY invoke memory-dual but are not required to:

- `brainstorm-lean` step 1 — read INDEX, surface relevant prior decisions before asking clarifying questions.
- `brief-compiler` — pull memory entries cited by the user into the CONTEXT block (verbatim; no compression).
- `review-pack` after sign-off — propose a `classify` pass on findings from the run.

These are suggestions, not hard wires. Each calling skill decides whether the round-trip is worth the tokens.

## Cross-runtime portability

All operations are file I/O under `.vibekit/`. Verified portable to:

- **Claude Code** — auto-discovers via `.claude-plugin/plugin.json`.
- **Codex** — referenced from `AGENTS.md` skill table.
- **Gemini CLI** — referenced from `GEMINI.md` via `@./skills/memory-dual/SKILL.md`.
- **opencode** — auto-discovered via `.opencode/plugins/vibekit.js` (skills directory scan).

No runtime-specific shim. No capability gate. No degradation.

## Anti-patterns

- Storing a code fact ("the auth middleware is in src/auth/middleware.ts"). Codebase already says this. Keep memory for what the code cannot.
- Storing every session finding "just in case." Memory rots when overfilled.
- Editing Priority Context past 500 chars by trimming an unrelated bullet. Reject the write; let the user choose what to keep.
- Writing one giant memory file with 50 facts. One file per key.
- Marking `confidence: high` on a guess. The whole surface depends on this honesty.
- Auto-loading the notepad on every session start without user opt-in. Bloats every conversation.

## Output of this skill

For read operations: the requested content, verbatim, with no narration.
For write operations: a single short line — `Stored memory:<key>.` or `Notepad priority updated (412/500 chars).`
For classify: the YAML block exactly as specified above.
For audit: the YAML report exactly as specified above.

No structured return value beyond what is documented per operation. The skill is file-producing and user-facing.
