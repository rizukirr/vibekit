# Review — vibekit v2 architecture

**Date:** 2026-08-03
**Spec:** docs/specs/2026-08-03-vibekit-v2-architecture-design.md
**Plan:** docs/plans/2026-08-03-vibekit-v2-architecture.md
**Verify report:** docs/verifications/2026-08-03-vibekit-v2-architecture-verify.md (verdict `ready`)
**Commits under review:** 022af09..c651fdd on `vibekit-v2-architecture`

## Diff summary

- Files changed: 42
- Lines added: 1673, removed: 84
- Commits: 25
- Hand-written source (excluding tests, generated output, docs): **499 lines**

## Findings

### Block

**B1. `lib/table.mjs:8` — table cell values are interpolated without escaping `|`, silently corrupting the trigger table.**

```js
...skills.map(skill => `| ${skill.trigger} | \`${skill.name}\` | ${skill.gate} |`),
```

The authoring contract documented in the spec permits any string in `trigger`
and `description`. A pipe character in either produces a malformed row. Verified
by probe — a skill with `trigger: When A | B happens` generated:

```
| Trigger condition | Skill | Gate |
|---|---|---|
| When A | B happens | `probe-hostile` | none |
```

Four columns where the header declares three. The failure is **silent**:
`npm run check` reports `up to date` (the committed output matches what the
generator produced) and all 60 tests pass, because every test uses fixture
strings that happen to contain no pipes.

Why this blocks rather than warns: the corrupted artifact is the auto-trigger
map — the document that determines when skills fire — and the implementation
diverges from the authoring contract the spec publishes. It is also near-certain
to be hit. Spec 2 authors real trigger prose, and conditions like
`verify-gate returns not satisfied | partial` are a natural phrasing.

Fix is small: escape `|` as `\|` in cell values in `lib/table.mjs`, plus a test
using a pipe-bearing fixture. `skillList` is unaffected (not a table) but the
same input should be covered.

### Warn

**W1. `docs/specs/2026-08-03-vibekit-v2-architecture-design.md:42` — the spec was edited mid-run to match what was built.**

The R1 goal was reworded after implementation because three verification passes
found the original sentence overclaimed. The change was explicitly authorized by
the user and is recorded in the verification report. Flagging it anyway: editing
the contract to match the code is the exact pattern the pipeline exists to
prevent, and it should be visible in the history rather than buried. The
substance here is defensible — the design was right and the sentence was wrong —
but a reader of the spec alone cannot tell that.

**W2. `bin/generate.mjs:17-24` — the orchestration has no unit test.**

```js
const { emitters, model } = await build(ROOT)
const { files, owner } = mergeEmitters(emitters, model)
applyRegions(emitters, model, files, owner, io)

