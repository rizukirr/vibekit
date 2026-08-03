# vibekit v2 Architecture Implementation Plan

> **For executing agents:** implement this plan task-by-task. Each step uses checkbox (`- [ ]`) syntax. Do not skip steps. Do not batch commits across tasks.

**Goal:** Build a dependency-free generator that derives every runtime manifest, command file, and documentation table from one skill directory, so adding a skill touches exactly one directory and adding a runtime touches exactly one file.

**Architecture:** `skills/*/SKILL.md` frontmatter plus `vibekit.config.json` are the only hand-edited registries. `lib/build.mjs` globs the skills, validates them, builds one in-memory model, and passes it to pure `emit(model)` functions in `runtimes/`. The driver merges the returned path→contents maps, applies marker-delimited regions to mixed Markdown files, and either writes to disk or compares against it (`--check`). Validation runs inside generation, so a malformed skill can never reach a manifest.

**Tech stack:** Node 24+ (ES modules, `node:test`, `node:assert/strict`), bash, Windows batch. Zero dependencies — no npm packages, runtime or dev.

---

## Premortem

**Hidden assumptions:**
- The plan assumes `node --test "tests/**/*.test.mjs"` resolves the glob itself rather than relying on the shell — verified by dry-run on Node 26 before writing this plan; it also matters because a bare `node --test` would scan the gitignored `external/` tree and run other projects' test suites, so the quoted glob is load-bearing and must not be simplified to `node --test`.
- The plan assumes Codex reads `.codex-plugin/plugin.json` with a `skills` path and `commands/*.toml` with `description` + `prompt` keys — taken from the v1 package (`0.5.2`) which shipped and worked, not from documentation. Not independently re-verified against current Codex. Mitigation: the acceptance criterion for this spec is Claude Code only; the Codex emitter exists to prove the emitter contract generalizes, and its output shape is a data change in one file if Codex's format has moved.
- The plan assumes Claude Code exports `${CLAUDE_PLUGIN_ROOT}` to hooks and reads `hookSpecificOutput.additionalContext` — copied from the superpowers reference integration in `external/`, which is a live working integration. Task 11's hook test asserts the emitted JSON shape, so a wrong assumption fails a test rather than silently disabling every skill.

**Irreversible / risky steps:**
- Task 10 runs the generator in write mode for the first time and commits its output; if an emitter is wrong, wrong content lands in tracked files — mitigated because every emitter has unit tests from Tasks 6–8 that pin its exact output before Task 10 runs, and every generated file is new (nothing is overwritten), so `git revert` fully restores the tree.
- The driver's prune step (Task 9) deletes files listed in the previous `.vibekit-manifest` — mitigated by restricting deletion to paths recorded in that manifest, which only ever contains generator-written paths, plus a unit test proving a path absent from the manifest is never deleted.
- `none` beyond those two — every other task creates new files only, and the repository has no production surface, no database, and no published artifact until a release is cut (out of scope here).

**Spec-misalignment:**
- The spec lists `package.json` as GENERATED but `package.json` also holds npm scripts, which are not derivable from skills. The plan resolves this by making `package.json` **fully** generated from a `npm` block inside `vibekit.config.json`, rather than field-patching an existing file. This is the interpretation that preserves the spec's "never both" rule; the alternative (JSON field-patching) would make `package.json` a mixed file, which the spec reserves for marker-delimited Markdown. Surfaced here because it moves the npm scripts into `vibekit.config.json`, which the spec did not explicitly say.
- The spec names `skills/_shared/*.md` as a truth surface, but this spec authors no shared rules, so `skills/_shared/` is **not created** here — an empty directory cannot be tracked by git, and creating a placeholder file would be scaffolding for later, which the minimalism constraint forbids. The skill glob already excludes any `_`-prefixed directory, so spec 2 can add it with no code change. Verified by a test in Task 3.
- The spec's file map lists `commands/*.toml` as generated; the plan emits `commands/<name>.md` for Claude Code **and** `commands/<name>.toml` for Codex into the same directory. Distinct paths, no collision, and the driver's collision check proves it.

**Verify-clause weakness:**
- "test file passes" would pass on an empty test file — every task's verify clause instead names the specific assertion or the exact command output that distinguishes correct from broken.
- Task 10's clause is the one that could hide a broken emitter, since "generate writes files" is true even if the contents are wrong. Tightened: it requires `npm run check` to exit 0 **on a freshly re-run generate** and requires `.claude-plugin/plugin.json` to contain the version from `vibekit.config.json`, so a stub emitter fails it.
- Task 12's CI clause cannot be verified locally (it asserts behavior of a GitHub runner). Tightened to what is checkable on the dev machine: the workflow file's `run:` lines must be scripts that exist in the generated `package.json`, asserted by a test rather than by eye.

## File structure

New — hand-authored truth:
- `vibekit.config.json` — identity, version, runtime list, npm block, bootstrap skill name
- `lib/frontmatter.mjs` — restricted-subset frontmatter parser
- `lib/model.mjs` — skill discovery, validation, model construction
- `lib/markers.mjs` — marker-region replacement for mixed Markdown files
- `lib/table.mjs` — trigger-table rendering shared by every runtime
- `lib/build.mjs` — driver core: load emitters, merge maps, apply regions, prune
- `bin/generate.mjs` — CLI wrapper around `lib/build.mjs` (`--check` flag)
- `runtimes/core.mjs` — runtime-independent output: `package.json`, `README.md` region
- `runtimes/claude-code.mjs` — `.claude-plugin/*`, `hooks/hooks.json`, `commands/*.md`, `CLAUDE.md` region
- `runtimes/codex.mjs` — `.codex-plugin/plugin.json`, `commands/*.toml`, `AGENTS.md` region
- `hooks/session-start` — bootstrap injector (bash, extensionless)
- `hooks/run-hook.cmd` — polyglot bash/batch wrapper for Windows
- `skills/using-vibekit/SKILL.md` — bootstrap skill stub (permanent)
- `skills/example-command/SKILL.md` — fixture, `command: true` (deleted in spec 2)
- `skills/example-plain/SKILL.md` — fixture, plain skill (deleted in spec 2)
- `CLAUDE.md` — prose + `trigger-table` marker region
- `AGENTS.md` — prose + `trigger-table` marker region
- `README.md` — prose + `skill-list` marker region

New — tests:
- `tests/skeleton.test.mjs`, `tests/frontmatter.test.mjs`, `tests/model.test.mjs`,
  `tests/markers.test.mjs`, `tests/table.test.mjs`, `tests/core.test.mjs`,
  `tests/claude-code.test.mjs`, `tests/codex.test.mjs`, `tests/build.test.mjs`,
  `tests/hook.test.mjs`, `tests/ci.test.mjs`
- `tests/helpers.mjs` — shared model fixture and temp-directory helper

New — generated (committed, written by Task 10, never hand-edited):
- `package.json`, `.vibekit-manifest`, `.claude-plugin/plugin.json`,
  `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json`,
  `hooks/hooks.json`, `commands/example-command.md`, `commands/example-command.toml`

Modified:
- `.gitignore` — no change needed; `external/` and `.vibe-worktrees/` already ignored
- `.github/workflows/ci.yml` — repoint at the restored scripts (Task 12)

---

### Task 1: Repo skeleton and config → verify: `node --test "tests/**/*.test.mjs"` exits 0 and reports `pass 4`

