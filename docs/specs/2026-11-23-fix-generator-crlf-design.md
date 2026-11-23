---
title: fix generator crlf
date: 2026-11-23
status: approved
---

# fix generator crlf: Design

## Problem

Failure: npm run check, exit 1:

```
generated files are out of date:
  stale: package.json
  stale: .claude-plugin/plugin.json
  stale: .claude-plugin/marketplace.json
  stale: .codex-plugin/plugin.json
  stale: .agents/plugins/marketplace.json
  stale: commands/quick.toml
  stale: commands/repl.toml
  stale: commands/retro.toml
  stale: commands/vibe.toml
  stale: plugin.json
  stale: .vibekit-manifest
  orphan: (all 20 manifest entries, hooks/hooks.json among them)
run: npm run generate
```

node --test tests/build.test.mjs fails "assembles every generated path and reports no drift on a clean tree" (tests/build.test.mjs:60): AssertionError: clean tree must report no stale files. Branch fix/quick-modifier-step at c2e6b1b, edits to skills/quick/SKILL.md uncommitted, windows-test-results.md untracked.

Repro: npm run check, 2 of 2 runs exit 1.

Isolated: conditions. The same commit in a fresh worktree (0 CRLF files), with and without the quick edit: check exit 0, build.test exit 0. This checkout predates .gitattributes and still has 64 files checked out with CRLF.

## Goals

1. The guard test named in the report fails at BASE and passes at HEAD.
2. The failing command from Failure exits 0 at HEAD.
3. The full test suite passes at HEAD.

## Non-goals

No behaviour change other than the one the cause names.

## Constraints

- Run limits: at most 3 verify rounds, at most $0 on paid runs
- No interface change.

## Approach

Cause: the generator's check assumes LF on disk. lib/build.mjs:72 compares the raw text read at lib/build.mjs:84 with the LF output, so a CRLF generated file counts as stale. lib/build.mjs:115 splits .vibekit-manifest on "\n" only, so every entry keeps a "\r", matches no emitted path and is reported as an orphan.

Refuted: one dispatch, CONFIRMED. All 11 stale files equal the generator's output once "\r\n" becomes "\n". The first manifest entry is ".agents/plugins/marketplace.json\r", and all 20 orphans end in "\r". No LF file is stale. With a reader that drops "\r": write [] and remove [].

## Alternatives considered

N/A: a diagnosis, not a design. The refuter's result is under Approach.

## Testing

Guard: a test in tests/build.test.mjs that builds from a tree whose generated files and manifest are CRLF copies of the generator's output, and expects no stale file and no orphan. It fails today with the same lists.

## Open questions

N/A: the report was approved as written.