const previous = (io.read(MANIFEST) ?? '').split('\n').filter(Boolean)
files[MANIFEST] = `${Object.keys(files).sort().join('\n')}\n`
```

Every function it calls is unit-tested; the sequencing between them is covered
only end-to-end. This is precisely where N1 (below) lives — a line-ordering
quirk that no unit test could have caught because no unit test reaches this
code. `lib/build.mjs` is named for building but returns `{emitters, model}` and
leaves assembly to the CLI; moving the assembly into `build()` would put it
under test and thin the CLI to argument parsing and I/O.

**W3. `runtimes/codex.mjs` — the Codex output shape is unvalidated against a real Codex install.**

`.codex-plugin/plugin.json` and `commands/*.toml` were modeled on the v1 package
that shipped, not on Codex documentation or a live check. The emitter tests are
circular by construction: they assert our emitter produces what we decided our
emitter should produce. The spec's premortem disclosed this and accepted it, and
Claude Code is the acceptance target for this spec — but nothing in the diff
raises confidence that Codex actually loads the result.

**W4. `hooks/session-start:27-36` — JSON escaping is untested against hostile skill bodies.**

The hook escapes the bootstrap skill for JSON embedding via bash parameter
substitution, then exits 0 unconditionally. If a future skill body defeats the
escaping, the emitted JSON is malformed, the harness ignores it, and **every
skill goes inert with no error** — the exact failure mode the two-OS hook job
exists to prevent. Current tests use the stub, which contains no quotes,
backslashes, or control characters. A test asserting `JSON.parse` succeeds on a
body containing `"`, `\`, and newlines would close this.

### Nit

**N1. `bin/generate.mjs:22` — `.vibekit-manifest` does not list itself.**
`Object.keys(files)` is evaluated before `files[MANIFEST]` is assigned. Inert:
`MANIFEST` is always present in `files` when `planChanges` runs, so it can never
be selected for removal. Originates in the plan, not the implementation.

**N2. `lib/build.mjs:41` — `applyRegions` returns `files` but the caller ignores it.**
The function mutates its argument; the return is vestigial. Either drop the
return or have the caller use it.

**N3. `tests/hook.test.mjs:1` — missing the `// tests/hook.test.mjs` path comment** that all ten other test files carry.

## Pass 4 — simplicity

- Total hand-written source: **499 lines** across 11 files.
- Largest new construct: `runtimes/claude-code.mjs`, 78 lines — and roughly 50 of
  those are literal manifest object fields, not logic.
- Could a senior engineer halve this without losing required behavior? **No.**
  Every module is single-purpose and near-minimal: the frontmatter parser is 27
  lines because the format is deliberately restricted; `markers.mjs` is 20 lines;
  `table.mjs` is 15. No abstraction has a speculative second implementation, no
  config exists that nothing sets, no export lacks a caller.
- The one structural improvement available (W2, folding assembly into `build()`)
  moves lines rather than removing them; it buys testability, not brevity.

`net: -0 lines possible.` **Lean already.**

## Pass 5 — surgical diff

Clean. Every changed file traces to a plan task's "Files" section, the generated
set traces to Task 10, and `docs/plans/...md` changed only by checkbox marking.
The independent surgical-diff auditor in verify-gate returned `clean` with zero
orphans across all 40 files it examined.

Two files postdate that audit and are traced here manually:
`docs/specs/...design.md` (W1, user-authorized) and
`docs/verifications/...verify.md` (the report itself).

## Self-critique (three risks)

1. **Codex artifacts are wrong in shape and nothing would tell us.** — no
   mitigation in the diff; the tests are circular. Follow-up: install the
   generated plugin in Codex and confirm a skill loads, or drop the Codex
   emitter's claim to work until someone has. See W3.
2. **A future skill body breaks the hook's JSON escaping, silently disabling
   every skill.** — partially mitigated (two-OS CI proves the wrapper executes),
   unmitigated for content. Follow-up test: a bootstrap body containing `"`, `\`,
   tabs and newlines, asserting `JSON.parse` succeeds. See W4.
3. **A skill description containing `<!-- /vibekit:generated -->` would truncate
   a marker region on the next generate.** — unmitigated. `applyRegion` searches
   for the first close marker after the open marker; injected marker text inside
   generated content would be found first, silently swallowing document prose.
   Lower likelihood than B1 but the same class of bug: unescaped user content
   flowing into a structured document. Follow-up: reject marker-like substrings
   during model validation, where every other authoring rule already lives.

All three share one root cause, which is the review's main structural takeaway:
**skill frontmatter is treated as trusted input everywhere it is rendered.**
Validation in `lib/model.mjs` checks that fields are *present* and
*well-typed*, never that their *contents* are safe for the formats they are
interpolated into.

## Diff

Run: `git diff 022af09..c651fdd`

Per-file summary is in §Diff summary; full text is available via the command
above and in PR #11.

## Sign-off

- [ ] User reviewed findings.
- [ ] User reviewed diff.
- [ ] User approves proceeding to finish-branch.
