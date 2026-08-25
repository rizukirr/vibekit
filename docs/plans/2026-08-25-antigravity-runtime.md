# antigravity runtime: Implementation Plan

**Spec:** docs/specs/2026-08-25-antigravity-runtime-design.md
**Goal:** Replace the unused Gemini runtime with an Antigravity runtime, and make every skill's frontmatter parse under agy's strict YAML.

**Architecture:** `runtimes/antigravity.mjs` mirrors the `runtimes/gemini.mjs` it replaces, one method at a time: `emit()` returns `plugin.json`, `regions()` returns the trigger table for `rules/AGENTS.md`, and `ships()` returns both paths. `lib/frontmatter.mjs` gains quote stripping so nine frontmatter values can be quoted at source without changing any generated output, and a rejection rule so an unquoted colon-space becomes a generate-time error rather than a skill that vanishes inside agy. Deletion of `gemini-extension.json` and `GEMINI.md` needs no step: both are listed in `.vibekit-manifest`, so `planChanges` reports them as orphans and `bin/generate.mjs` removes them.

## Global constraints

- Install must work from the bare repo URL, so `skills/` at the repo root must be strict-YAML valid at source.
- Generated files are never hand-edited. Run `npm run generate` and commit its output.
- Every description and trigger, as parsed, must be byte-identical before and after the change.
- A rules file is capped at 12,000 characters by agy.
- `plain` applies to every file this plan writes: no em dash, no semicolon, no hard wrapping inside a paragraph.
- A task whose steps run `npm run generate` also authorises every path listed in `.vibekit-manifest`, which is the generator's own record of what it writes. A `Files` block names what a human edits, and generated output is never hand-edited, so it is not listed there. The scope check for such a task is the union of its `Files` block and that manifest.

## Task 1: Quote the nine colon-bearing frontmatter values → verify: `npm run check` exits 0

**Files:**
- Modify: `lib/frontmatter.mjs:19-23`
- Modify: `skills/brainstorm/SKILL.md`, `skills/debug/SKILL.md`, `skills/exec/SKILL.md`, `skills/lazy/SKILL.md`, `skills/plan/SKILL.md`, `skills/quick/SKILL.md`, `skills/using-vibekit/SKILL.md`, `skills/verify/SKILL.md`
- Modify: `tests/frontmatter.test.mjs`

The verify clause is load-bearing beyond a smoke test. `npm run check` compares every generated file against disk, so it passes only if the parsed values are unchanged. A leaked quote character would alter the README skill list and the generated command files, and the check would fail.

- [x] Step 1: In `lib/frontmatter.mjs`, replace the value extraction at lines 20 and 23 so a matched pair of surrounding quotes is stripped. Insert after the existing `const value = line.slice(split + 1).trim()`:

```js
    // agy parses this frontmatter with a spec-strict YAML parser, where a plain
    // scalar may not contain a colon followed by a space. Quoting is the escape
    // hatch, so the quotes have to come back off here or they would leak into
    // every generated table and command file.
    const unquoted = /^(["'])([\s\S]*)\1$/.exec(value)
    const scalar = unquoted ? unquoted[2] : value
```

  and change the assignment to use `scalar`:

```js
    data[key] = scalar === 'true' ? true : scalar === 'false' ? false : scalar
```

- [x] Step 2: Derive the exact set of values needing quotes by running:

```
for f in skills/*/SKILL.md; do sed -n '/^---$/,/^---$/p' $f | grep -E '^[a-z]+:' | while IFS= read -r line; do k=${line%%:*}; v=${line#*:}; case "$v" in *": "*) echo "$f $k";; esac; done; done
```

- [x] Step 3: For each key the previous step named, wrap its value in double quotes in place, changing nothing else about the text. The affected keys are `description` in eight skills and `trigger` in `skills/debug/SKILL.md`. Example, in `skills/brainstorm/SKILL.md`:

```
description: "Use before any creative or implementation work: features, components, behavior changes. Hard gate, no code before an approved design."
```

- [x] Step 4: Re-run the command from Step 2. It must print nothing that is not now quoted.
- [x] Step 5: Add cases to `tests/frontmatter.test.mjs` covering a double-quoted value, a single-quoted value, and a value whose interior colon survives parsing unchanged.
- [x] Step 6: Run `npm test`
- [x] Step 7: Run `npm run check`
- [x] Step 8: Commit

