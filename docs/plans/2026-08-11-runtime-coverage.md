# runtime coverage — Implementation Plan

**Spec:** docs/specs/2026-08-11-runtime-coverage-design.md
**Goal:** Make vibekit v2 installable on Claude Code, Codex, opencode, Gemini and Pi, probing the two runtimes installed on this machine and claiming nothing about the two that are not.
**Architecture:** `lib/build.mjs` gains one merge step that collects optional `pkg()` and `ships()` exports from every emitter and hands the result to `runtimes/core.mjs`, which owns `package.json`. Each runtime then arrives as one file under `runtimes/` plus one id in `vibekit.config.json`, with no further edit to core.

## Global constraints
- Dependency free. Bare Node, plus whichever runtime CLI a probe uses.
- No shipped file under `skills/`, and none of the generated context files, may name a project vibekit borrows from.
- Generated files are never hand-edited.
- Two emitters claiming one path is an error, not last-write-wins.
- `evals/` never ships.
- No paid eval run.
- A probe records every configuration change it makes and states the one command that restores the previous state.

### Task 1: the contribution merge points → verify: `npm test` exits 0

**Files:**
- Modify: `lib/build.mjs:25`
- Modify: `runtimes/core.mjs:21-39`
- Modify: `tests/build.test.mjs:99`
- Modify: `tests/core.test.mjs:41`
- Modify: `package.json`

- [x] Step 1: Append to `tests/build.test.mjs`, and observe each failing before
      Step 3 is written:

```js
const withPkg = { id: 'withPkg', emit: () => ({}), pkg: () => ({ main: './x.js' }), ships: () => ['.x/'] }
const alsoPkg = { id: 'alsoPkg', emit: () => ({}), pkg: () => ({ main: './y.js' }) }
const withShips = { id: 'withShips', emit: () => ({}), ships: () => ['.y/', '.x/'] }

test('collects pkg contributions from every emitter', () => {
  const { pkg } = mergeContributions([alpha, withPkg], MODEL)
  assert.deepEqual(pkg, { main: './x.js' })
})

test('throws naming both emitters when two claim the same package.json key', () => {
  assert.throws(() => mergeContributions([withPkg, alsoPkg], MODEL), /'main' contributed by both 'withPkg' and 'alsoPkg'/)
})

test('ships entries are merged, sorted and de-duplicated', () => {
  const { ships } = mergeContributions([withPkg, withShips], MODEL)
  assert.deepEqual(ships, ['.x/', '.y/'])
})

test('an emitter exporting neither contributes nothing', () => {
  const { pkg, ships } = mergeContributions([alpha, beta], MODEL)
  assert.deepEqual(pkg, {})
  assert.deepEqual(ships, [])
})
```

- [x] Step 2: Append to `tests/core.test.mjs`, and observe both failing:

```js
test('merges contributed package.json keys', () => {
  const model = { ...MODEL, contributions: { pkg: { main: './p.js' }, ships: [] } }
  const pkg = JSON.parse(emit(model)['package.json'])
  assert.equal(pkg.main, './p.js')
})

test('merges contributed paths into the files allowlist', () => {
  const model = { ...MODEL, contributions: { pkg: {}, ships: ['.agents/'] } }
  const pkg = JSON.parse(emit(model)['package.json'])
  assert.ok(pkg.files.includes('.agents/'))
  assert.ok(pkg.files.includes('skills/'), 'the base allowlist survives')
})
```

- [x] Step 3: Run `npm test` and record which of the six fail and with what
      message. A test that passes before the change is written is not a check.
- [x] Step 4: In `lib/build.mjs`, add after `mergeEmitters`:

```js
// The second merge point. `emit` returns files; `pkg` and `ships` return
// fragments of a file another emitter owns, which the path-collision rule
// cannot express. Same discipline: a key claimed twice is an error, because a
// silent overwrite is the drift this generator exists to prevent.
export function mergeContributions(emitters, model) {
  const pkg = {}
  const owner = {}
  const ships = new Set()
  for (const emitter of emitters) {
    for (const [key, value] of Object.entries(emitter.pkg?.(model) ?? {})) {
      if (key in pkg) {
        throw new Error(`'${key}' contributed by both '${owner[key]}' and '${emitter.id}'`)
      }
      pkg[key] = value
      owner[key] = emitter.id
    }
    for (const path of emitter.ships?.(model) ?? []) ships.add(path)
  }
  return { pkg, ships: [...ships].sort() }
}
```

- [x] Step 5: In `lib/build.mjs`, inside `build`, between `loadEmitters` and
      `mergeEmitters`, attach the contributions to the model so `core` — which
      owns `package.json` but cannot see its sibling emitters — can read them:

```js
  model.contributions = mergeContributions(emitters, model)
```

- [x] Step 6: In `runtimes/core.mjs`, replace the `emit` function body so the
      contributions are merged in. Leave `FILES` and every other key as they are:

```js
export function emit(model) {
  const { config } = model
  const { pkg: contributed = {}, ships = [] } = model.contributions ?? {}
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
    engines: config.npm.engines,
    scripts: config.npm.scripts,
    files: [...new Set([...FILES, ...ships])].sort(),
    publishConfig: config.npm.publishConfig,
    ...contributed,
  }
  return { 'package.json': `${JSON.stringify(pkg, null, 2)}\n` }
}
```

- [x] Step 7: Run `npm test`
- [x] Step 8: Run `npm run generate`, then `git diff package.json` and confirm
      the only change is `files[]` becoming sorted.
- [x] Step 9: Commit

### Task 2: the Codex marketplace manifest → verify: `node -e "process.exit(require('./.agents/plugins/marketplace.json').plugins[0].name === 'vibekit' ? 0 : 1)"` exits 0

**Files:**
- Modify: `runtimes/codex.mjs:23-46`
- Modify: `tests/codex.test.mjs`
- Create: `.agents/plugins/marketplace.json`
- Modify: `package.json`
- Modify: `.vibekit-manifest`

- [x] Step 1: Append to `tests/codex.test.mjs`, and observe both failing:

```js
test('emits the marketplace manifest Codex resolves a plugin through', () => {
  const manifest = JSON.parse(emit(MODEL)['.agents/plugins/marketplace.json'])
  assert.equal(manifest.name, 'vibekit')
  assert.equal(manifest.plugins[0].name, 'vibekit')
  assert.deepEqual(manifest.plugins[0].source, { source: 'local', path: './' })
})

test('ships the marketplace directory', () => {
  assert.ok(ships(MODEL).includes('.agents/'))
})
```

- [x] Step 2: Run `npm test` and record the failures.
- [x] Step 3: In `runtimes/codex.mjs`, add to the `files` object inside `emit`,
      alongside the existing `.codex-plugin/plugin.json` entry:

```js
    // Codex resolves a marketplace through this path, not through
    // .codex-plugin/plugin.json. Confirmed 2026-08-11 against codex-cli 0.147.0:
    // without it `codex plugin marketplace add` has nothing to read.
    '.agents/plugins/marketplace.json': `${JSON.stringify({
      name: config.name,
      interface: { displayName: config.name },
      plugins: [{
        name: config.name,
        source: { source: 'local', path: './' },
        policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
        category: 'Productivity',
      }],
    }, null, 2)}\n`,
```

- [x] Step 4: In `runtimes/codex.mjs`, export the allowlist contribution:

```js
export function ships() {
  return ['.agents/']
}
```

- [x] Step 5: Run `npm test`, then `npm run generate`
- [x] Step 6: Commit

### Task 3: probe Codex → verify: `codex plugin list | grep -q "vibekit@vibekit .*installed"` exits 0

**Files:**
- None. This task changes no file in the repository.

The marketplace name comes from the manifest's `name`, which is `vibekit`, and a
marketplace of that name is already configured from
`https://github.com/rizukirr/vibekit.git` — recorded in `~/.codex/config.toml`
under `[marketplaces.vibekit]`. The two cannot coexist, so this task replaces it.
Restoring the previous state is one command:
`codex plugin marketplace add https://github.com/rizukirr/vibekit.git`.

- [x] Step 1: Run `codex plugin list` and record, verbatim, the row for the
      currently installed vibekit plugin and its version column.
- [x] Step 2: Run `codex plugin marketplace remove vibekit`
- [x] Step 3: Run `codex plugin marketplace add /home/rizukirr/Projects/vibekit`
- [x] Step 4: Run `codex plugin add vibekit@vibekit` and record its output
      verbatim.
- [x] Step 5: Run `codex plugin list` and record the vibekit row verbatim,
      including its version column. A version other than the one in
      `vibekit.config.json` means the manifest resolved to something else; stop
      and report rather than reinstalling.
- [x] Step 6: No commit — nothing in the repository changed.

### Task 4: the opencode runtime → verify: `npm test` exits 0

**Files:**
- Create: `runtimes/opencode.mjs`
- Create: `tests/opencode.test.mjs`
- Modify: `vibekit.config.json:10`
- Create: `.opencode/plugins/vibekit.js`
- Create: `.opencode/INSTALL.md`
- Modify: `package.json`
- Modify: `.vibekit-manifest`

- [ ] Step 1: Write `tests/opencode.test.mjs`, and observe it failing:

```js
// tests/opencode.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { id, emit, pkg, ships } from '../runtimes/opencode.mjs'
import { MODEL } from './helpers.mjs'

test('is identified as opencode', () => {
  assert.equal(id, 'opencode')
})

test('emits a plugin entry point and its install document', () => {
  const files = emit(MODEL)
  assert.ok('.opencode/plugins/vibekit.js' in files)
  assert.ok('.opencode/INSTALL.md' in files)
})

// opencode resolves a git-installed plugin through package.json main. v1
// shipped the plugin file with no main key, so nothing ever loaded it.
test('contributes the main key that makes the plugin reachable', () => {
  assert.equal(pkg(MODEL).main, './.opencode/plugins/vibekit.js')
})

test('registers the skills directory rather than parsing frontmatter', () => {
  const source = emit(MODEL)['.opencode/plugins/vibekit.js']
  assert.match(source, /config\.skills\.paths/)
  assert.doesNotMatch(source, /frontmatter/i)
})

test('ships the plugin directory', () => {
  assert.ok(ships(MODEL).includes('.opencode/'))
})
```

- [ ] Step 2: Run `npm test` and record the failure.
- [ ] Step 3: Write `runtimes/opencode.mjs`:

```js
// runtimes/opencode.mjs
export const id = 'opencode'

// opencode discovers skills through config.skills.paths. Pushing the plugin's
// own skills directory there is the whole integration: the runtime has native
// skill support, so parsing SKILL.md here would re-implement a feature the
// host already has.
const PLUGIN = `// Generated by vibekit. Do not edit.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../skills')

export const VibekitPlugin = async () => ({
  config: async config => {
    config.skills ??= {}
    config.skills.paths ??= []
    if (!config.skills.paths.includes(SKILLS)) config.skills.paths.push(SKILLS)
  },
})
`

function installDoc(config) {
  return [
    `# Installing ${config.name} for opencode`,
    '',
    'Add it to the `plugin` array in your `opencode.json`, global or project-level:',
    '',
    '```json',
    '{',
    `  "plugin": ["${config.name}@git+${config.repository}.git"]`,
    '}',
    '```',
    '',
    'Restart opencode. Verify with:',
    '',
    '```',
    'opencode debug skill',
    '```',
    '',
    'Each runtime installs separately; installing here does not affect any other.',
    '',
  ].join('\n')
}

export function emit(model) {
  return {
    '.opencode/plugins/vibekit.js': PLUGIN,
    '.opencode/INSTALL.md': installDoc(model.config),
  }
}

export function pkg() {
  return { main: './.opencode/plugins/vibekit.js' }
}

export function ships() {
  return ['.opencode/']
}
```

- [ ] Step 4: In `vibekit.config.json`, add `"opencode"` to the `runtimes` array,
      after `"codex"`.
- [ ] Step 5: Run `npm test`, then `npm run generate`
- [ ] Step 6: Commit

### Task 5: probe opencode → verify: `sh -c "cd /tmp/vibekit-opencode-probe && opencode debug skill" | grep -q brainstorm` exits 0

**Files:**
- None. This task changes no file in the repository.

The probe directory is left in place so the clause stays re-runnable. It is
outside the repository and holds one file; deleting it is `rm -rf
/tmp/vibekit-opencode-probe`.

- [ ] Step 1: Create `/tmp/vibekit-opencode-probe` and write `opencode.json` in
      it:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["/home/rizukirr/Projects/vibekit"]
}
```

- [ ] Step 2: Run `opencode debug skill` in that directory and record its output
      verbatim.
- [ ] Step 3: Confirm the output names `brainstorm`. If it does not, stop: the
      plugin does not load, and that is a `debug` question, not a retry. Record
      what the output did contain.
- [ ] Step 4: No commit — nothing in the repository changed.

### Task 6: the Gemini runtime → verify: `npm test` exits 0

**Files:**
- Create: `runtimes/gemini.mjs`
- Create: `tests/gemini.test.mjs`
- Create: `GEMINI.md`
- Modify: `vibekit.config.json:10`
- Create: `gemini-extension.json`
- Modify: `package.json`
- Modify: `.vibekit-manifest`

- [ ] Step 1: Write `tests/gemini.test.mjs`, and observe it failing:

```js
// tests/gemini.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { id, emit, ships, regions } from '../runtimes/gemini.mjs'
import { MODEL } from './helpers.mjs'

test('is identified as gemini', () => {
  assert.equal(id, 'gemini')
})

test('emits an extension manifest pointing at the context file', () => {
  const manifest = JSON.parse(emit(MODEL)['gemini-extension.json'])
  assert.equal(manifest.name, 'vibekit')
  assert.equal(manifest.contextFileName, 'GEMINI.md')
  assert.equal(manifest.version, '2.0.0')
})

test('claims the context file as a generated region', () => {
  assert.ok('trigger-table' in regions(MODEL)['GEMINI.md'])
})

test('ships both the manifest and the context file', () => {
  const paths = ships(MODEL)
  assert.ok(paths.includes('gemini-extension.json'))
  assert.ok(paths.includes('GEMINI.md'))
})
```

- [ ] Step 2: Run `npm test` and record the failure.
- [ ] Step 3: Write `GEMINI.md` by hand — it is a skeleton carrying a generated
      region, exactly as `AGENTS.md` is, and the generator refuses a region whose
      file does not exist:

```markdown
# vibekit

Guardrailed vibe-coding pipeline. Skills are referenced from this file and
invoked by following the named workflow.

## Auto-trigger map

<!-- vibekit:generated:trigger-table -->
<!-- /vibekit:generated -->
```

- [ ] Step 4: Write `runtimes/gemini.mjs`:

```js
// runtimes/gemini.mjs
import { triggerTable } from '../lib/table.mjs'

export const id = 'gemini'

export function emit(model) {
  const { config } = model
  return {
    'gemini-extension.json': `${JSON.stringify({
      name: config.name,
      description: config.description,
      version: config.version,
      contextFileName: 'GEMINI.md',
    }, null, 2)}\n`,
  }
}

export function ships() {
  return ['gemini-extension.json', 'GEMINI.md']
}

export function regions(model) {
  return { 'GEMINI.md': { 'trigger-table': triggerTable(model.skills) } }
}
```

- [ ] Step 5: In `vibekit.config.json`, add `"gemini"` to the `runtimes` array,
      after `"opencode"`.
- [ ] Step 6: Run `npm test`, then `npm run generate`
- [ ] Step 7: Commit

### Task 7: the Pi runtime → verify: `node -e "process.exit(Array.isArray(require('./package.json').pi.skills) ? 0 : 1)"` exits 0

**Files:**
- Create: `runtimes/pi.mjs`
- Create: `tests/pi.test.mjs`
- Modify: `vibekit.config.json:10`
- Modify: `package.json`

- [ ] Step 1: Write `tests/pi.test.mjs`, and observe it failing:

```js
// tests/pi.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { id, emit, pkg } from '../runtimes/pi.mjs'
import { MODEL } from './helpers.mjs'

test('is identified as pi', () => {
  assert.equal(id, 'pi')
})

// Pi has native skills, so the package.json block is the whole integration.
// v1 shipped a .pi-plugin/ directory that nothing reads.
test('contributes a skills block and emits no files', () => {
  assert.deepEqual(pkg(MODEL).pi, { skills: ['./skills'] })
  assert.deepEqual(emit(MODEL), {})
})
```

- [ ] Step 2: Run `npm test` and record the failure.
- [ ] Step 3: Write `runtimes/pi.mjs`:

```js
// runtimes/pi.mjs
export const id = 'pi'

// Pi reads a `pi` block from package.json and has native skill support, so a
// skills path is the entire integration. Session-start priming would need an
// extension, which is deferred: it cannot be verified without a Pi install.
export function emit() {
  return {}
}

export function pkg() {
  return { pi: { skills: ['./skills'] } }
}
```

- [ ] Step 4: In `vibekit.config.json`, add `"pi"` to the `runtimes` array, after
      `"gemini"`.
- [ ] Step 5: Run `npm test`, then `npm run generate`
- [ ] Step 6: Commit

### Task 8: the support table → verify: `npm run check` exits 0

**Files:**
- Modify: `README.md:20-29`
- Modify: `.vibekit-manifest`

- [ ] Step 1: Replace the runtime support table and the paragraph beneath it with
      a five-row table. Each row names the runtime, its emitter, and how it was
      verified — for the two probed runtimes, the tool version the probe ran
      against, taken from the output recorded in Tasks 3 and 5; for the two that
      were not, the words `not verified — tool not installed`. Do not restate a
      version from memory: read it from the recorded probe output.
- [ ] Step 2: Run `npm run generate`, then `npm test`
- [ ] Step 3: Run `npm pack --dry-run` and confirm the listing includes a path
      under `.agents/`, a path under `.opencode/`, `gemini-extension.json` and
      `GEMINI.md`.
- [ ] Step 4: Commit

_Amended 2026-08-11 during execution: generated files were missing from the Files blocks. `npm run generate` rewrites `package.json` and `.vibekit-manifest` on every task that adds an emitter or an emitted path, so a task that regenerates and does not claim them trips the scope check._
