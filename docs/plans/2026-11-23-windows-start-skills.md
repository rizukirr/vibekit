# windows start skills: Implementation Plan

**Spec:** docs/specs/2026-11-23-windows-start-skills-design.md
**Goal:** Every runtime starts each session with the full text of `quick`, `lazy`, `plain` and `terse`, the edit guard and `using-vibekit` are gone, and the Windows failures in CRLF handling, the agy hook command and the Codex hook command are fixed.
**Architecture:** `lib/start.mjs` derives the start list (`config.bootstrap`, then every skill whose description ends `Stays on after.`) and the start-up block text. Each emitter in `runtimes/` turns that list into one start-up block per skill: one `SessionStart` hook per skill for Claude Code, Codex and Antigravity, and one system-prompt push per skill in the OpenCode and pi plugins. `hooks/session-start` renders one skill per call.

## Global constraints
- Generated files are never hand-edited: change `runtimes/*.mjs` or `lib/`, then run `npm run generate`.
- `run-hook.cmd` forwards at most 8 arguments on Windows, and cmd.exe splits an argument at a comma.
- Start-up never blocks a session: a missing file, a missing bash or a plugin exception skips that block.
- Claude Code turns one hook's context over about 10,000 characters into a file reference, so each start skill gets its own hook.
- Codex on Windows runs hook commands in Windows PowerShell with `PLUGIN_ROOT` set, and reads `commandWindows` in place of `command`.
- Commits end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run limits: at most 3 verify rounds, at most $0 on paid runs.

### Task 1: line endings → verify: `node --test tests/frontmatter.test.mjs` exits 0, and `git ls-files --eol` lists no entry with `w/crlf`

**Blocked by:** none

**Files:**
- Create: `.gitattributes`
- Modify: `lib/frontmatter.mjs:8-12`
- Modify: `tests/frontmatter.test.mjs` (append one test)

- [x] Step 1: Create `.gitattributes` with exactly this content:

```
* text=auto eol=lf
```

- [x] Step 2: In `lib/frontmatter.mjs`, replace

```js
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text)
```

with

```js
  // A Windows checkout or editor can leave CRLF line endings.
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/.exec(text)
```

and replace

```js
  for (const raw of match[1].split('\n')) {
```

with

```js
  for (const raw of match[1].split(/\r?\n/)) {
```

- [x] Step 3: Append to `tests/frontmatter.test.mjs`:

```js
test('parses a file with CRLF line endings', () => {
  const { data, body } = parseFrontmatter('---\r\nname: foo\r\ndescription: does a thing\r\n---\r\n# Foo\r\n')
  assert.equal(data.name, 'foo')
  assert.equal(data.description, 'does a thing')
  assert.equal(body, '# Foo\r\n')
})
```

- [x] Step 4: Run `git add --renormalize .` and `git add .gitattributes lib/frontmatter.mjs tests/frontmatter.test.mjs`
- [x] Step 5: Commit: `fix: check out LF everywhere and parse CRLF frontmatter`
- [x] Step 6: Refresh the working tree so every file is rewritten with LF: run `git rm -r -q --cached .` then `git reset -q --hard HEAD`
- [x] Step 7: Run `git ls-files --eol` and `node --test tests/frontmatter.test.mjs`

### Task 2: the start list → verify: `node --test tests/start.test.mjs` exits 0

**Blocked by:** Task 1

**Files:**
- Create: `lib/start.mjs`
- Create: `tests/start.test.mjs`

- [x] Step 1: Create `lib/start.mjs`:

```js
// lib/start.mjs
// The skills every session starts with, in one place for every runtime. The
// OpenCode plugin and the pi extension embed startText's source.

// Skills that stay on once loaded, marked by the end of their description.
export const modifierSkills = skills => skills.filter(skill => skill.description.trim().endsWith('Stays on after.')).map(skill => skill.name).sort()

// The bootstrap skill, then every modifier. Each is injected whole at session
// start, one block per skill.
export const startSkills = model => [model.config.bootstrap, ...modifierSkills(model.skills).filter(name => name !== model.config.bootstrap)]

// One start-up block. Only the first block of a session says vibekit is present.
export const startText = (name, body, first) => '<EXTREMELY_IMPORTANT>\n' + (first ? 'You have vibekit.\n\n' : '') + 'Below is the full content of the ' + name + ' skill. Load every other vibekit skill the way this tool loads skills.\n\n' + body + '\n</EXTREMELY_IMPORTANT>'
```

- [x] Step 2: Create `tests/start.test.mjs`:

```js
// tests/start.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildModel } from '../lib/model.mjs'
import { modifierSkills, startSkills, startText } from '../lib/start.mjs'
import { MODEL } from './helpers.mjs'

const model = buildModel(JSON.parse(readFileSync('vibekit.config.json', 'utf8')), 'skills')

test('modifier skills are every skill whose description ends Stays on after., sorted', () => {
  const list = modifierSkills(model.skills)
  for (const skill of model.skills) assert.equal(list.includes(skill.name), skill.description.trim().endsWith('Stays on after.'), skill.name)
  assert.deepEqual(list, [...list].sort())
})

test('start skills are the bootstrap skill, then every other modifier', () => {
  const list = startSkills(model)
  assert.equal(list[0], model.config.bootstrap)
  assert.deepEqual(list.slice(1), modifierSkills(model.skills).filter(name => name !== model.config.bootstrap))
})

test('a new skill whose description ends Stays on after. joins the start skills', () => {
  const zeta = { name: 'zeta', description: 'Zeta. Stays on after.', trigger: 't', command: false, gate: 'none', dir: 'zeta' }
  assert.deepEqual(startSkills({ ...MODEL, skills: [...MODEL.skills, zeta] }), [MODEL.config.bootstrap, 'zeta'])
})

test('only the first start block says vibekit is present', () => {
  assert.match(startText('quick', 'BODY', true), /^<EXTREMELY_IMPORTANT>\nYou have vibekit\.\n/)
  const later = startText('lazy', 'BODY', false)
  assert.doesNotMatch(later, /You have vibekit/)
  assert.match(later, /full content of the lazy skill/)
  assert.match(later, /\nBODY\n/)
})
```