## Task 2: Reject an unquoted colon-space at generate time → verify: `npm test` exits 0

**Files:**
- Modify: `lib/frontmatter.mjs`
- Modify: `tests/frontmatter.test.mjs`

This lands after Task 1 rather than with it. Adding the rejection while the skills still carry bare colons would make `npm run generate` fail on the repo's own sources, so the quoting has to be in place first.

- [x] Step 1: In `lib/frontmatter.mjs`, after computing `scalar` and before the assignment, reject a bare value carrying colon-space:

```js
    if (!unquoted && scalar.includes(': ')) {
      throw new Error(`frontmatter '${key}' contains ': ' and must be quoted`)
    }
```

- [x] Step 2: Add a test asserting that an unquoted value containing colon-space throws, and that the message names the key.
- [x] Step 3: Add a test asserting a quoted value containing colon-space does not throw.
- [x] Step 4: Run `npm test`
- [x] Step 5: Run `npm run check`
- [x] Step 6: Commit

## Task 3: Quote the description in generated Claude Code command files → verify: `npm run check` exits 0 after `npm run generate`

**Files:**
- Modify: `runtimes/claude-code.mjs:22`
- Modify: `tests/claude-code.test.mjs`

`commands/*.md` is one of the files agy converts, and it currently writes the description as a bare YAML scalar, reproducing the same defect in a generated file.

- [x] Step 1: In `runtimes/claude-code.mjs`, change the description line of `commandFile` from an unquoted interpolation to a JSON-quoted one:

```js
    `description: ${JSON.stringify(skill.description)}`,
```

- [x] Step 2: Add a test asserting the generated command file's description line survives `parseFrontmatter` and round-trips to the skill's description.
- [x] Step 3: Run `npm run generate`
- [x] Step 4: Run `npm test`
- [x] Step 5: Run `npm run check`
- [x] Step 6: Commit

## Task 4: Replace the Gemini runtime with the Antigravity runtime → verify: `npm test` exits 0

**Files:**
- Create: `runtimes/antigravity.mjs`
- Create: `rules/AGENTS.md`
- Create: `tests/antigravity.test.mjs`
- Delete: `runtimes/gemini.mjs`
- Delete: `tests/gemini.test.mjs`
- Delete: `GEMINI.md`
- Modify: `vibekit.config.json:10`
- Modify: `tests/skeleton.test.mjs:13`, `tests/skeleton.test.mjs:23`
- Modify: `tests/build.test.mjs:55`, `tests/build.test.mjs:62-64`

`rules/AGENTS.md` must exist with its region marker before `npm run generate` runs, because `applyRegions` throws when a file carrying a generated region is absent. The move is therefore Step 1, not a consequence of generating.

- [x] Step 1: Run `git mv GEMINI.md rules/AGENTS.md`
- [x] Step 2: In `rules/AGENTS.md`, rewrite the prose above the region marker so it names no dead runtime and is not hard wrapped, leaving the `<!-- vibekit:generated:trigger-table -->` and `<!-- /vibekit:generated -->` markers and everything between them untouched:

```markdown
# vibekit

Guardrailed vibe-coding pipeline. Skills auto-trigger at their trigger points. Invoke a skill by reading its `SKILL.md` and following it.

## Auto-trigger map
```

- [x] Step 3: Create `runtimes/antigravity.mjs`:

```js
// runtimes/antigravity.mjs
import { triggerTable } from '../lib/table.mjs'

export const id = 'antigravity'

// agy reads a plugin's rules from `rules/`, and nothing else in the plugin
// reaches the model unprompted: its own AGENTS.md, CLAUDE.md and GEMINI.md are
// all ignored. There is no session-start event to prime with either, so this
// file is the only always-on channel the trigger table has.
export function emit(model) {
  const { config } = model
  return {
    'plugin.json': `${JSON.stringify({
      name: config.name,
      description: config.description,
      version: config.version,
    }, null, 2)}\n`,
  }
}

export function ships() {
  return ['plugin.json', 'rules/AGENTS.md']
}

export function regions(model) {
  return { 'rules/AGENTS.md': { 'trigger-table': triggerTable(model.skills) } }
}
```