**Files:**
- Create: `vibekit.config.json`
- Create: `package.json` (seed; Task 10's generator reproduces it byte-for-byte)
- Create: `skills/using-vibekit/SKILL.md`
- Create: `skills/example-command/SKILL.md`
- Create: `skills/example-plain/SKILL.md`
- Create: `CLAUDE.md`, `AGENTS.md`, `README.md`
- Test: `tests/skeleton.test.mjs`

- [x] **Step 1: Write `vibekit.config.json`**

The `npm` block is the complete npm metadata; Task 6's `core` emitter composes `package.json` from it plus the generated `files[]` and `version`. Nothing outside this file names a skill.

```json
{
  "name": "vibekit",
  "version": "2.0.0",
  "description": "Guardrailed vibe-coding pipeline for coding agents.",
  "author": { "name": "rizukirr", "url": "https://github.com/rizukirr" },
  "license": "MIT",
  "homepage": "https://github.com/rizukirr/vibekit",
  "repository": "https://github.com/rizukirr/vibekit",
  "bootstrap": "using-vibekit",
  "runtimes": ["claude-code", "codex"],
  "keywords": ["vibekit", "ai-coding", "vibe-coding", "claude-code", "codex", "agent-skills", "skills"],
  "npm": {
    "name": "@rizukirr/vibekit",
    "type": "module",
    "scripts": {
      "generate": "node bin/generate.mjs",
      "check": "node bin/generate.mjs --check",
      "test": "node --test \"tests/**/*.test.mjs\"",
      "check:hook": "node --test \"tests/hook.test.mjs\""
    },
    "publishConfig": { "access": "public" }
  }
}
```

- [x] **Step 2: Write the seed `package.json`**

Hand-written now so `npm test` works before the generator exists. Task 10 proves the generator reproduces this exact content.

```json
{
  "name": "@rizukirr/vibekit",
  "version": "2.0.0",
  "description": "Guardrailed vibe-coding pipeline for coding agents.",
  "type": "module",
  "license": "MIT",
  "author": {
    "name": "rizukirr",
    "url": "https://github.com/rizukirr"
  },
  "homepage": "https://github.com/rizukirr/vibekit",
  "repository": "https://github.com/rizukirr/vibekit",
  "keywords": [
    "vibekit",
    "ai-coding",
    "vibe-coding",
    "claude-code",
    "codex",
    "agent-skills",
    "skills"
  ],
  "scripts": {
    "generate": "node bin/generate.mjs",
    "check": "node bin/generate.mjs --check",
    "test": "node --test \"tests/**/*.test.mjs\"",
    "check:hook": "node --test \"tests/hook.test.mjs\""
  },
  "files": [
    ".claude-plugin/",
    ".codex-plugin/",
    "commands/",
    "hooks/",
    "skills/",
    "AGENTS.md",
    "CLAUDE.md",
    "LICENSE",
    "README.md"
  ],
  "publishConfig": {
    "access": "public"
  }
}
```

- [x] **Step 3: Write the three stub skills**

These are empty fixtures. They carry no v1 content and exist only to exercise emission paths.

`skills/using-vibekit/SKILL.md`:

```markdown
---
name: using-vibekit
description: Use when starting any conversation — establishes vibekit's auto-trigger discipline.
trigger: Session start
gate: none
---

# using-vibekit

Stub. The v2 pipeline is designed in a separate spec; this file exists so the
SessionStart hook has a bootstrap document to inject and so the generator has a
skill to discover.
```

`skills/example-command/SKILL.md`:

```markdown
---
name: example-command
description: Fixture skill that exercises slash-command emission.
trigger: Never — this is a build fixture
command: true
gate: none
---

# example-command

Build fixture. Proves that `command: true` produces `commands/example-command.md`
for Claude Code and `commands/example-command.toml` for Codex. Deleted once the
real pipeline is authored.
```

`skills/example-plain/SKILL.md`:

```markdown
---
name: example-plain
description: Fixture skill that exercises the plain-skill path.
trigger: Never — this is a build fixture
gate: hard
---

# example-plain

Build fixture. Proves the common case: a skill that appears in the trigger table
and emits no command file. Uses `gate: hard` so the Gate column has a non-default
value to render. Deleted once the real pipeline is authored.
```

- [x] **Step 4: Write the three mixed Markdown files with marker regions**

The generator replaces only what is between the markers. Everything else is prose you own.

`CLAUDE.md`:

```markdown
# vibekit

Guardrailed vibe-coding pipeline. Skills auto-trigger at their trigger points.

## Auto-trigger map

<!-- vibekit:generated:trigger-table -->
<!-- /vibekit:generated -->

## Contributing

Adding a skill is creating one directory under `skills/`. Run `npm run generate`
afterwards; never hand-edit a generated file.
```

`AGENTS.md`:

```markdown
# vibekit

Guardrailed vibe-coding pipeline. Skills are referenced from this file and
invoked by following the named workflow.

## Auto-trigger map

<!-- vibekit:generated:trigger-table -->
<!-- /vibekit:generated -->
```

`README.md`:

```markdown
# vibekit

Guardrailed vibe-coding pipeline for coding agents. Dependency free.

## Skills

<!-- vibekit:generated:skill-list -->
<!-- /vibekit:generated -->

## Install

Claude Code: `/plugin marketplace add rizukirr/vibekit`

## Development

- `npm run generate` — regenerate every derived file
- `npm run check` — fail if any generated file is out of date
- `npm test` — run the unit tests
```

- [x] **Step 5: Write the skeleton test**

```js
// tests/skeleton.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const config = JSON.parse(readFileSync('vibekit.config.json', 'utf8'))

test('config names a bootstrap skill that exists', () => {
  assert.ok(existsSync(`skills/${config.bootstrap}/SKILL.md`))
})

test('config names only runtimes that will have emitters', () => {
  assert.deepEqual(config.runtimes, ['claude-code', 'codex'])
})

test('every stub skill has a SKILL.md', () => {
  for (const name of ['using-vibekit', 'example-command', 'example-plain']) {
    assert.ok(existsSync(`skills/${name}/SKILL.md`), `${name} missing`)
  }
})

test('mixed markdown files carry balanced marker regions', () => {
  for (const [file, id] of [['CLAUDE.md', 'trigger-table'], ['AGENTS.md', 'trigger-table'], ['README.md', 'skill-list']]) {
    const text = readFileSync(file, 'utf8')
    assert.ok(text.includes(`<!-- vibekit:generated:${id} -->`), `${file} missing open marker`)
    assert.ok(text.includes('<!-- /vibekit:generated -->'), `${file} missing close marker`)
  }
})
```

- [x] **Step 6: Run the tests**

Run: `npm test`
Expected: PASS — `pass 4`, `fail 0`.

- [x] **Step 7: Commit**

```bash
git add vibekit.config.json package.json skills CLAUDE.md AGENTS.md README.md tests/skeleton.test.mjs
git commit -m "feat: repo skeleton, config, and three fixture skills"
```

---

### Task 2: Frontmatter parser → verify: `tests/frontmatter.test.mjs` passes; parser coerces `command: true` to boolean `true` and throws on a line with no colon

**Files:**
- Create: `lib/frontmatter.mjs`
- Test: `tests/frontmatter.test.mjs`

The format is a deliberately restricted YAML subset: flat `key: value` lines only. No nesting, no lists, no quoting rules. Anything else is an error rather than a silent misparse — this is what lets the parser be twenty lines instead of a dependency.

- [x] **Step 1: Write the failing test**

```js
// tests/frontmatter.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFrontmatter } from '../lib/frontmatter.mjs'

test('parses flat key-value pairs and returns the body', () => {
  const { data, body } = parseFrontmatter('---\nname: foo\ndescription: does a thing\n---\n# Foo\n')
  assert.equal(data.name, 'foo')
  assert.equal(data.description, 'does a thing')
  assert.equal(body, '# Foo\n')
})

test('coerces true and false to booleans', () => {
  const { data } = parseFrontmatter('---\ncommand: true\nhidden: false\n---\nbody\n')
  assert.equal(data.command, true)
  assert.equal(data.hidden, false)
})

test('keeps colons that appear inside a value', () => {
  const { data } = parseFrontmatter('---\ntrigger: About to run: anything\n---\nbody\n')
  assert.equal(data.trigger, 'About to run: anything')
})

test('throws when the frontmatter block is missing', () => {
  assert.throws(() => parseFrontmatter('# Foo\n'), /missing frontmatter/)
})

test('throws on a malformed line', () => {
  assert.throws(() => parseFrontmatter('---\nname foo\n---\nbody\n'), /malformed frontmatter/)
})
```

- [x] **Step 2: Run the test to confirm it fails**

Run: `node --test tests/frontmatter.test.mjs`
Expected: FAIL — the suite fails to load with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module ... frontmatter.mjs`, reported as `fail 1` (a file that cannot load counts as one failing test, not one per test).

- [x] **Step 3: Write the implementation**

```js
// lib/frontmatter.mjs

// Parses a deliberately restricted YAML subset: a leading `---` block of flat
// `key: value` lines. Nesting, lists, and anchors are not supported — a skill
// that needs them is a skill that has outgrown the authoring contract, and we
// want that to be a loud error rather than a silent misparse.
export function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  if (!match) throw new Error('missing frontmatter block')

  const data = {}
  for (const raw of match[1].split('\n')) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue

    const split = line.indexOf(':')
    if (split === -1) throw new Error(`malformed frontmatter line: ${raw}`)

    const key = line.slice(0, split).trim()
    const value = line.slice(split + 1).trim()
    if (key === '') throw new Error(`malformed frontmatter line: ${raw}`)

    data[key] = value === 'true' ? true : value === 'false' ? false : value
  }

  return { data, body: text.slice(match[0].length) }
}
```

- [x] **Step 4: Run the test to confirm it passes**

Run: `node --test tests/frontmatter.test.mjs`
Expected: PASS — `pass 5`, `fail 0`.

- [x] **Step 5: Commit**

```bash
git add lib/frontmatter.mjs tests/frontmatter.test.mjs
git commit -m "feat: add restricted-subset frontmatter parser"
```

---

### Task 3: Skill discovery and validation → verify: `tests/model.test.mjs` passes; `buildModel` throws when frontmatter `name` differs from the directory name, and skips `_`-prefixed directories

**Files:**
- Create: `lib/model.mjs`
- Create: `tests/helpers.mjs`
- Test: `tests/model.test.mjs`

Note that duplicate skill names are structurally impossible here rather than checked: directory names are unique by the filesystem, and `name` must equal its directory. That is one fewer rule to maintain.

- [x] **Step 1: Write the test helper**

```js
// tests/helpers.mjs
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Creates a throwaway skills/ tree. `skills` maps directory name → SKILL.md text.
// Returns the directory path plus a cleanup function.
export function makeSkillsDir(skills) {
  const root = mkdtempSync(join(tmpdir(), 'vibekit-test-'))
  for (const [dir, contents] of Object.entries(skills)) {
    mkdirSync(join(root, dir), { recursive: true })
    if (contents !== null) writeFileSync(join(root, dir, 'SKILL.md'), contents)
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

export function skillFile({ name, description = 'does a thing', trigger = 'when X', extra = '' }) {
  return `---\nname: ${name}\ndescription: ${description}\ntrigger: ${trigger}\n${extra}---\n\nbody\n`
}

// A fixed model, used by every emitter test so their expected output is stable.
export const MODEL = {
  config: {
    name: 'vibekit',
    version: '2.0.0',
    description: 'Guardrailed vibe-coding pipeline for coding agents.',
    author: { name: 'rizukirr', url: 'https://github.com/rizukirr' },
    license: 'MIT',
    homepage: 'https://github.com/rizukirr/vibekit',
    repository: 'https://github.com/rizukirr/vibekit',
    bootstrap: 'using-vibekit',
    runtimes: ['claude-code', 'codex'],
    keywords: ['vibekit', 'skills'],
    npm: {
      name: '@rizukirr/vibekit',
      type: 'module',
      scripts: { check: 'node bin/generate.mjs --check' },
      publishConfig: { access: 'public' },
    },
  },
  skills: [
    { name: 'alpha', description: 'Alpha does A.', trigger: 'When A happens', command: true, gate: 'hard', dir: 'alpha' },
    { name: 'beta', description: 'Beta does B.', trigger: 'When B happens', command: false, gate: 'none', dir: 'beta' },
  ],
}
```

- [x] **Step 2: Write the failing test**

```js
// tests/model.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildModel } from '../lib/model.mjs'
import { makeSkillsDir, skillFile, MODEL } from './helpers.mjs'

const config = MODEL.config

test('discovers skills sorted by name with defaults applied', () => {
  const { root, cleanup } = makeSkillsDir({
    zulu: skillFile({ name: 'zulu' }),
    'using-vibekit': skillFile({ name: 'using-vibekit' }),
  })
  try {
    const model = buildModel(config, root)
    assert.deepEqual(model.skills.map(s => s.name), ['using-vibekit', 'zulu'])
    assert.equal(model.skills[0].command, false)
    assert.equal(model.skills[0].gate, 'none')
  } finally { cleanup() }
})

test('skips underscore-prefixed directories', () => {
  const { root, cleanup } = makeSkillsDir({
    '_shared': null,
    'using-vibekit': skillFile({ name: 'using-vibekit' }),
  })
  try {
    assert.deepEqual(buildModel(config, root).skills.map(s => s.name), ['using-vibekit'])
  } finally { cleanup() }
})

test('throws when frontmatter name does not match the directory', () => {
  const { root, cleanup } = makeSkillsDir({ 'using-vibekit': skillFile({ name: 'mismatched' }) })
  try {
    assert.throws(() => buildModel(config, root), /does not match directory/)
  } finally { cleanup() }
})

test('throws when a required field is missing', () => {
  const { root, cleanup } = makeSkillsDir({
    'using-vibekit': '---\nname: using-vibekit\ndescription: d\n---\nbody\n',
  })
  try {
    assert.throws(() => buildModel(config, root), /'trigger' is required/)
  } finally { cleanup() }
})

test('throws when a skill directory has no SKILL.md', () => {
  const { root, cleanup } = makeSkillsDir({ 'using-vibekit': null })
  try {
    assert.throws(() => buildModel(config, root), /missing SKILL\.md/)
  } finally { cleanup() }
})

test('throws on an unknown gate value', () => {
  const { root, cleanup } = makeSkillsDir({
    'using-vibekit': skillFile({ name: 'using-vibekit', extra: 'gate: kinda\n' }),
  })
  try {
    assert.throws(() => buildModel(config, root), /gate must be one of/)
  } finally { cleanup() }
})

test('throws when the configured bootstrap skill does not exist', () => {
  const { root, cleanup } = makeSkillsDir({ alpha: skillFile({ name: 'alpha' }) })
  try {
    assert.throws(() => buildModel(config, root), /bootstrap/)
  } finally { cleanup() }
})
```

- [x] **Step 3: Run the test to confirm it fails**

Run: `node --test tests/model.test.mjs`
Expected: FAIL — the suite fails to load with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module ... model.mjs`, reported as `fail 1` (a file that cannot load counts as one failing test, not one per test).

- [x] **Step 4: Write the implementation**

```js
// lib/model.mjs
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseFrontmatter } from './frontmatter.mjs'

const REQUIRED = ['name', 'description', 'trigger']
const GATES = ['hard', 'soft', 'none']

// Builds the single in-memory model every emitter reads. Discovery is a glob of
// skills/*/SKILL.md — there is deliberately no skill list anywhere else in the
// repo, which is what makes registration drift impossible rather than merely
// detectable.
export function buildModel(config, skillsDir) {
  const dirs = readdirSync(skillsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
    .map(entry => entry.name)
    .sort()

  const skills = dirs.map(dir => {
    let text
    try {
      text = readFileSync(join(skillsDir, dir, 'SKILL.md'), 'utf8')
    } catch {
      throw new Error(`${dir}: missing SKILL.md`)
    }

    const { data } = parseFrontmatter(text)

    for (const key of REQUIRED) {
      if (typeof data[key] !== 'string' || data[key].trim() === '') {
        throw new Error(`${dir}: frontmatter '${key}' is required and must be a non-empty string`)
      }
    }
    // Duplicate names need no separate check: directory names are unique, and
    // name must equal its directory.
    if (data.name !== dir) {
      throw new Error(`${dir}: frontmatter name '${data.name}' does not match directory`)
    }
    if (data.command !== undefined && typeof data.command !== 'boolean') {
      throw new Error(`${dir}: 'command' must be true or false`)
    }
    const gate = data.gate === undefined ? 'none' : data.gate
    if (!GATES.includes(gate)) {
      throw new Error(`${dir}: gate must be one of ${GATES.join(', ')}`)
    }

    return {
      name: data.name,
      description: data.description,
      trigger: data.trigger,
      command: data.command === true,
      gate,
      dir,
    }
  })

  if (!skills.some(skill => skill.name === config.bootstrap)) {
    throw new Error(`config.bootstrap '${config.bootstrap}' is not an existing skill`)
  }

  return { config, skills }
}
```

- [x] **Step 5: Run the test to confirm it passes**

Run: `node --test tests/model.test.mjs`
Expected: PASS — `pass 7`, `fail 0`.

- [x] **Step 6: Commit**

```bash
git add lib/model.mjs tests/helpers.mjs tests/model.test.mjs
git commit -m "feat: discover and validate skills into a single model"
```

---

### Task 4: Marker regions → verify: `tests/markers.test.mjs` passes; `applyRegion` replaces only text between markers and throws on missing, duplicate, or unbalanced markers

**Files:**
- Create: `lib/markers.mjs`
- Test: `tests/markers.test.mjs`

- [x] **Step 1: Write the failing test**

```js
// tests/markers.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { applyRegion } from '../lib/markers.mjs'

const doc = [
  '# Title',
  '',
  '<!-- vibekit:generated:table -->',
  'stale content',
  '<!-- /vibekit:generated -->',
  '',
  'trailing prose',
  '',
].join('\n')

test('replaces only the region between markers', () => {
  const out = applyRegion(doc, 'table', 'fresh content')
  assert.ok(out.includes('fresh content'))
  assert.ok(!out.includes('stale content'))
  assert.ok(out.startsWith('# Title'))
  assert.ok(out.includes('trailing prose'))
})

test('is idempotent', () => {
  const once = applyRegion(doc, 'table', 'fresh content')
  assert.equal(applyRegion(once, 'table', 'fresh content'), once)
})

test('replaces an already-empty region', () => {
  const empty = '<!-- vibekit:generated:table -->\n<!-- /vibekit:generated -->\n'
  assert.ok(applyRegion(empty, 'table', 'rows').includes('rows'))
})

test('throws when the open marker is missing', () => {
  assert.throws(() => applyRegion('# Title\n', 'table'), /missing marker 'table'/)
})

test('throws when the open marker appears twice', () => {
  const dup = doc + '\n<!-- vibekit:generated:table -->\n<!-- /vibekit:generated -->\n'
  assert.throws(() => applyRegion(dup, 'table', 'x'), /duplicate marker 'table'/)
})

test('throws when the close marker is missing', () => {
  const open = '<!-- vibekit:generated:table -->\nrows\n'
  assert.throws(() => applyRegion(open, 'table', 'x'), /unbalanced marker 'table'/)
})
```

- [x] **Step 2: Run the test to confirm it fails**

Run: `node --test tests/markers.test.mjs`
Expected: FAIL — the suite fails to load with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module ... markers.mjs`, reported as `fail 1` (a file that cannot load counts as one failing test, not one per test).

- [x] **Step 3: Write the implementation**

```js
// lib/markers.mjs

const CLOSE = '<!-- /vibekit:generated -->'

// Replaces the content between a named open marker and the next close marker.
// Prose outside the region is untouched — this is what lets CLAUDE.md be
// authored by a human and still carry a machine-owned table.
export function applyRegion(text, id, replacement) {
  const open = `<!-- vibekit:generated:${id} -->`

  const start = text.indexOf(open)
  if (start === -1) throw new Error(`missing marker '${id}'`)
  if (text.indexOf(open, start + open.length) !== -1) throw new Error(`duplicate marker '${id}'`)

  const from = start + open.length
  const end = text.indexOf(CLOSE, from)
  if (end === -1) throw new Error(`unbalanced marker '${id}'`)

  return `${text.slice(0, from)}\n${replacement}\n${text.slice(end)}`
}
```

- [x] **Step 4: Run the test to confirm it passes**

Run: `node --test tests/markers.test.mjs`
Expected: PASS — `pass 6`, `fail 0`.

- [x] **Step 5: Commit**

```bash
git add lib/markers.mjs tests/markers.test.mjs
git commit -m "feat: add marker-region replacement for mixed markdown files"
```

---

### Task 5: Shared table rendering → verify: `tests/table.test.mjs` passes; `triggerTable(MODEL.skills)` renders a three-column table whose `alpha` row shows gate `hard`

**Files:**
- Create: `lib/table.mjs`
- Test: `tests/table.test.mjs`

Both `CLAUDE.md` and `AGENTS.md` render the same table, so it lives in one place rather than being restated in each emitter.

- [ ] **Step 1: Write the failing test**

```js
// tests/table.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { triggerTable, skillList } from '../lib/table.mjs'
import { MODEL } from './helpers.mjs'

test('renders a three-column trigger table', () => {
  const out = triggerTable(MODEL.skills)
  assert.equal(out.split('\n')[0], '| Trigger condition | Skill | Gate |')
  assert.equal(out.split('\n')[1], '|---|---|---|')
  assert.ok(out.includes('| When A happens | `alpha` | hard |'))
  assert.ok(out.includes('| When B happens | `beta` | none |'))
})

test('renders one row per skill and nothing else', () => {
  assert.equal(triggerTable(MODEL.skills).split('\n').length, 2 + MODEL.skills.length)
})

test('renders a skill list with descriptions', () => {
  const out = skillList(MODEL.skills)
  assert.ok(out.includes('- `alpha` — Alpha does A.'))
  assert.ok(out.includes('- `beta` — Beta does B.'))
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `node --test tests/table.test.mjs`
Expected: FAIL — the suite fails to load with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module ... table.mjs`, reported as `fail 1` (a file that cannot load counts as one failing test, not one per test).

- [ ] **Step 3: Write the implementation**

```js
// lib/table.mjs

// One renderer, used by every runtime that shows a trigger map. Restating this
// per-emitter is exactly the duplication this rewrite exists to remove.
export function triggerTable(skills) {
  return [
    '| Trigger condition | Skill | Gate |',
    '|---|---|---|',
    ...skills.map(skill => `| ${skill.trigger} | \`${skill.name}\` | ${skill.gate} |`),
  ].join('\n')
}

export function skillList(skills) {
  return skills.map(skill => `- \`${skill.name}\` — ${skill.description}`).join('\n')
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `node --test tests/table.test.mjs`
Expected: PASS — `pass 3`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/table.mjs tests/table.test.mjs
git commit -m "feat: add shared trigger-table and skill-list renderers"
```

---

<!-- parallel-group: emitters
     rationale: Each emitter is a pure function in its own file with its own test file; their Files sections are fully disjoint, none reads another's output, all three depend only on lib/table.mjs which Task 5 completed, and none touches package.json or any lockfile. -->

### Task 6: Core emitter → verify: `tests/core.test.mjs` passes; `emit(MODEL)['package.json']` parses as JSON whose `version` is `2.0.0` and whose `files` array contains `skills/`

**Files:**
- Create: `runtimes/core.mjs`
- Test: `tests/core.test.mjs`

`package.json` and the README skill list are not runtime-specific, so they belong to a `core` emitter the driver always loads rather than being arbitrarily assigned to one runtime.

- [ ] **Step 1: Write the failing test**

```js
// tests/core.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { id, emit, regions } from '../runtimes/core.mjs'
import { MODEL } from './helpers.mjs'

test('is identified as core', () => {
  assert.equal(id, 'core')
})

test('composes package.json from the config npm block plus generated fields', () => {
  const pkg = JSON.parse(emit(MODEL)['package.json'])
  assert.equal(pkg.name, '@rizukirr/vibekit')
  assert.equal(pkg.version, '2.0.0')
  assert.equal(pkg.type, 'module')
  assert.equal(pkg.license, 'MIT')
  assert.deepEqual(pkg.publishConfig, { access: 'public' })
  assert.ok(pkg.files.includes('skills/'))
  assert.ok(pkg.files.includes('.claude-plugin/'))
})

test('files[] lists directories, never individual skills', () => {
  const pkg = JSON.parse(emit(MODEL)['package.json'])
  assert.ok(!pkg.files.some(entry => entry.includes('alpha')), 'files[] must not name skills')
})

test('package.json ends with a trailing newline', () => {
  assert.ok(emit(MODEL)['package.json'].endsWith('\n'))
})

test('owns the README skill-list region', () => {
  assert.deepEqual(Object.keys(regions(MODEL)), ['README.md'])
  assert.ok(regions(MODEL)['README.md']['skill-list'].includes('- `alpha` — Alpha does A.'))
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `node --test tests/core.test.mjs`
Expected: FAIL — the suite fails to load with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module ... core.mjs`, reported as `fail 1` (a file that cannot load counts as one failing test, not one per test).

- [ ] **Step 3: Write the implementation**

```js
// runtimes/core.mjs
import { skillList } from '../lib/table.mjs'

export const id = 'core'

// files[] names directories, never individual skills. v1 listed each skill
// explicitly, which meant every new skill needed a package.json edit — and a
// forgotten edit shipped a broken package.
const FILES = [
  '.claude-plugin/',
  '.codex-plugin/',
  'commands/',
  'hooks/',
  'skills/',
  'AGENTS.md',
  'CLAUDE.md',
  'LICENSE',
  'README.md',
]

export function emit(model) {
  const { config } = model
  const pkg = {
    name: config.npm.name,
    version: config.version,
    description: config.description,
    type: config.npm.type,
    license: config.license,
    author: config.author,
    homepage: config.homepage,
    repository: config.repository,
    keywords: config.keywords,
    scripts: config.npm.scripts,
    files: FILES,
    publishConfig: config.npm.publishConfig,
  }
  return { 'package.json': `${JSON.stringify(pkg, null, 2)}\n` }
}

export function regions(model) {
  return { 'README.md': { 'skill-list': skillList(model.skills) } }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `node --test tests/core.test.mjs`
Expected: PASS — `pass 5`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add runtimes/core.mjs tests/core.test.mjs
git commit -m "feat: add core emitter for package.json and README skill list"
```

---

### Task 7: Claude Code emitter → verify: `tests/claude-code.test.mjs` passes; `emit(MODEL)` produces `commands/alpha.md` for the `command: true` skill and no command file for `beta`

**Files:**
- Create: `runtimes/claude-code.mjs`
- Test: `tests/claude-code.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/claude-code.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { id, emit, regions } from '../runtimes/claude-code.mjs'
import { MODEL } from './helpers.mjs'

test('emits the plugin manifest stamped with the config version', () => {
  const plugin = JSON.parse(emit(MODEL)['.claude-plugin/plugin.json'])
  assert.equal(plugin.name, 'vibekit')
  assert.equal(plugin.version, '2.0.0')
  assert.equal(plugin.license, 'MIT')
})

test('emits a marketplace manifest whose version matches the plugin manifest', () => {
  const files = emit(MODEL)
  const plugin = JSON.parse(files['.claude-plugin/plugin.json'])
  const market = JSON.parse(files['.claude-plugin/marketplace.json'])
  assert.equal(market.plugins.length, 1)
  assert.equal(market.plugins[0].version, plugin.version)
  assert.equal(market.plugins[0].source, './')
})

test('emits a SessionStart hook that runs through the polyglot wrapper', () => {
  const hooks = JSON.parse(emit(MODEL)['hooks/hooks.json'])
  const entry = hooks.hooks.SessionStart[0]
  assert.equal(entry.matcher, 'startup|clear|compact')
  assert.match(entry.hooks[0].command, /run-hook\.cmd" session-start$/)
  assert.equal(entry.hooks[0].async, false)
})

test('emits one markdown command per command-enabled skill and no others', () => {
  const files = emit(MODEL)
  assert.ok('commands/alpha.md' in files)
  assert.ok(!('commands/beta.md' in files))
})

test('the command file carries the skill description as frontmatter', () => {
  const command = emit(MODEL)['commands/alpha.md']
  assert.ok(command.startsWith('---\n'))
  assert.ok(command.includes('description: Alpha does A.'))
  assert.ok(command.includes('$ARGUMENTS'))
})

test('owns the CLAUDE.md trigger-table region', () => {
  assert.deepEqual(Object.keys(regions(MODEL)), ['CLAUDE.md'])
  assert.ok(regions(MODEL)['CLAUDE.md']['trigger-table'].includes('| `alpha` | hard |'))
})

test('is identified as claude-code', () => {
  assert.equal(id, 'claude-code')
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `node --test tests/claude-code.test.mjs`
Expected: FAIL — the suite fails to load with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module ... claude-code.mjs`, reported as `fail 1` (a file that cannot load counts as one failing test, not one per test).

- [ ] **Step 3: Write the implementation**

```js
// runtimes/claude-code.mjs
import { triggerTable } from '../lib/table.mjs'

export const id = 'claude-code'

function pluginManifest(config) {
  return {
    name: config.name,
    description: config.description,
    version: config.version,
    author: config.author,
    homepage: config.homepage,
    repository: config.repository,
    license: config.license,
    keywords: config.keywords,
  }
}

function commandFile(skill) {
  return [
    '---',
    `description: ${skill.description}`,
    'argument-hint: <intent>',
    '---',
    '',
    `Invoke the \`${skill.name}\` skill and follow it exactly.`,
    '',
    '**User intent:** $ARGUMENTS',
    '',
  ].join('\n')
}

export function emit(model) {
  const { config, skills } = model
  const json = value => `${JSON.stringify(value, null, 2)}\n`

  const files = {
    '.claude-plugin/plugin.json': json(pluginManifest(config)),
    '.claude-plugin/marketplace.json': json({
      name: `${config.name}-marketplace`,
      description: config.description,
      owner: config.author,
      plugins: [{
        name: config.name,
        description: config.description,
        version: config.version,
        source: './',
        author: config.author,
      }],
    }),
    // The polyglot wrapper is what makes the hook run on Windows; invoking
    // session-start directly works on Unix and silently does nothing on Windows,
    // which leaves every skill inert with no error.
    'hooks/hooks.json': json({
      hooks: {
        SessionStart: [{
          matcher: 'startup|clear|compact',
          hooks: [{
            type: 'command',
            command: '"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" session-start',
            shell: 'bash',
            async: false,
          }],
        }],
      },
    }),
  }

  for (const skill of skills.filter(s => s.command)) {
    files[`commands/${skill.name}.md`] = commandFile(skill)
  }

  return files
}

export function regions(model) {
  return { 'CLAUDE.md': { 'trigger-table': triggerTable(model.skills) } }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `node --test tests/claude-code.test.mjs`
Expected: PASS — `pass 7`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add runtimes/claude-code.mjs tests/claude-code.test.mjs
git commit -m "feat: add claude-code emitter"
```

---

### Task 8: Codex emitter → verify: `tests/codex.test.mjs` passes; `emit(MODEL)` produces `commands/alpha.toml` containing a `description =` line and a `prompt = """` block

**Files:**
- Create: `runtimes/codex.mjs`
- Test: `tests/codex.test.mjs`

The TOML and manifest shapes are taken from the v1 package that shipped and worked, not from documentation. If Codex's format has since moved, this is a data change in one file — which is the property the emitter contract exists to give.

- [ ] **Step 1: Write the failing test**

```js
// tests/codex.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { id, emit, regions } from '../runtimes/codex.mjs'
import { MODEL } from './helpers.mjs'

test('is identified as codex', () => {
  assert.equal(id, 'codex')
})

test('emits a plugin manifest pointing at the shared skills directory', () => {
  const plugin = JSON.parse(emit(MODEL)['.codex-plugin/plugin.json'])
  assert.equal(plugin.version, '2.0.0')
  assert.equal(plugin.skills, './skills/')
  assert.equal(plugin.hooks, './hooks/hooks.json')
})

test('emits one toml command per command-enabled skill and no others', () => {
  const files = emit(MODEL)
  assert.ok('commands/alpha.toml' in files)
  assert.ok(!('commands/beta.toml' in files))
})

test('the toml command carries a description and a prompt block', () => {
  const toml = emit(MODEL)['commands/alpha.toml']
  assert.ok(toml.includes('description = "Alpha does A."'))
  assert.ok(toml.includes('prompt = """'))
  assert.ok(toml.includes('{{args}}'))
})

test('emits no path that the claude-code emitter also emits', () => {
  const codexPaths = Object.keys(emit(MODEL))
  assert.ok(!codexPaths.includes('commands/alpha.md'))
  assert.ok(!codexPaths.includes('hooks/hooks.json'))
})

test('owns the AGENTS.md trigger-table region', () => {
  assert.deepEqual(Object.keys(regions(MODEL)), ['AGENTS.md'])
  assert.ok(regions(MODEL)['AGENTS.md']['trigger-table'].includes('| `beta` | none |'))
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `node --test tests/codex.test.mjs`
Expected: FAIL — the suite fails to load with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module ... codex.mjs`, reported as `fail 1` (a file that cannot load counts as one failing test, not one per test).

- [ ] **Step 3: Write the implementation**

```js
// runtimes/codex.mjs
import { triggerTable } from '../lib/table.mjs'

export const id = 'codex'

// Minimal TOML writer for the two string keys a command file needs. A general
// TOML serializer would be a dependency or a home-grown library; this is the
// shape the format actually requires.
function commandFile(skill) {
  const description = skill.description.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return [
    `description = "${description}"`,
    '',
    'prompt = """',
    `Invoke the \`${skill.name}\` skill and follow it exactly.`,
    '',
    'User intent: {{args}}',
    '"""',
    '',
  ].join('\n')
}

export function emit(model) {
  const { config, skills } = model

  const files = {
    '.codex-plugin/plugin.json': `${JSON.stringify({
      name: config.name,
      version: config.version,
      description: config.description,
      author: config.author,
      homepage: config.homepage,
      repository: config.repository,
      license: config.license,
      keywords: config.keywords,
      skills: './skills/',
      hooks: './hooks/hooks.json',
    }, null, 2)}\n`,
  }

  for (const skill of skills.filter(s => s.command)) {
    files[`commands/${skill.name}.toml`] = commandFile(skill)
  }

  return files
}

export function regions(model) {
  return { 'AGENTS.md': { 'trigger-table': triggerTable(model.skills) } }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `node --test tests/codex.test.mjs`
Expected: PASS — `pass 6`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add runtimes/codex.mjs tests/codex.test.mjs
git commit -m "feat: add codex emitter"
```

<!-- /parallel-group -->

---

### Task 9: Driver core → verify: `tests/build.test.mjs` reports `pass 10`; `mergeEmitters` throws naming both emitters when two claim the same path, and `planChanges` never lists a removal absent from the previous manifest

**Files:**
- Create: `lib/build.mjs`
- Test: `tests/build.test.mjs`

`build()` returns the in-memory path→contents map. `plan()` compares it against disk. Because both modes read the same map, `--check` cannot disagree with what `generate` would write.

- [ ] **Step 1: Write the failing test**

```js
// tests/build.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync, cpSync } from 'node:fs'
import { join } from 'node:path'
import { build, mergeEmitters, planChanges } from '../lib/build.mjs'
import { makeSkillsDir, skillFile, MODEL } from './helpers.mjs'

const alpha = { id: 'alpha', emit: () => ({ 'a.json': '1\n' }) }
const beta = { id: 'beta', emit: () => ({ 'b.json': '2\n' }) }
const clash = { id: 'clash', emit: () => ({ 'a.json': '3\n' }) }

test('merges disjoint emitter output', () => {
  const { files } = mergeEmitters([alpha, beta], MODEL)
  assert.deepEqual(files, { 'a.json': '1\n', 'b.json': '2\n' })
})

test('throws naming both emitters when two claim the same path', () => {
  assert.throws(() => mergeEmitters([alpha, clash], MODEL), /'a\.json' emitted by both 'alpha' and 'clash'/)
})

test('records which emitter owns each path', () => {
  const { owner } = mergeEmitters([alpha, beta], MODEL)
  assert.equal(owner['a.json'], 'alpha')
})

test('reports a file whose content differs as drift', () => {
  const changes = planChanges({ 'a.json': 'new\n' }, { read: () => 'old\n' }, [])
  assert.deepEqual(changes.write, ['a.json'])
  assert.deepEqual(changes.remove, [])
})

test('reports a missing file as drift', () => {
  const changes = planChanges({ 'a.json': 'new\n' }, { read: () => null }, [])
  assert.deepEqual(changes.write, ['a.json'])
})

test('reports no drift when content already matches', () => {
  const changes = planChanges({ 'a.json': 'same\n' }, { read: () => 'same\n' }, [])
  assert.deepEqual(changes.write, [])
})

test('removes a previously generated path that is no longer emitted', () => {
  const changes = planChanges({ 'a.json': 'x\n' }, { read: () => 'x\n' }, ['a.json', 'gone.md'])
  assert.deepEqual(changes.remove, ['gone.md'])
})

test('never removes a path absent from the previous manifest', () => {
  const changes = planChanges({}, { read: () => 'x\n' }, [])
  assert.deepEqual(changes.remove, [])
})

test('loads core plus every configured runtime, in that order', async () => {
  const { emitters } = await build(process.cwd())
  assert.deepEqual(emitters.map(e => e.id), ['core', 'claude-code', 'codex'])
})

test('throws when the config names an emitter that does not exist', async () => {
  const { root, cleanup } = makeSkillsDir({ 'using-vibekit': skillFile({ name: 'using-vibekit' }) })
  try {
    writeFileSync(join(root, 'vibekit.config.json'), JSON.stringify({
      ...MODEL.config, runtimes: ['no-such-runtime'],
    }))
    mkdirSync(join(root, 'skills'), { recursive: true })
    cpSync(join(root, 'using-vibekit'), join(root, 'skills', 'using-vibekit'), { recursive: true })
    await assert.rejects(() => build(root), /runtimes\/no-such-runtime\.mjs could not be loaded/)
  } finally { cleanup() }
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `node --test tests/build.test.mjs`
Expected: FAIL — the suite fails to load with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module ... build.mjs`, reported as `fail 1` (a file that cannot load counts as one failing test, not one per test).

- [ ] **Step 3: Write the implementation**

```js
// lib/build.mjs
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildModel } from './model.mjs'
import { applyRegion } from './markers.mjs'

export const MANIFEST = '.vibekit-manifest'

// Merges each emitter's path→contents map. Two emitters claiming one path is an
// error rather than last-write-wins: a silent overwrite is precisely the kind of
// drift this generator exists to prevent.
export function mergeEmitters(emitters, model) {
  const files = {}
  const owner = {}
  for (const emitter of emitters) {
    for (const [path, contents] of Object.entries(emitter.emit(model))) {
      if (path in files) {
        throw new Error(`'${path}' emitted by both '${owner[path]}' and '${emitter.id}'`)
      }
      files[path] = contents
      owner[path] = emitter.id
    }
  }
  return { files, owner }
}

export function applyRegions(emitters, model, files, owner, io) {
  for (const emitter of emitters) {
    if (!emitter.regions) continue
    for (const [path, regions] of Object.entries(emitter.regions(model))) {
      if (path in files) {
        throw new Error(`'${path}' is claimed by both '${owner[path]}' and '${emitter.id}'`)
      }
      let text = io.read(path)
      if (text === null) throw new Error(`'${path}' has a generated region but does not exist`)
      for (const [id, content] of Object.entries(regions)) text = applyRegion(text, id, content)
      files[path] = text
      owner[path] = emitter.id
    }
  }
  return files
}

// Compares the in-memory map against disk. `previous` is the manifest from the
// last run; only paths it lists are eligible for removal, so the generator can
// never delete a file it did not create.
export function planChanges(files, io, previous) {
  const write = []
  for (const [path, contents] of Object.entries(files)) {
    if (io.read(path) !== contents) write.push(path)
  }
  const emitted = new Set(Object.keys(files))
  const remove = previous.filter(path => !emitted.has(path))
  return { write, remove }
}

export async function build(root) {
  const config = JSON.parse(readFileSync(join(root, 'vibekit.config.json'), 'utf8'))
  const model = buildModel(config, join(root, 'skills'))

  const emitters = []
  for (const id of ['core', ...config.runtimes]) {
    let module
    try {
      module = await import(new URL(`../runtimes/${id}.mjs`, import.meta.url))
    } catch (error) {
      throw new Error(`runtimes/${id}.mjs could not be loaded: ${error.message}`)
    }
    if (module.id !== id) throw new Error(`runtimes/${id}.mjs exports id '${module.id}'`)
    emitters.push(module)
  }

  return { emitters, model }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `node --test tests/build.test.mjs`
Expected: PASS — `pass 10`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add lib/build.mjs tests/build.test.mjs
git commit -m "feat: add driver core with collision detection and drift planning"
```

---

### Task 10: Generator CLI and first generation → verify: `npm run generate` then `npm run check` exits 0 printing `up to date`; `.claude-plugin/plugin.json` contains `"version": "2.0.0"`; `git diff --exit-code package.json` shows no change against the Task 1 seed

**Files:**
- Create: `bin/generate.mjs`
- Generated (committed this task): `.vibekit-manifest`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json`, `hooks/hooks.json`, `commands/example-command.md`, `commands/example-command.toml`, and updated regions in `CLAUDE.md`, `AGENTS.md`, `README.md`

The `git diff --exit-code package.json` clause is the real proof: the generator must reproduce the hand-written seed byte-for-byte, which fails loudly if any emitter is a stub.

- [ ] **Step 1: Write the CLI**

```js
#!/usr/bin/env node
// bin/generate.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, mergeEmitters, applyRegions, planChanges, MANIFEST } from '../lib/build.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const check = process.argv.includes('--check')

const io = {
  read(path) {
    try { return readFileSync(join(ROOT, path), 'utf8') } catch { return null }
  },
}

const { emitters, model } = await build(ROOT)
const { files, owner } = mergeEmitters(emitters, model)
applyRegions(emitters, model, files, owner, io)

const previous = (io.read(MANIFEST) ?? '').split('\n').filter(Boolean)
files[MANIFEST] = `${Object.keys(files).sort().join('\n')}\n`

const { write, remove } = planChanges(files, io, previous)

if (check) {
  if (write.length === 0 && remove.length === 0) {
    console.log('up to date')
    process.exit(0)
  }
  console.error('generated files are out of date:')
  for (const path of write) console.error(`  stale: ${path}`)
  for (const path of remove) console.error(`  orphan: ${path}`)
  console.error('run: npm run generate')
  process.exit(1)
}

for (const path of write) {
  const absolute = join(ROOT, path)
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, files[path])
  console.log(`wrote ${path}`)
}
for (const path of remove) {
  if (existsSync(join(ROOT, path))) {
    rmSync(join(ROOT, path))
    console.log(`removed ${path}`)
  }
}
console.log('done')
```

- [ ] **Step 2: Run the generator**

Run: `npm run generate`
Expected: a `wrote <path>` line for each generated file, then `done`. `package.json` may or may not appear — it appears only if the generated content differs from the Task 1 seed.

- [ ] **Step 3: Confirm the generator reproduces the hand-written package.json**

Run: `git diff --exit-code package.json`
Expected: exit code 0, no output. If this fails, the `core` emitter and the Task 1 seed disagree — fix the emitter to match the seed, or correct the seed if the emitter is right, then re-run Step 2.

- [ ] **Step 4: Confirm the run is idempotent and check mode agrees**

Run: `npm run check`
Expected: `up to date`, exit code 0.

- [ ] **Step 5: Confirm the version was actually stamped**

Run: `node -e "const p=require('./.claude-plugin/plugin.json');const m=require('./.claude-plugin/marketplace.json');const c=require('./vibekit.config.json');if(p.version!==c.version||m.plugins[0].version!==c.version)throw new Error('version not stamped');console.log('version ok: '+p.version)"`
Expected: `version ok: 2.0.0`

- [ ] **Step 6: Confirm the fixture skills produced the right command files**

Run: `ls commands/`
Expected: exactly `example-command.md` and `example-command.toml`. No file for `example-plain` or `using-vibekit`.

- [ ] **Step 7: Commit**

```bash
git add bin/generate.mjs .vibekit-manifest .claude-plugin .codex-plugin commands hooks/hooks.json CLAUDE.md AGENTS.md README.md package.json
git commit -m "feat: add generator CLI and commit first generated output"
```

---

### Task 11: SessionStart hook → verify: `npm run check:hook` passes; the hook's stdout parses as JSON whose `hookSpecificOutput.additionalContext` contains the text `using-vibekit`

**Files:**
- Create: `hooks/session-start`
- Create: `hooks/run-hook.cmd`
- Test: `tests/hook.test.mjs`

The hook is the entire integration. If it fails to execute, every skill is inert with no visible error — which is why this gets a test that actually runs it rather than a code review.

- [ ] **Step 1: Write the failing test**

```js
// tests/hook.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const config = JSON.parse(readFileSync('vibekit.config.json', 'utf8'))

function runHook(env) {
  const command = process.platform === 'win32'
    ? { file: 'hooks\\run-hook.cmd', args: ['session-start'], shell: true }
    : { file: 'bash', args: ['hooks/run-hook.cmd', 'session-start'], shell: false }
  return execFileSync(command.file, command.args, {
    encoding: 'utf8',
    shell: command.shell,
    env: { ...process.env, ...env },
  })
}

test('emits Claude Code shaped context containing the bootstrap skill', () => {
  const parsed = JSON.parse(runHook({ CLAUDE_PLUGIN_ROOT: process.cwd(), COPILOT_CLI: '' }))
  const context = parsed.hookSpecificOutput.additionalContext
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart')
  assert.ok(context.includes(config.bootstrap), 'context must name the bootstrap skill')
  assert.ok(context.includes('auto-trigger discipline'), 'context must carry the skill body')
})

test('emits the SDK-standard shape when no platform variable is set', () => {
  const parsed = JSON.parse(runHook({ CLAUDE_PLUGIN_ROOT: '', CURSOR_PLUGIN_ROOT: '' }))
  assert.ok('additionalContext' in parsed)
  assert.ok(!('hookSpecificOutput' in parsed))
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm run check:hook`
Expected: FAIL — both tests error because `hooks/run-hook.cmd` does not exist.

- [ ] **Step 3: Write the polyglot wrapper**

This file is simultaneously a valid Windows batch file and a valid bash script. On Windows, `cmd.exe` runs the batch half and locates bash; on Unix, `:` is a no-op and the heredoc hides the batch text. The extensionless hook filename is deliberate — Claude Code's Windows auto-detection prepends `bash` to any command containing `.sh`.

```bash
: << 'CMDBLOCK'
@echo off
REM Cross-platform wrapper for hook scripts.
REM Usage: run-hook.cmd <script-name> [args...]

if "%~1"=="" (
    echo run-hook.cmd: missing script name >&2
    exit /b 1
)

set "HOOK_DIR=%~dp0"

if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)
if exist "C:\Program Files (x86)\Git\bin\bash.exe" (
    "C:\Program Files (x86)\Git\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)

where bash >nul 2>nul
if %ERRORLEVEL% equ 0 (
    bash "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)

REM No bash found - exit silently rather than error.
exit /b 0
CMDBLOCK

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_NAME="$1"
shift
exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
```

- [ ] **Step 4: Write the hook**

The bootstrap skill name is read from `vibekit.config.json` rather than hardcoded, so renaming it in spec 2 needs no hook edit.

```bash
#!/usr/bin/env bash
# SessionStart hook: injects the bootstrap skill as session context.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Read the bootstrap skill name out of the config without a JSON parser.
bootstrap=$(sed -n 's/.*"bootstrap"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    "${PLUGIN_ROOT}/vibekit.config.json" | head -n 1)
if [ -z "$bootstrap" ]; then
    exit 0
fi

content=$(cat "${PLUGIN_ROOT}/skills/${bootstrap}/SKILL.md" 2>/dev/null || echo "")
if [ -z "$content" ]; then
    exit 0
fi

# Escape for JSON embedding. Each substitution is a single C-level pass.
escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

escaped=$(escape_for_json "$content")
context="<EXTREMELY_IMPORTANT>\nYou have vibekit.\n\n**Below is the full content of the '${bootstrap}' skill. For all other skills, use the 'Skill' tool:**\n\n${escaped}\n</EXTREMELY_IMPORTANT>"

# Each platform reads a different field, and Claude Code reads more than one
# without deduplicating, so exactly one shape is emitted per platform.
if [ -n "${CURSOR_PLUGIN_ROOT:-}" ]; then
    printf '{\n  "additional_context": "%s"\n}\n' "$context"
elif [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -z "${COPILOT_CLI:-}" ]; then
    printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "SessionStart",\n    "additionalContext": "%s"\n  }\n}\n' "$context"
else
    printf '{\n  "additionalContext": "%s"\n}\n' "$context"
fi

exit 0
```

- [ ] **Step 5: Make the hook scripts executable**

```bash
chmod +x hooks/session-start hooks/run-hook.cmd
```

- [ ] **Step 6: Add the phrase the test asserts on to the bootstrap skill**

The test asserts the injected context carries the skill body, not just its name. Confirm `skills/using-vibekit/SKILL.md` contains the words `auto-trigger discipline` — it does, in the `description` line written in Task 1. No edit needed unless that line was changed.

Run: `grep -c "auto-trigger discipline" skills/using-vibekit/SKILL.md`
Expected: `1`

- [ ] **Step 7: Run the test to confirm it passes**

Run: `npm run check:hook`
Expected: PASS — `pass 2`, `fail 0`.

- [ ] **Step 8: Confirm the hook did not disturb generated output**

Run: `npm run check`
Expected: `up to date`, exit code 0.

- [ ] **Step 9: Commit**

```bash
git add hooks/session-start hooks/run-hook.cmd tests/hook.test.mjs
git commit -m "feat: add SessionStart hook and polyglot windows wrapper"
```

---

### Task 12: CI wiring → verify: `tests/ci.test.mjs` passes, asserting every `npm run` script named in `.github/workflows/ci.yml` exists in the generated `package.json`; and `npm test` reports `fail 0` across all suites

**Files:**
- Modify: `.github/workflows/ci.yml`
- Test: `tests/ci.test.mjs`

The workflow's own behavior can only be observed on a GitHub runner, so the checkable local criterion is that it invokes scripts that actually exist — the failure mode that silently broke CI when v1's scripts were deleted.

- [ ] **Step 1: Write the failing test**

```js
// tests/ci.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')
const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts

test('every npm script the workflow runs exists in package.json', () => {
  const invoked = [...workflow.matchAll(/run:\s*npm run ([\w:]+)/g)].map(match => match[1])
  assert.ok(invoked.length > 0, 'workflow must invoke at least one npm script')
  for (const name of invoked) {
    assert.ok(name in scripts, `workflow runs "npm run ${name}" but package.json has no such script`)
  }
})

test('the workflow runs the drift check, the unit tests, and the hook check', () => {
  assert.match(workflow, /npm run check\b/)
  assert.match(workflow, /npm test\b/)
  assert.match(workflow, /npm run check:hook\b/)
})

test('the hook job runs on windows as well as ubuntu', () => {
  assert.match(workflow, /windows-latest/)
  assert.match(workflow, /ubuntu-latest/)
})

test('no dependency install step is needed', () => {
  assert.ok(!workflow.includes('npm ci'), 'the repo ships no dependencies')
  assert.ok(!workflow.includes('npm install'), 'the repo ships no dependencies')
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `node --test tests/ci.test.mjs`
Expected: FAIL — at least one assertion fails, because the existing workflow invokes `npm run check:json`, `check:versions`, and the other v1 script names that no longer exist.

- [ ] **Step 3: Rewrite the workflow**

```yaml
name: CI

on:
  push:
    branches: [main, v2]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'

      # The repo ships no dependencies; every check runs on a bare node.
      - name: Check generated files are up to date
        run: npm run check

      - name: Run unit tests
        run: npm test

  hook:
    name: hook (${{ matrix.os }})
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'

      # The SessionStart hook is the entire integration: if it fails to execute,
      # every skill is inert with no visible error. The windows-latest leg is the
      # only machine-executed proof that the polyglot wrapper's batch half works;
      # nothing on a Unix dev box can verify it.
      - name: Smoke-test the SessionStart hook
        run: npm run check:hook
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `node --test tests/ci.test.mjs`
Expected: PASS — `pass 4`, `fail 0`.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — `fail 0` across every suite.

- [ ] **Step 6: Confirm the tree is fully generated**

Run: `npm run check`
Expected: `up to date`, exit code 0.

- [ ] **Step 7: Prove the core promise — adding a skill touches one directory**

```bash
mkdir -p skills/scratch-probe
printf -- '---\nname: scratch-probe\ndescription: Temporary probe.\ntrigger: Never\n---\n\nbody\n' > skills/scratch-probe/SKILL.md
npm run check
```

Expected: exit code 1, listing `CLAUDE.md`, `AGENTS.md`, and `README.md` as stale — proving the new skill propagated to every surface with no other file edited.

```bash
rm -rf skills/scratch-probe
npm run check
```

Expected: `up to date`, exit code 0.

- [ ] **Step 8: Commit**

```bash
git add .github/workflows/ci.yml tests/ci.test.mjs
git commit -m "ci: run drift check, unit tests, and two-OS hook smoke test"
```