- [x] Step 3: Run `node --test tests/start.test.mjs`
- [x] Step 4: Commit: `feat: derive the start skills in lib/start.mjs`

### Task 3: Claude Code and Codex start hooks, no edit gate → verify: `node --test tests/hook.test.mjs tests/claude-code.test.mjs tests/codex.test.mjs` exits 0, and `npm run check` exits 0

**Blocked by:** Task 2

**Files:**
- Modify: `hooks/session-start` (whole file)
- Delete: `hooks/edit-gate`
- Modify: `runtimes/claude-code.mjs:1-70`
- Modify: `tests/hook.test.mjs:1-187` (keep the block-exit and executable-bit tests from line 189 on)
- Modify: `tests/claude-code.test.mjs:1-45`
- Regenerate: `hooks/hooks.json`

- [x] Step 1: Replace `hooks/session-start` with:

```bash
#!/usr/bin/env bash
# SessionStart hook: injects one vibekit skill as session context. Each
# runtime runs it once per start skill, because Claude Code turns one hook's
# context over about 10,000 characters into a file reference.
# Usage: session-start [antigravity] <skill-name>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

runtime=""
if [ "${1:-}" = "antigravity" ]; then
    runtime="antigravity"
    shift
fi
name="${1:-}"
if [ -z "$name" ]; then
    exit 0
fi

content=$(cat "${PLUGIN_ROOT}/skills/${name}/SKILL.md" 2>/dev/null || echo "")
if [ -z "$content" ]; then
    exit 0
fi
# A CRLF checkout must not leak carriage returns into the context. The
# frontmatter block is metadata for the generator, not text for the model.
content="${content//$'\r'/}"
content=$(printf '%s\n' "$content" | awk 'NR == 1 && $0 == "---" { skip = 1; next } skip && $0 == "---" { skip = 0; next } !skip')

# The bootstrap skill's block is the one that says vibekit is present.
bootstrap=$(sed -n 's/.*"bootstrap"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    "${PLUGIN_ROOT}/vibekit.config.json" | head -n 1)
header=""
if [ "$name" = "$bootstrap" ]; then
    header="You have vibekit.\n\n"
fi

# Escape for JSON embedding. Each substitution is a single C-level pass.
escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

escaped=$(escape_for_json "$content")
context="<EXTREMELY_IMPORTANT>\n${header}Below is the full content of the ${name} skill. Load every other vibekit skill the way this tool loads skills.\n\n${escaped}\n</EXTREMELY_IMPORTANT>"

# Each platform reads a different field, and Claude Code reads more than one
# without deduplicating, so exactly one shape is emitted per platform.
# Antigravity reads injected steps rather than additional context.
if [ "$runtime" = "antigravity" ]; then
    printf '{\n  "injectSteps": [{"systemMessage": {"systemMessage": "%s"}}]\n}\n' "$context"
elif [ -n "${CURSOR_PLUGIN_ROOT:-}" ]; then
    printf '{\n  "additional_context": "%s"\n}\n' "$context"
elif [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -z "${COPILOT_CLI:-}" ]; then
    printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "SessionStart",\n    "additionalContext": "%s"\n  }\n}\n' "$context"
else
    printf '{\n  "additionalContext": "%s"\n}\n' "$context"
fi

exit 0
```

- [x] Step 2: Run `git rm -q hooks/edit-gate`
- [x] Step 3: In `runtimes/claude-code.mjs`, replace the import line `import { pipelineSkills, modifierSkills } from '../lib/gate.mjs'` with `import { startSkills } from '../lib/start.mjs'`, and replace the whole `'hooks/hooks.json': json({ ... }),` entry (from the comment `// The polyglot wrapper is what makes the hook run on Windows;` through the closing `}),` before `}` of `files`) with:

```js
    // The polyglot wrapper is what makes the hook run on Windows; invoking
    // session-start directly works on Unix and silently does nothing on Windows,
    // which leaves every skill inert with no error. One hook per start skill,
    // because Claude Code turns one hook's context over about 10,000 characters
    // into a file reference. Codex reads this file too: on Windows it runs
    // commandWindows in PowerShell, where ${CLAUDE_PLUGIN_ROOT} is no variable,
    // and Claude Code ignores that field.
    'hooks/hooks.json': json({
      hooks: {
        SessionStart: [{
          matcher: 'startup|clear|compact',
          hooks: startSkills(model).map(name => ({
            type: 'command',
            command: `"\${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" session-start ${name}`,
            commandWindows: `& "$env:PLUGIN_ROOT/hooks/run-hook.cmd" session-start ${name}`,
            shell: 'bash',
            async: false,
          })),
        }],
      },
    }),
```

- [x] Step 4: In `runtimes/claude-code.mjs`, change `const { config, skills } = model` to `const { config } = model`.
- [x] Step 5: Replace lines 1-187 of `tests/hook.test.mjs` (everything before the comment `// A batch file run through cmd /c that exits from inside an if (...) block`) with:

```js
// tests/hook.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { buildModel } from '../lib/model.mjs'
import { startSkills } from '../lib/start.mjs'

const config = JSON.parse(readFileSync('vibekit.config.json', 'utf8'))
const skills = startSkills(buildModel(config, 'skills'))

function runHook(env, ...args) {
  const command = process.platform === 'win32'
    ? { file: 'hooks\\run-hook.cmd', args: ['session-start', ...args], shell: true }
    : { file: 'bash', args: ['hooks/run-hook.cmd', 'session-start', ...args], shell: false }
  return execFileSync(command.file, command.args, {
    encoding: 'utf8',
    shell: command.shell,
    env: { ...process.env, ...env },
  })
}

const claude = { CLAUDE_PLUGIN_ROOT: process.cwd(), COPILOT_CLI: '' }

test('emits Claude Code shaped context for every start skill, each under the inline limit', () => {
  for (const name of skills) {
    const parsed = JSON.parse(runHook(claude, name))
    const context = parsed.hookSpecificOutput.additionalContext
    assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart')
    assert.ok(context.includes(`full content of the ${name} skill`), name)
    assert.ok(context.includes(`# ${name}\n`), `${name} body`)
    assert.ok(!context.includes('\r'), `${name} carries a carriage return`)
    assert.ok(!context.includes(`\nname: ${name}\n`), `${name} carries its frontmatter`)
    assert.equal(context.includes('You have vibekit.'), name === config.bootstrap, name)
    assert.ok(context.length < 10000, `${name} context is ${context.length} characters`)
  }
})

test('emits the SDK-standard shape when no platform variable is set', () => {
  const parsed = JSON.parse(runHook({ CLAUDE_PLUGIN_ROOT: '', CURSOR_PLUGIN_ROOT: '' }, skills[0]))
  assert.ok('additionalContext' in parsed)
  assert.ok(!('hookSpecificOutput' in parsed))
})

test('emits nothing for a skill that does not exist', () => {
  assert.equal(runHook(claude, 'no-such-skill'), '')
})

// The hook exits 0 unconditionally, so malformed JSON disables every skill
// with no error. Escaping must survive a body containing quotes and backslashes.
test('emits parseable JSON for a body containing quotes, backslashes and tabs', () => {
  const path = `skills/${config.bootstrap}/SKILL.md`
  const original = readFileSync(path, 'utf8')
  try {
    writeFileSync(path, `${original}\nHostile: "quoted" \\backslash\\ \ttab\n`)
    const context = JSON.parse(runHook(claude, config.bootstrap)).hookSpecificOutput.additionalContext
    assert.ok(context.includes('Hostile:'), 'hostile line must survive escaping')
    assert.ok(context.includes('"quoted"'), 'quotes must survive escaping')
    assert.ok(context.includes('\\backslash\\'), 'backslashes must survive escaping')
  } finally {
    writeFileSync(path, original)
  }
})

test('session-start emits the Antigravity injectSteps shape when asked', () => {
  const parsed = JSON.parse(runHook({ CLAUDE_PLUGIN_ROOT: '', CURSOR_PLUGIN_ROOT: '' }, 'antigravity', skills[0]))
  assert.ok(parsed.injectSteps[0].systemMessage.systemMessage.includes(`# ${skills[0]}\n`))
})

```

- [x] Step 6: In `tests/claude-code.test.mjs`, add `import { startSkills } from '../lib/start.mjs'` after the `buildModel` import, and replace the two tests `emits a SessionStart hook that runs through the polyglot wrapper` and `emits a PreToolUse edit gate listing every hard-gate or command skill on disk` (lines 25-45) with:

```js
test('emits one SessionStart hook per start skill, each through the polyglot wrapper', () => {
  const model = buildModel(JSON.parse(readFileSync('vibekit.config.json', 'utf8')), 'skills')
  const entry = JSON.parse(emit(model)['hooks/hooks.json']).hooks.SessionStart[0]
  assert.equal(entry.matcher, 'startup|clear|compact')
  assert.deepEqual(entry.hooks.map(hook => hook.command.split(' session-start ')[1]), startSkills(model))
  for (const hook of entry.hooks) {
    assert.match(hook.command, /^"\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/run-hook\.cmd" session-start [a-z-]+$/)
    assert.match(hook.commandWindows, /^& "\$env:PLUGIN_ROOT\/hooks\/run-hook\.cmd" session-start [a-z-]+$/)
    assert.equal(hook.shell, 'bash')
    assert.equal(hook.async, false)
  }
})

test('emits no PreToolUse hook', () => {
  assert.equal(JSON.parse(emit(MODEL)['hooks/hooks.json']).hooks.PreToolUse, undefined)
})
```

- [x] Step 7: Run `npm run generate`
- [x] Step 8: Run `node --test tests/hook.test.mjs tests/claude-code.test.mjs tests/codex.test.mjs` and `npm run check`
- [x] Step 9: Commit: `feat: one start hook per start skill for Claude Code and Codex, no edit gate`

### Task 4: Antigravity start hooks → verify: `node --test tests/antigravity.test.mjs tests/hook.test.mjs` exits 0, and `npm run check` exits 0

**Blocked by:** Task 3

**Files:**
- Modify: `runtimes/antigravity.mjs:1-30`
- Modify: `tests/antigravity.test.mjs:1-33`
- Modify: `tests/hook.test.mjs` (append one test)
- Regenerate: `hooks.json`

- [x] Step 1: In `runtimes/antigravity.mjs`, replace the import line `import { pipelineSkills, modifierSkills } from '../lib/gate.mjs'` with `import { startSkills } from '../lib/start.mjs'`, and replace the comment block and `emit` function (lines 7-30) with:

```js
// agy reads a plugin's rules from `rules/` and its hooks from `hooks.json` at
// the plugin root, never `hooks/hooks.json`. Hook commands run in the plugin
// folder, so their paths are relative to it. One SessionStart hook per start
// skill injects that skill. agy runs a hook through cmd.exe on Windows and sh
// elsewhere, and no quoted or ./ path works under both: cmd runs the
// backslash path, sh cannot find it, and || hands sh the forward-slash path.
// The form holds no quote, so it does not depend on cmd's /s quote rules.
const hook = args => `hooks\\run-hook.cmd ${args} || ./hooks/run-hook.cmd ${args}`