- [x] Step 4: In `vibekit.config.json`, replace `"gemini"` with `"antigravity"` in the `runtimes` array.
- [x] Step 5: Run `git rm runtimes/gemini.mjs tests/gemini.test.mjs`
- [x] Step 6: Create `tests/antigravity.test.mjs` asserting the exported `id`, that `emit` produces a `plugin.json` whose name matches the config, that `regions` carries a `trigger-table` entry for `rules/AGENTS.md`, and that `ships` includes both emitted paths.
- [x] Step 7: In `tests/skeleton.test.mjs`, update the runtimes array on line 13 and replace the `GEMINI.md` entry on line 23 with `rules/AGENTS.md`.
- [x] Step 8: In `tests/build.test.mjs`, update the emitter id list on line 55 and replace `GEMINI.md` and `gemini-extension.json` in the path list on lines 62 to 64 with `rules/AGENTS.md` and `plugin.json`.
- [x] Step 9: Run `npm run generate`
- [x] Step 9: Run `npm test`
- [x] Step 10: Run `npm run check`
- [x] Step 11: Commit

## Task 5: Probe against the real agy CLI and record the result in the README → verify: `grep -q "Failed to parse skill file" ~/.gemini/antigravity-cli/cli.log` exits non-zero

**Files:**
- Modify: `README.md:85-89`, `README.md:104`, `README.md:107`

The README's runtime table distinguishes probed rows from unprobed ones, so the row may only claim verification after this task's probe has run. That is why the probe and the README edit share a task and a commit.

- [x] Step 1: Run `agy plugin list`, uninstall any existing vibekit entry, truncate the agy log so the probe reads only its own output, then run `agy plugin install <this repo path>`
- [x] Step 2: In a scratch directory outside the repo, run a print-mode session asking whether the auto-trigger map is in context and to reproduce one of its rows.
- [x] Step 3: Grep the agy log at `~/.gemini/antigravity-cli/cli.log` for the skill-parse failure line and confirm the grep exits non-zero.
- [x] Step 4: Inspect the installed plugin's `skills/vibe/SKILL.md` and `skills/quick/SKILL.md` and confirm each still contains its authored body rather than a command prompt.
- [x] Step 5: In `README.md`, replace the Gemini CLI install block at lines 85 to 89 with an Antigravity block, matching the heading-then-fenced-command shape the neighbouring runtime blocks already use. The heading text is `**Antigravity**` and the fenced command is `agy plugin install https://github.com/rizukirr/vibekit`.

- [x] Step 6: In `README.md`, replace the Gemini row of the runtime table on line 104 with an Antigravity row naming `runtimes/antigravity.mjs` and describing what Step 2 and Step 3 observed, including the agy version reported by `agy --version`.
- [x] Step 7: In `README.md` line 107, update the sentence counting probed and unprobed runtimes so it matches the table as edited.
- [x] Step 8: Run `agy plugin uninstall vibekit` so the probe leaves no state.
- [x] Step 9: Run `npm test`
- [x] Step 10: Run `npm run check`
- [x] Step 11: Commit

## Task 6: Name the skill in a frontmatter parse failure → verify: `npm test` exits 0

**Files:**
- Modify: `lib/model.mjs:35`
- Modify: `tests/model.test.mjs`

Added after `verify` observed spec goal 5 fail. `npm run generate` rejects an unquoted colon-space and exits non-zero, but the message names only the key, so an author with eleven skills gets no file to open. Every other error raised in `lib/model.mjs` already prefixes the skill directory, so this is that same pattern applied to the one call that lacks it.

- [x] Step 1: In `lib/model.mjs`, wrap the `parseFrontmatter` call so the skill directory prefixes anything it throws:

```js
    let data
    try {
      ({ data } = parseFrontmatter(text))
    } catch (error) {
      throw new Error(`${dir}: ${error.message}`)
    }
```

- [x] Step 2: Add a test to `tests/model.test.mjs` asserting that a skill whose frontmatter carries an unquoted colon-space throws an error naming both the skill directory and the offending key.
- [x] Step 3: Run `npm test`
- [x] Step 4: Run `npm run check`
- [x] Step 5: Commit