export function emit(model) {
  const { config } = model
  return {
    'plugin.json': `${JSON.stringify({
      name: config.name,
      description: config.description,
      version: config.version,
    }, null, 2)}\n`,
    'hooks.json': `${JSON.stringify({
      [config.name]: {
        SessionStart: startSkills(model).map(name => ({ type: 'command', command: hook(`session-start antigravity ${name}`) })),
      },
    }, null, 2)}\n`,
  }
}
```

- [x] Step 2: In `tests/antigravity.test.mjs`, add `import { startSkills } from '../lib/start.mjs'` after the `helpers.mjs` import, and replace the test `emits a root hooks file that loads vibekit and guards agy edit tools` (lines 28-33) with:

```js
test('emits one SessionStart hook per start skill that cmd.exe and sh both run, and no edit guard', () => {
  const hooks = JSON.parse(emit(MODEL)['hooks.json']).vibekit
  assert.deepEqual(
    hooks.SessionStart.map(entry => entry.command),
    startSkills(MODEL).map(name => `hooks\\run-hook.cmd session-start antigravity ${name} || ./hooks/run-hook.cmd session-start antigravity ${name}`),
  )
  assert.equal(hooks.PreToolUse, undefined)
})
```

- [x] Step 3: In `tests/hook.test.mjs`, change the import line `import { execFileSync } from 'node:child_process'` to `import { execFileSync, spawnSync } from 'node:child_process'`, and add after the test `session-start emits the Antigravity injectSteps shape when asked`:

```js
// agy runs a hook command through cmd.exe on Windows, with or without /s, and
// through sh elsewhere. Each command in the generated root hooks.json must
// work under every one of those.
test('the Antigravity hook commands run the way agy launches them', () => {
  const env = { ...process.env, CLAUDE_PLUGIN_ROOT: '', CURSOR_PLUGIN_ROOT: '' }
  for (const { command } of JSON.parse(readFileSync('hooks.json', 'utf8')).vibekit.SessionStart) {
    const launches = process.platform === 'win32'
      ? [
          spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/c', command], { windowsVerbatimArguments: true, encoding: 'utf8', input: '', env }),
          spawnSync(command, { shell: true, encoding: 'utf8', input: '', env }),
        ]
      : [spawnSync('sh', ['-c', command], { encoding: 'utf8', input: '', env })]
    for (const result of launches) {
      assert.equal(result.status, 0, `${command}: ${result.stderr}`)
      assert.ok(JSON.parse(result.stdout).injectSteps[0].systemMessage.systemMessage.includes('<EXTREMELY_IMPORTANT>'), command)
    }
  }
})
```

- [x] Step 4: Run `npm run generate`
- [x] Step 5: Run `node --test tests/antigravity.test.mjs tests/hook.test.mjs` and `npm run check`
- [x] Step 6: Commit: `fix: Antigravity start hooks that run under cmd.exe and sh, no edit guard`

### Task 5: OpenCode plugin and install doc → verify: `node --test tests/opencode.test.mjs` exits 0, and `npm run check` exits 0

**Blocked by:** Task 4

**Files:**
- Modify: `runtimes/opencode.mjs:1-150`
- Modify: `tests/opencode.test.mjs:1-173`
- Regenerate: `.opencode/plugins/vibekit.js`, `.opencode/INSTALL.md`

- [x] Step 1: In `runtimes/opencode.mjs`, replace line 2 `import { pipelineSkills, modifierSkills, missingSkills, denyReason, startText } from '../lib/gate.mjs'` with `import { startSkills, startText } from '../lib/start.mjs'`.
- [x] Step 2: Replace the comment above `function plugin(model)` (lines 6-12) with:

```js
// opencode v2 takes skills one at a time through skill.transform, each with
// its name and description as separate fields. Both are baked in from the
// model, so the only frontmatter parser stays the generator's and the plugin
// reads each file for its content alone. The plugin also pushes each start
// skill into the system prompt, skipping a skill it cannot read, and skips
// that part on an opencode without the context hook.
```

- [x] Step 3: In the template string of `plugin(model)`, replace the lines from `const BOOTSTRAP = ${JSON.stringify(model.config.bootstrap)}` through `const startText = ${startText.toString()}` with:

```js
const START = ${JSON.stringify(startSkills(model))}
const startText = ${startText.toString()}
```

and replace everything in the template from `    const loaded = new Map()` through the closing `    })` of the `permission` hook (the line before `  },\n}`) with:

```js
    const start = []
    for (const [index, name] of START.entries()) {
      try {
        start.push(startText(name, body(name), index === 0))
      } catch {}
    }
    if (start.length) {
      await ctx.session?.hook?.('context', async context => {
        for (const text of start) context.system.push({ type: 'text', text })
      })
    }
```

- [x] Step 4: In `installDoc(config)`, replace the lines from `'## Local checkout',` through the line `'## Git repository',` (exclusive) with:

```js
    '## Local checkout',
    '',
    `opencode loads a plugin file placed in a \`.opencode/plugins/\` folder: your project's, or \`~/.config/opencode/plugins/\` for every project. Create \`${config.name}.js\` there with this one line, so the plugin still finds its skills in your checkout:`,
    '',
    '```js',
    `export { default } from 'file:///path/to/local/${config.name}/.opencode/plugins/${config.name}.js'`,
    '```',
    '',
    `Replace \`/path/to/local/${config.name}\` with the absolute path to your checkout, with forward slashes on Windows too, such as \`file:///C:/Users/you/${config.name}\`. The \`plugin\` array of \`opencode.json\` does not load a local checkout: opencode 2.3.2 rejects a file path there and ignores a folder path.`,
    '',
```

and replace the lines from `'## Verify',` through the line `'It prints \`1\` when the skills are registered and \`0\` when they are not. This check also works for a local checkout added through the \`skills\` array.',` with:

```js
    '## Verify',
    '',
    'Run `opencode reload`, then check that the skills are registered. From your project directory:',
    '',
    '```',
    `opencode api skill.list -H "x-opencode-directory:$PWD" | grep -c '"id":"${config.bootstrap}"'`,
    '```',
    '',
    'It prints `1` when the skills are registered and `0` when they are not. `opencode plugin list` is no check here: it can print `No plugins found` while the plugin is loaded.',
```

- [x] Step 5: In `tests/opencode.test.mjs`, delete line 10 `import { denyReason } from '../lib/gate.mjs'`. Replace the test `install document names only commands opencode v2 has` (lines 100-107) with:

```js
test('install document gives a local-checkout form that loads the plugin, and the skill.list check', () => {
  const doc = emit(MODEL)['.opencode/INSTALL.md']
  assert.doesNotMatch(doc, /opencode debug skill/)
  assert.match(doc, /Requires opencode v2/)
  assert.match(doc, /export \{ default \} from 'file:\/\/\/path\/to\/local\/vibekit\/\.opencode\/plugins\/vibekit\.js'/)
  assert.doesNotMatch(doc, /"skills": \[/)
  assert.match(doc, new RegExp(`opencode api skill\\.list -H "x-opencode-directory:\\$PWD" \\| grep -c '"id":"${MODEL.config.bootstrap}"'`))
})
```

and replace everything from line 108 (`// Stands in for the v2 hooks the guard uses,`) to the end of the file with:

```js
// Stands in for the v2 hooks, keeping each registered handler so a test can
// call it the way opencode would.
async function hooked(plugin) {
  const handlers = {}
  const hook = kind => async (name, fn) => { handlers[`${kind}.${name}`] = fn }
  await plugin.setup({
    skill: { transform: async fn => fn({ add: () => {} }) },
    session: { hook: hook('session') },
    tool: { hook: hook('tool') },
    permission: { hook: hook('permission') },
  })
  return handlers
}

const started = {
  ...MODEL,
  config: { ...MODEL.config, bootstrap: 'alpha' },
  skills: [...MODEL.skills, { name: 'lazy', description: 'Lazy. Stays on after.', trigger: 'always', command: false, gate: 'none', dir: 'lazy' }],
}

test('pushes each start skill into the system prompt, saying vibekit is present once', async t => {
  const { plugin } = await load(started, t)
  const handlers = await hooked(plugin)
  const context = { system: [] }
  await handlers['session.context'](context)
  assert.deepEqual(context.system.map(part => part.type), ['text', 'text'])
  assert.match(context.system[0].text, /^<EXTREMELY_IMPORTANT>\nYou have vibekit\.\n[\s\S]*full content of the alpha skill/)
  assert.match(context.system[1].text, /full content of the lazy skill/)
  assert.doesNotMatch(context.system[1].text, /You have vibekit/)
})

test('registers no edit guard', async t => {
  const { plugin } = await load(started, t)
  assert.deepEqual(Object.keys(await hooked(plugin)), ['session.context'])
})
```

- [x] Step 6: Run `npm run generate`
- [x] Step 7: Run `node --test tests/opencode.test.mjs` and `npm run check`
- [x] Step 8: Commit: `feat: OpenCode pushes every start skill and documents a working local install`

### Task 6: pi extension → verify: `node --test tests/pi.test.mjs` exits 0, and `npm run check` exits 0

**Blocked by:** Task 5

**Files:**
- Modify: `runtimes/pi.mjs:1-68`
- Modify: `tests/pi.test.mjs:1-82`
- Regenerate: `.pi/vibekit.js`

- [x] Step 1: Replace lines 1-68 of `runtimes/pi.mjs` (everything before `export function emit(model) {`) with:

```js
// runtimes/pi.mjs
import { startSkills, startText } from '../lib/start.mjs'

export const id = 'pi'

// Pi reads a `pi` block from package.json: native skills, plus one extension
// that appends each start skill to the system prompt. A pi extension that
// throws blocks the agent, so the handler catches its own errors, and a start
// skill whose file cannot be read is skipped.
function extension(model) {
  return `// Generated by vibekit. Do not edit.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../skills')
const START = ${JSON.stringify(startSkills(model))}
const startText = ${startText.toString()}

function body(name) {
  return readFileSync(path.join(SKILLS, name, 'SKILL.md'), 'utf8').replace(/^---\\r?\\n[\\s\\S]*?\\r?\\n---(?:\\r?\\n)?/, '')
}

export default function (pi) {
  const start = []
  for (const [index, name] of START.entries()) {
    try {
      start.push(startText(name, body(name), index === 0))
    } catch {}
  }

  pi.on('before_agent_start', async event => {
    try {
      if (start.length) return { systemPrompt: event.systemPrompt + '\\n\\n' + start.join('\\n\\n') }
    } catch {}
  })
}
`
}

```

- [x] Step 2: Replace lines 1-82 of `tests/pi.test.mjs` (the whole file) with:

```js
// tests/pi.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { id, emit, pkg, ships } from '../runtimes/pi.mjs'
import { MODEL, skillFile } from './helpers.mjs'

const started = {
  ...MODEL,
  config: { ...MODEL.config, bootstrap: 'alpha' },
  skills: [...MODEL.skills, { name: 'lazy', description: 'Lazy. Stays on after.', trigger: 'always', command: false, gate: 'none', dir: 'lazy' }],
}

// The extension finds its skills at ../skills relative to itself, so it is
// imported from a throwaway tree shaped like the shipped package, then handed
// a stand-in for pi that keeps each registered handler.
async function load(t, missing = []) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'vibekit-pi-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  writeFileSync(join(root, 'package.json'), '{"type":"module"}')
  for (const { name } of started.skills) {
    if (missing.includes(name)) continue
    mkdirSync(join(root, 'skills', name), { recursive: true })
    writeFileSync(join(root, 'skills', name, 'SKILL.md'), skillFile({ name }))
  }
  mkdirSync(join(root, '.pi'))
  const file = join(root, '.pi/vibekit.js')
  writeFileSync(file, emit(started)['.pi/vibekit.js'])
  const handlers = {}
  ;(await import(pathToFileURL(file).href)).default({ on: (name, fn) => { handlers[name] = fn } })
  return handlers
}

test('is identified as pi', () => {
  assert.equal(id, 'pi')
})

test('contributes skills and the extension, and ships the extension folder', () => {
  assert.deepEqual(pkg(MODEL).pi, { skills: ['./skills'], extensions: ['./.pi/vibekit.js'] })
  assert.ok('.pi/vibekit.js' in emit(MODEL))
  assert.deepEqual(ships(MODEL), ['.pi/'])
})

test('appends every start skill to the system prompt, saying vibekit is present once', async t => {
  const handlers = await load(t)
  const { systemPrompt } = await handlers.before_agent_start({ prompt: 'hi', systemPrompt: 'base' })
  assert.match(systemPrompt, /^base\n\n<EXTREMELY_IMPORTANT>\nYou have vibekit\.\n/)
  assert.match(systemPrompt, /full content of the alpha skill/)
  assert.match(systemPrompt, /full content of the lazy skill/)
  assert.equal(systemPrompt.split('You have vibekit').length, 2)
})

test('skips a start skill whose file is missing and keeps the rest', async t => {
  const handlers = await load(t, ['lazy'])
  const { systemPrompt } = await handlers.before_agent_start({ prompt: 'hi', systemPrompt: 'base' })
  assert.match(systemPrompt, /full content of the alpha skill/)
  assert.doesNotMatch(systemPrompt, /full content of the lazy skill/)
})

test('registers no tool_call guard', async t => {
  assert.deepEqual(Object.keys(await load(t)), ['before_agent_start'])
})
```

- [x] Step 3: Run `npm run generate`
- [x] Step 4: Run `node --test tests/pi.test.mjs` and `npm run check`
- [x] Step 5: Commit: `feat: pi appends every start skill, no edit guard`

### Task 7: Windows path separators in the reference guard test → verify: `node --test tests/no-external-references.test.mjs` exits 0

**Blocked by:** none

Added after Task 8 halted on this test: on win32 `join` builds `skills\brainstorm\SKILL.md`, and the assertion at `tests/no-external-references.test.mjs:51` looks for `skills/brainstorm/SKILL.md`. It fails the same way at 3f800da. That assertion is the guard: it fails today on Windows and passes after this task.

**Files:**
- Modify: `tests/no-external-references.test.mjs:5`, `tests/no-external-references.test.mjs:24`

- [x] Step 1: In `tests/no-external-references.test.mjs`, delete line 5 `import { join } from 'node:path'`, and replace line 24 `    .map(entry => join('skills', entry.name, 'SKILL.md'))` with:

```js
    // Forward slashes on every platform, so the paths compare equal to the literals below.
    .map(entry => `skills/${entry.name}/SKILL.md`)
```

- [x] Step 2: Run `node --test tests/no-external-references.test.mjs`
- [x] Step 3: Commit: `test: build shipped skill paths with forward slashes on every platform`

### Task 8: quick becomes the bootstrap, using-vibekit and the guard leave → verify: `npm run check` exits 0; `node --test` over every `tests/*.test.mjs` except `tests/submission.test.mjs` exits 0; `git grep -n -i -E "edit-gate|denyReason|missingSkills|VIBEKIT_GATE|PreToolUse" -- . ":!docs" ":!tests"` finds no match; `git grep -n using-vibekit -- . ":!docs"` finds no match

**Blocked by:** Task 6, Task 7

**Files:**
- Modify: `vibekit.config.json:9`
- Delete: `skills/using-vibekit/`, `lib/gate.mjs`, `tests/gate.test.mjs`
- Modify: `lib/submission.mjs:103-113`, `lib/submission.mjs:177`
- Modify: `tests/submission.test.mjs:43`, `tests/submission.test.mjs:72-76`, `tests/submission.test.mjs:205-213`
- Modify: `submission/README.md:28`, `submission/README.md:39`
- Modify: `tests/helpers.mjs:31`, `tests/model.test.mjs`, `tests/build.test.mjs:91-97`, `tests/skeleton.test.mjs:17`
- Modify: `tests/eval-score.test.mjs:499`, `evals/fixtures/skill-fired.jsonl:1`, `evals/fixtures/skill-unavailable.jsonl:1`
- Modify: `skills/vibe/SKILL.md:11`
- Modify: `README.md:13`
- Modify: `HANDOFF.md` (whole file)
- Regenerate: every generated file

- [x] Step 1: In `vibekit.config.json`, change `"bootstrap": "using-vibekit",` to `"bootstrap": "quick",`.
- [x] Step 2: Run `git rm -r -q skills/using-vibekit lib/gate.mjs tests/gate.test.mjs`
- [x] Step 3: In `lib/submission.mjs`, replace the whole `adaptStartup` function (lines 103-113) with:

```js
// The submission has no start-up hooks, so its onboarding skill tells the user
// how to activate vibekit by hand.
function adaptStartup(text, name) {
  return `${text}\n## Activation in Codex\n\nActivate Vibekit explicitly after installation by asking Codex to use the ${name} skill. This submission has no lifecycle startup hooks. Re-activate it in a new conversation when needed.\n`
}
```

and change line 177 from `if (path === \`skills/${config.bootstrap}/SKILL.md\`) data = adaptStartup(data.toString('utf8'))` to `if (path === \`skills/${config.bootstrap}/SKILL.md\`) data = adaptStartup(data.toString('utf8'), config.bootstrap)`.

- [x] Step 4: In `tests/submission.test.mjs`: on line 43 change `'skills/using-vibekit/SKILL.md'` to `'skills/quick/SKILL.md'`. On line 72 change `'skills/using-vibekit/SKILL.md'` to `'skills/quick/SKILL.md'`. Delete line 73 (`assert.match(staged, /\[auto-trigger table\]...`), line 74 (`assert.match(staged, /If no dedicated invocation tool is available/)`) and line 76 (`assert.match(staged, /System and developer instructions take precedence/)`), and after line 75 (`assert.match(staged, /Activate Vibekit explicitly/)`) add `assert.match(staged, /use the quick skill/)`. Delete the whole test `source adaptation mismatch fails without replacing an existing artifact` (lines 205-213 including its closing `})` and the blank line after it).
- [x] Step 5: In `submission/README.md`, on line 28 change `"Use Vibekit and invoke the using-vibekit skill for this conversation."` to `"Use Vibekit and invoke the quick skill for this conversation."`. On line 39 change ``activate `using-vibekit`, and ask for the trigger row for `brainstorm`.`` to ``activate `quick`, and ask for the trigger row for `brainstorm`.``
- [x] Step 6: In `tests/helpers.mjs` line 31 change `bootstrap: 'using-vibekit',` to `bootstrap: 'quick',`. In `tests/model.test.mjs` replace every `using-vibekit` with `quick`. In `tests/build.test.mjs` lines 91-97 replace every `using-vibekit` with `quick`. In `tests/skeleton.test.mjs` line 17 change `['using-vibekit', 'vibe']` to `['quick', 'vibe']`.
- [x] Step 7: In `tests/eval-score.test.mjs` line 499, `evals/fixtures/skill-fired.jsonl` line 1 and `evals/fixtures/skill-unavailable.jsonl` line 1, replace `vibekit:using-vibekit` with `vibekit:quick`.
- [x] Step 8: In `skills/vibe/SKILL.md` line 11, replace ``every skill's `Handoff` section names its successor, and `using-vibekit` carries the trigger map.`` with ``every skill's `Handoff` section names its successor, and every skill's frontmatter declares its trigger.``
- [x] Step 9: In `README.md`, replace the whole of line 13 with:

```
Every session starts with `quick`, `lazy`, `plain` and `terse` already loaded. A start-up hook injects their full text in Claude Code, Codex and Antigravity, and the plugin does it in OpenCode and pi. On Windows the hooks need Git for Windows.
```

- [x] Step 10: Replace `HANDOFF.md` with:

```markdown
# Handoff: test vibekit on Windows

You are testing vibekit on a Windows machine. vibekit is a skills plugin for coding agents. Test this local checkout, never an installed release.

One thing must work on every runtime: when a session starts, the full text of `quick`, `lazy`, `plain` and `terse` is in context, and the first block says "You have vibekit." There is no edit guard, so the first file write goes through.

How it is wired, so you know where to look when something fails:

| Runtime | Start-up text |
|---|---|
| Claude Code | `hooks/hooks.json` SessionStart runs `hooks/run-hook.cmd session-start <skill>` once per start skill |
| Codex | the same `hooks/hooks.json`. On Windows it runs `commandWindows` in PowerShell: `& "$env:PLUGIN_ROOT/hooks/run-hook.cmd" session-start <skill>` |
| Antigravity (`agy`) | root `hooks.json` runs `hooks\run-hook.cmd session-start antigravity <skill> \|\| ./hooks/run-hook.cmd session-start antigravity <skill>` once per start skill |
| OpenCode | `.opencode/plugins/vibekit.js`, context hook, one block per start skill |
| pi | `.pi/vibekit.js`, before_agent_start, one block per start skill |

`hooks/run-hook.cmd` is a polyglot: under `cmd.exe` its batch half finds Git Bash and runs the named bash script in `hooks/`. Without Git for Windows it exits 0 silently, which turns the start-up text off.

## Rules for this run

- Ask the user before installing anything, before changing any global config (`~/.claude`, `~/.codex`, `~/.config/opencode`, `~/.pi`, `~/.gemini`), and before any push. Prefer per-session flags and scratch folders.
- Do not fix anything during the run. Record what failed with the exact command and output, then report.
- Run every live agent test from a new empty scratch folder outside this repo.
- Use prompts that do not mention vibekit's skills, for example `create hello.txt containing the word hi`.

## Step 1: no-agent checks

From the repo root:

1. `git --version`, and check that `C:\Program Files\Git\bin\bash.exe` exists.
2. `git ls-files --eol` and record any entry with `w/crlf`. `.gitattributes` asks for LF everywhere.
3. `node --version` (needs 24 or newer), then `npm run check` and `npm test`. The submission tests need `zip` and `unzip` on PATH.
4. Run each Antigravity command from the root `hooks.json` exactly as agy would, from the repo root: `cmd /c <command> < nul`. Pass: JSON containing `injectSteps`.

## Step 2: live checks, one runtime at a time

For each installed runtime, record the version, then ask `do you have vibekit? quote the first line of what you were given about it`, then `create hello.txt containing the word hi`. Pass: the answer quotes the start-up text, and the file is written on the first try.

1. Claude Code: `claude --plugin-dir <absolute path to this checkout>` from the scratch folder. Turn off an installed vibekit for the session with `--settings` and `{"enabledPlugins":{"vibekit@vibekit":false}}`.
2. Codex: ask the user how to install from this checkout. Codex asks to trust plugin hooks once, in an interactive session. `codex exec` hides a failing hook, so check an interactive session for `Hook failed`.
3. Antigravity: ask before `agy plugin install <path to this checkout>`. Then `agy -p "create hello.txt containing the word hi" --mode accept-edits` from the scratch folder.
4. OpenCode: follow `.opencode/INSTALL.md`, Local checkout, with the one-line file in the scratch folder's `.opencode/plugins/`.
5. pi: `pi -e <checkout>\.pi\vibekit.js -ne -ns --no-session -p "<prompt>" < nul` from the scratch folder.

## Report

Write the results to `windows-test-results.md` in the repo root (do not commit it), one table row per check with the command and its output as evidence. End with every failure, its most likely cause and the file a fix would touch, and say which checks you could not run and why.
```

- [x] Step 11: Run `npm run generate`
- [x] Step 12: Run `npm run check`
- [x] Step 13: Run `node --test` with every file matched by `tests/*.test.mjs` except `tests/submission.test.mjs` as arguments (in PowerShell: `node --test (Get-ChildItem tests\*.test.mjs | Where-Object Name -ne 'submission.test.mjs' | ForEach-Object FullName)`)
- [x] Step 14: Run `git grep -n -i -E "edit-gate|denyReason|missingSkills|VIBEKIT_GATE|PreToolUse" -- . ":!docs" ":!tests"` and `git grep -n using-vibekit -- . ":!docs"`
- [x] Step 15: Commit: `feat: quick, lazy, plain and terse load at session start; remove the edit guard and using-vibekit`

### Task 9: live checks on this Windows machine → verify: `windows-test-results.md` in the main checkout has a round-two table with a row per runtime for the start-up question and the write, and every row reads pass

**Blocked by:** Task 8

**Files:**
- Modify: `C:\Users\rizki\Projects\vibekit\windows-test-results.md` (untracked, never committed)

In every step, `<worktree>` is `C:\Users\rizki\Projects\vibekit\.vibe-worktrees\windows-start-skills`, `<question>` is `do you have vibekit? quote the first line of what you were given about it`, and `<prompt>` is each of `<question>` and `create hello.txt containing the word hi` in turn.

- [x] Step 1: Claude Code. From a new empty scratch folder, run `claude -p "do you have vibekit? quote the first line of what you were given about it" --plugin-dir <worktree> --settings <file with {"enabledPlugins":{"vibekit@vibekit":false}}>`, then the same flags with `--permission-mode acceptEdits --output-format stream-json --verbose` and `create hello.txt containing the word hi`. Record whether the answer quotes start-up text, whether any context arrived as a file reference, and whether `hello.txt` contains `hi` with no denial.
- [x] Step 2: pi. From a new empty scratch folder, run `pi -e <worktree>\.pi\vibekit.js -ne -ns --no-session -p "<prompt>" < nul` for both prompts. Record the same.
- [x] Step 3: OpenCode. In a new empty scratch folder, create `.opencode\plugins\vibekit.js` with the one line from the generated `.opencode/INSTALL.md`, path set to the worktree. Run `opencode run --standalone --archived "<prompt>"` for the question, and with `--auto --format json` for the write. Record the same.
- [x] Step 4: Antigravity. After the user's approval, run `agy plugin install <worktree>`, then from a new empty scratch folder `agy -p "<question>"` and `agy -p "create hello.txt containing the word hi" --mode accept-edits`. Record the same.
- [x] Step 5: Codex. After the user's approval, point the `vibekit` marketplace at the worktree and reinstall `vibekit@vibekit`. The user trusts the new hooks in one interactive `codex -m gpt-6-luna` session and reports whether `Hook failed` appeared. Then run `codex exec -m gpt-6-luna --skip-git-repo-check -C <scratch> --json "<question>"` and read its session record for `EXTREMELY_IMPORTANT`. Record the same.
- [x] Step 6: Cleanup. Run `codex plugin remove vkprobe@vkprobe` and `codex plugin marketplace remove vkprobe`, and record both.
- [x] Step 7: Append the round-two table to `windows-test-results.md`. No commit: the file stays untracked.

### Task 10: Windows CI → verify: the `hook (windows-latest)` job of the CI run for the pushed branch concludes `success`

**Blocked by:** Task 8

**Files:** none changed

CI runs on pushes to `main` and `v2` and on pull requests only (`.github/workflows/ci.yml:3-6`), so the job needs a draft pull request.

- [x] Step 1: Run `git rm -r -q --cached --ignore-unmatch docs` and commit `chore: keep specs and plans out of the PR`, so specs and plans never reach `main`. The files stay on disk.
- [x] Step 2: After the user's approval, push `repl-run/windows-start-skills` to `origin` and open a draft pull request against `main` with `gh pr create --draft`.
- [x] Step 3: Run `gh run list --branch repl-run/windows-start-skills --workflow CI --limit 1` and wait for that run to finish.
- [x] Step 4: Run `gh run view <the run id from Step 3> --json jobs` and read the conclusion of the `hook (windows-latest)` job.
