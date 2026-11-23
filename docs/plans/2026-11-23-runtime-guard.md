# runtime guard: Implementation Plan

**Spec:** docs/specs/2026-11-23-runtime-guard-design.md
**Goal:** Give Codex, Antigravity, OpenCode and pi the same start-up text and edit guard Claude Code has.
**Architecture:** `lib/gate.mjs` holds the rule: the skill lists, the missing-skill check, the deny reason and the start-up text. Claude Code, Codex and Antigravity share `hooks/edit-gate`, which reads the session record. The OpenCode plugin and a new pi extension carry the `lib/gate.mjs` functions' source and track loaded skills in memory.

## Global constraints
- No new dependency.
- Generated files change only through `npm run generate`.
- Every edited string obeys `plain`'s rules, which `npm test` checks.
- Claude Code keeps the deny shape and matcher it has on branch `fix/gate-deny-reason`. The reason text becomes runtime-neutral.
- An adapter that hits an error while checking allows the edit.
- A change under `hooks/` is not done until the `hook (windows-latest)` CI job passes.

### Task 1: the guard rule in one place → verify: `node --test tests/gate.test.mjs` exits 0, `npm run check` exits 0 and `npm test` exits 0

**Blocked by:** none

**Files:**
- Create: `lib/gate.mjs`
- Create: `tests/gate.test.mjs`
- Modify: `runtimes/claude-code.mjs:2,62`
- Modify: `README.md:13`

- [ ] Step 1: Create `lib/gate.mjs` with exactly:

```js
// lib/gate.mjs
// The edit guard's rule, in one place for every runtime. The OpenCode plugin
// and the pi extension embed these functions' source, and a test pins the
// bash hook's reason to denyReason.

// Skills that count as entering the pipeline: each hard gate and each command.
export const pipelineSkills = skills => skills.filter(skill => skill.gate === 'hard' || skill.command).map(skill => skill.name).sort()

// Skills that stay on once loaded, marked by the end of their description.
export const modifierSkills = skills => skills.filter(skill => skill.description.trim().endsWith('Stays on after.')).map(skill => skill.name).sort()

// What a session still has to load before its first edit, in the order the
// model should load it. loaded is a Set of skill names.
export const missingSkills = (loaded, pipeline, modifiers) => [
  ...(pipeline.some(name => loaded.has(name)) ? [] : ['quick']),
  ...modifiers.filter(name => !loaded.has(name)),
]

export const denyReason = missing => 'vibekit denied this edit, so the file was not changed. Load each of these vibekit skills first, in order:' + missing.map(name => ' vibekit:' + name).join('') + '. Then retry the edit. Retrying first is denied again. To turn this check off, set VIBEKIT_GATE=off.'

// The text a session starts with, wrapping the bootstrap skill's body.
export const startText = (name, body) => '<EXTREMELY_IMPORTANT>\nYou have vibekit.\n\nBelow is the full content of the ' + name + ' skill. Load every other vibekit skill the way this tool loads skills.\n\n' + body + '\n</EXTREMELY_IMPORTANT>'
```

- [ ] Step 2: Create `tests/gate.test.mjs` with exactly:

```js
// tests/gate.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildModel } from '../lib/model.mjs'
import { pipelineSkills, modifierSkills, missingSkills, denyReason, startText } from '../lib/gate.mjs'

const model = buildModel(JSON.parse(readFileSync('vibekit.config.json', 'utf8')), 'skills')

test('pipeline skills are every hard gate and every command, sorted', () => {
  const list = pipelineSkills(model.skills)
  for (const skill of model.skills) assert.equal(list.includes(skill.name), skill.gate === 'hard' || skill.command, skill.name)
  assert.deepEqual(list, [...list].sort())
})

test('modifier skills are lazy, plain and terse', () => {
  assert.deepEqual(modifierSkills(model.skills), ['lazy', 'plain', 'terse'])
})

test('a session with nothing loaded misses quick and every modifier', () => {
  assert.deepEqual(missingSkills(new Set(), ['brainstorm', 'quick'], ['lazy', 'plain', 'terse']), ['quick', 'lazy', 'plain', 'terse'])
})

test('any pipeline skill satisfies the pipeline part', () => {
  assert.deepEqual(missingSkills(new Set(['brainstorm', 'lazy']), ['brainstorm', 'quick'], ['lazy', 'plain', 'terse']), ['plain', 'terse'])
  assert.deepEqual(missingSkills(new Set(['quick', 'lazy', 'plain', 'terse']), ['brainstorm', 'quick'], ['lazy', 'plain', 'terse']), [])
})

test('the deny reason names each missing skill in order and the off switch', () => {
  const reason = denyReason(['quick', 'plain'])
  assert.match(reason, /in order: vibekit:quick vibekit:plain\./)
  assert.match(reason, /file was not changed/)
  assert.match(reason, /VIBEKIT_GATE=off/)
  assert.doesNotMatch(reason, /["\\]/)
})

test('the start text carries the skill name and body', () => {
  const text = startText('using-vibekit', 'BODY')
  assert.match(text, /using-vibekit/)
  assert.match(text, /\nBODY\n/)
})
```

- [ ] Step 3: In `runtimes/claude-code.mjs`, after the line `import { triggerTable } from '../lib/table.mjs'`, add the line:

```js
import { pipelineSkills, modifierSkills } from '../lib/gate.mjs'
```

- [ ] Step 4: In `runtimes/claude-code.mjs`, replace the line that starts `            command: \`"\${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" edit-gate ` with:

```js
            command: `"\${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" edit-gate ${pipelineSkills(skills).join('+')} ${modifierSkills(skills).join('+')}`,
```

- [ ] Step 5: In `README.md`, replace the line that starts `In Claude Code, a hook backs this up.` with:

```
A guard backs this up in Claude Code, Codex, OpenCode, pi and Antigravity. The agent cannot write or edit a file until it has run one of vibekit's working skills, usually `quick`, and has loaded `lazy`, `terse` and `plain`. The denial tells it which skills are missing. Helper agents that vibekit dispatches are let through, except in pi. Commands run in a shell are not checked. To turn the check off for a session, set `VIBEKIT_GATE=off` in its environment.
```

- [ ] Step 6: Run `npm run generate`
- [ ] Step 7: Run `node --test tests/gate.test.mjs`
- [ ] Step 8: Run `npm run check`
- [ ] Step 9: Run `npm test`
- [ ] Step 10: Commit `feat(gate): the edit guard rule in one place`

### Task 2: the shared hook reads Codex and Antigravity records → verify: `node --test tests/hook.test.mjs` exits 0 and `npm test` exits 0

**Blocked by:** Task 1

**Files:**
- Modify: `hooks/edit-gate` (whole file)
- Modify: `hooks/session-start:37`
- Modify: `tests/hook.test.mjs`

- [ ] Step 1: Replace the whole of `hooks/edit-gate` with exactly the following, and keep the file executable:

```bash
#!/usr/bin/env bash
# PreToolUse hook for Claude Code, Codex and Antigravity: denies a file edit
# in the main session until a pipeline skill has loaded, then until every
# modifier has. $1 is the pipeline skill list and $2 the modifier list, each
# joined with +. The reason must match denyReason in lib/gate.mjs, which a
# test checks.

set -uo pipefail

if [ "${VIBEKIT_GATE:-}" = "off" ]; then
    exit 0
fi

input=$(cat)

# A subagent's call carries agent_id on Claude Code and Codex, and
# parentConversationId on Antigravity. vibekit's subagents are dispatched by
# a stage that already passed the gate. Inside a JSON string the quotes are
# escaped, so an unescaped key name can only be the key itself.
case "$input" in
    *'"agent_id"'*|*'"parentConversationId"'*) exit 0 ;;
esac

# Claude Code and Codex name the record transcript_path, Antigravity names it
# transcriptPath.
record_path() {
    printf '%s' "$input" \
        | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" \
        | head -n 1 \
        | sed 's/\\\\/\\/g'
}
path=$(record_path transcript_path)
if [ -z "$path" ]; then
    path=$(record_path transcriptPath)
fi

# Fail open: a missing or unreadable record must never block every edit.
if [ -z "$path" ] || [ ! -r "$path" ]; then
    exit 0
fi

names=$(printf '%s' "${1:-}" | tr '+' '|')
if [ -z "$names" ]; then
    exit 0
fi

# A skill counts as loaded when the record shows a Skill call or a typed
# /vibekit:<name> command (Claude Code), or a tool call that reads
# <name>/SKILL.md (Codex runs cat inside exec, Antigravity calls read_file).
# Only tool-call lines count there, because Codex and Antigravity also list
# skill paths in their prompts. $1 is one name or an alternation of names.
loaded() {
    if grep -qE "\"name\":\"Skill\",\"input\":\\{\"skill\":\"vibekit:($1)\"|<command-name>/vibekit:($1)</command-name>" "$path"; then
        return 0
    fi
    grep -E '"(custom_tool_call|function_call|tool_calls)"' "$path" \
        | grep -qE "(^|[^A-Za-z0-9_-])($1)/SKILL\\.md"
}

missing=""
if ! loaded "$names"; then
    missing=" vibekit:quick"
fi
for name in $(printf '%s' "${2:-}" | tr '+' ' '); do
    if ! loaded "$name"; then
        missing="$missing vibekit:$name"
    fi
done
if [ -z "$missing" ]; then
    exit 0
fi

# A deny decision reaches the model as a rule with a reason. The reason holds
# no double quote or backslash, so it is valid JSON as is. Antigravity's input
# carries toolCall and reads its own shape. An allowed edit prints nothing,
# which leaves each runtime's own permission handling in place.
reason="vibekit denied this edit, so the file was not changed. Load each of these vibekit skills first, in order:$missing. Then retry the edit. Retrying first is denied again. To turn this check off, set VIBEKIT_GATE=off."
case "$input" in
    *'"toolCall"'*)
        printf '{"decision":"deny","reason":"%s"}\n' "$reason" ;;
    *)
        printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$reason" ;;
esac
exit 0
```

- [ ] Step 2: In `hooks/session-start`, replace the line `if [ -n "${CURSOR_PLUGIN_ROOT:-}" ]; then` with these lines:

```bash
# $1 names the runtime when its hook config passes one. Antigravity reads
# injected steps rather than additional context.
if [ "${1:-}" = "antigravity" ]; then
    printf '{\n  "injectSteps": [{"systemMessage": {"systemMessage": "%s"}}]\n}\n' "$context"
elif [ -n "${CURSOR_PLUGIN_ROOT:-}" ]; then
```

- [ ] Step 3: In `tests/hook.test.mjs`, add `import { denyReason } from '../lib/gate.mjs'` after the line `import { join } from 'node:path'`.
- [ ] Step 4: In `tests/hook.test.mjs`, replace the function `runHook(env)` with this version, which takes an optional runtime argument:

```js
function runHook(env, runtime) {
  const extra = runtime ? [runtime] : []
  const command = process.platform === 'win32'
    ? { file: 'hooks\\run-hook.cmd', args: ['session-start', ...extra], shell: true }
    : { file: 'bash', args: ['hooks/run-hook.cmd', 'session-start', ...extra], shell: false }
  return execFileSync(command.file, command.args, {
    encoding: 'utf8',
    shell: command.shell,
    env: { ...process.env, ...env },
  })
}
```

- [ ] Step 5: In `tests/hook.test.mjs`, in the test `edit-gate denies an edit when no working skill has run, naming everything missing`, replace the line `  assert.match(reason, /vibekit:quick vibekit:lazy vibekit:plain vibekit:terse/)` with `  assert.equal(reason, denyReason(['quick', 'lazy', 'plain', 'terse']))`.
- [ ] Step 6: In `tests/hook.test.mjs`, insert these tests immediately before the line `// A batch file run through cmd /c that exits from inside an if (...) block`:

```js
test('session-start emits the Antigravity injectSteps shape when asked', () => {
  const parsed = JSON.parse(runHook({ CLAUDE_PLUGIN_ROOT: '', CURSOR_PLUGIN_ROOT: '' }, 'antigravity'))
  const text = parsed.injectSteps[0].systemMessage.systemMessage
  assert.ok(text.includes(config.bootstrap))
  assert.ok(text.includes('auto-trigger discipline'))
})

// Codex has no Skill tool. Its model reads SKILL.md with cat inside an exec
// call, which the session record keeps as a custom_tool_call line.
const codexRead = file => ({ type: 'response_item', payload: { type: 'custom_tool_call', name: 'exec', input: `text(await tools.exec_command({cmd:"cat ${file}"}));` } })

test('edit-gate counts Codex reads of SKILL.md in tool calls', () => {
  const path = record(...['quick', 'lazy', 'plain', 'terse'].map(name => codexRead(`/home/u/.codex/plugins/cache/vibekit/vibekit/0.10.3/skills/${name}/SKILL.md`)))
  assert.equal(denial(runGate({ transcript_path: path, tool_name: 'apply_patch' })), null)
})

test('edit-gate counts a Codex read through a skill root alias', () => {
  const path = record(codexRead('r4/quick/SKILL.md r4/lazy/SKILL.md r4/plain/SKILL.md r4/terse/SKILL.md'))
  assert.equal(denial(runGate({ transcript_path: path })), null)
})

test('edit-gate ignores skill paths outside a tool call', () => {
  const listing = plainText('skills: /x/skills/quick/SKILL.md /x/skills/lazy/SKILL.md /x/skills/plain/SKILL.md /x/skills/terse/SKILL.md')
  assert.match(denial(runGate({ transcript_path: record(listing) })), /vibekit:quick/)
})

test('edit-gate does not count a skill whose name only ends like a listed one', () => {
  const path = record(codexRead('/x/notquick/SKILL.md'), ...modifiers)
  assert.match(denial(runGate({ transcript_path: path })), /vibekit:quick/)
})

// Antigravity's model loads a skill with read_file, and its transcript keeps
// the call under tool_calls. Its hook input is camelCase and carries toolCall.
const agyRead = name => ({ step_index: 1, source: 'MODEL', tool_calls: [{ name: 'read_file', args: { Path: `/p/skills/${name}/SKILL.md` } }] })
const agyInput = (transcriptPath, extra = {}) => ({ transcriptPath, toolCall: { id: 't1', name: 'write_file', args: { Path: 'x.txt' } }, hookEventName: 'PreToolUse', ...extra })

test('edit-gate denies an Antigravity edit in its own shape', () => {
  const result = runGate(agyInput(record(agyRead('quick'))))
  assert.equal(result.status, 0, result.stderr)
  const output = JSON.parse(result.stdout)
  assert.equal(output.decision, 'deny')
  assert.equal(output.reason, denyReason(['lazy', 'plain', 'terse']))
})

test('edit-gate allows an Antigravity edit once every skill is read', () => {
  const result = runGate(agyInput(record(...['quick', 'lazy', 'plain', 'terse'].map(agyRead))))
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), '')
})

test('edit-gate lets an Antigravity subagent through', () => {
  const result = runGate(agyInput(record(plainText('hello')), { parentConversationId: 'c-1' }))
  assert.equal(result.stdout.trim(), '')
})
```

- [ ] Step 7: Run `node --test tests/hook.test.mjs`
- [ ] Step 8: Run `npm test`
- [ ] Step 9: Commit `feat(hooks): the edit gate reads Codex and Antigravity records`

### Task 3: Antigravity loads vibekit and runs the guard → verify: `node --test tests/antigravity.test.mjs` exits 0, `npm run check` exits 0, `npm test` exits 0 and `agy plugin validate . --json` exits 0

**Blocked by:** Task 1

**Files:**
- Modify: `runtimes/antigravity.mjs` (whole file)
- Modify: `tests/antigravity.test.mjs`
- Regenerate: `hooks.json`, `package.json` and any other file `npm run generate` writes

- [ ] Step 1: Replace the whole of `runtimes/antigravity.mjs` with exactly:

```js
// runtimes/antigravity.mjs
import { triggerTable } from '../lib/table.mjs'
import { pipelineSkills, modifierSkills } from '../lib/gate.mjs'

export const id = 'antigravity'

// agy reads a plugin's rules from `rules/` and its hooks from `hooks.json` at
// the plugin root, never `hooks/hooks.json`. Hook commands run in the plugin
// folder, so their paths are relative to it. The SessionStart hook injects
// the bootstrap skill and the PreToolUse hook is the edit guard, on the two
// tools agy writes files with.
export function emit(model) {
  const { config, skills } = model
  return {
    'plugin.json': `${JSON.stringify({
      name: config.name,
      description: config.description,
      version: config.version,
    }, null, 2)}\n`,
    'hooks.json': `${JSON.stringify({
      [config.name]: {
        SessionStart: [{ type: 'command', command: './hooks/run-hook.cmd session-start antigravity' }],
        PreToolUse: [{
          matcher: 'write_file|edit_file',
          hooks: [{ type: 'command', command: `./hooks/run-hook.cmd edit-gate ${pipelineSkills(skills).join('+')} ${modifierSkills(skills).join('+')}` }],
        }],
      },
    }, null, 2)}\n`,
  }
}

export function ships() {
  return ['plugin.json', 'hooks.json', 'rules/AGENTS.md']
}

export function regions(model) {
  return { 'rules/AGENTS.md': { 'trigger-table': triggerTable(model.skills) } }
}
```

- [ ] Step 2: In `tests/antigravity.test.mjs`, replace the test `ships both the manifest and the rules file` with:

```js
test('ships the manifest, the hooks file and the rules file', () => {
  const paths = ships(MODEL)
  assert.ok(paths.includes('plugin.json'))
  assert.ok(paths.includes('hooks.json'))
  assert.ok(paths.includes('rules/AGENTS.md'))
})

test('emits a root hooks file that loads vibekit and guards agy edit tools', () => {
  const hooks = JSON.parse(emit(MODEL)['hooks.json']).vibekit
  assert.equal(hooks.SessionStart[0].command, './hooks/run-hook.cmd session-start antigravity')
  assert.equal(hooks.PreToolUse[0].matcher, 'write_file|edit_file')
  assert.equal(hooks.PreToolUse[0].hooks[0].command, './hooks/run-hook.cmd edit-gate alpha ')
})
```

- [ ] Step 3: Run `npm run generate`
- [ ] Step 4: Run `node --test tests/antigravity.test.mjs`
- [ ] Step 5: Run `agy plugin validate . --json`, then confirm in its output that `hooks.json` is no longer reported as never loaded and that at least 1 hook is listed.
- [ ] Step 6: Run `npm run check`
- [ ] Step 7: Run `npm test`
- [ ] Step 8: Commit `feat(antigravity): load vibekit and guard edits`

### Task 4: OpenCode loads vibekit and runs the guard → verify: `node --test tests/opencode.test.mjs` exits 0, `npm run check` exits 0 and `npm test` exits 0

**Blocked by:** Task 1

**Files:**
- Modify: `runtimes/opencode.mjs:1-36`
- Modify: `tests/opencode.test.mjs`
- Regenerate: `.opencode/plugins/vibekit.js`

- [ ] Step 1: In `runtimes/opencode.mjs`, replace everything from the first line through the closing line of the `plugin(model)` function (the line `}` after the template's closing `\``) with exactly:

```js
// runtimes/opencode.mjs
import { pipelineSkills, modifierSkills, missingSkills, denyReason, startText } from '../lib/gate.mjs'

export const id = 'opencode'

// opencode v2 takes skills one at a time through skill.transform, each with
// its name and description as separate fields. Both are baked in from the
// model, so the only frontmatter parser stays the generator's and the plugin
// reads each file for its content alone. The plugin also pushes the bootstrap
// skill into the system prompt and runs the edit guard. Each of those parts
// is skipped on an opencode without the hook it needs, and any error inside
// the guard allows the edit.
function plugin(model) {
  const list = model.skills
    .map(skill => `  ${JSON.stringify({ name: skill.name, description: skill.description })},`)
    .join('\n')
  return `// Generated by vibekit. Do not edit.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../skills')
const LIST = [
${list}
]
const BOOTSTRAP = ${JSON.stringify(model.config.bootstrap)}
const PIPELINE = ${JSON.stringify(pipelineSkills(model.skills))}
const MODIFIERS = ${JSON.stringify(modifierSkills(model.skills))}
const missingSkills = ${missingSkills.toString()}
const denyReason = ${denyReason.toString()}
const startText = ${startText.toString()}

function body(name) {
  return readFileSync(path.join(SKILLS, name, 'SKILL.md'), 'utf8').replace(/^---\\r?\\n[\\s\\S]*?\\r?\\n---(?:\\r?\\n)?/, '')
}

export default {
  id: ${JSON.stringify(model.config.name)},
  setup: async ctx => {
    await ctx.skill.transform(draft => {
      for (const { name, description } of LIST) {
        draft.add({ id: name, name, description, path: path.join(SKILLS, name, 'SKILL.md'), content: body(name) })
      }
    })

    const loaded = new Map()
    const mark = (sessionID, name) => {
      if (!loaded.has(sessionID)) loaded.set(sessionID, new Set())
      loaded.get(sessionID).add(name)
    }

    let start = ''
    try {
      start = startText(BOOTSTRAP, body(BOOTSTRAP))
    } catch {}
    if (start) {
      await ctx.session?.hook?.('context', async context => {
        context.system.push({ type: 'text', text: start })
      })
    }

    // The model loads a skill through the skill tool. A skill the user
    // starts directly arrives as a session.skill.activated event instead.
    await ctx.tool?.hook?.('execute.after', async event => {
      if (event.tool === 'skill' && event.status === 'completed' && event.input?.id) mark(event.sessionID, event.input.id)
    })
    const events = ctx.event?.subscribe?.()
    if (events) {
      ;(async () => {
        try {
          for await (const event of events) {
            if (event?.type !== 'session.skill.activated') continue
            const data = event.properties ?? event
            if (data.sessionID && data.id) mark(data.sessionID, data.id)
          }
        } catch {}
      })()
    }

    // A session with a parentID is a subagent, dispatched by a stage that
    // already passed the guard.
    await ctx.permission?.hook?.('evaluate', async event => {
      if (event.action !== 'edit' || process.env.VIBEKIT_GATE === 'off') return
      try {
        const session = await ctx.session.get({ sessionID: event.sessionID })
        if (session?.parentID) return
        const missing = missingSkills(loaded.get(event.sessionID) ?? new Set(), PIPELINE, MODIFIERS)
        if (missing.length) {
          event.effect = 'deny'
          event.message = denyReason(missing)
        }
      } catch {}
    })
  },
}
`
}
```

- [ ] Step 2: In `tests/opencode.test.mjs`, add `import { denyReason } from '../lib/gate.mjs'` after the line `import { MODEL, skillFile } from './helpers.mjs'`.
- [ ] Step 3: In `tests/opencode.test.mjs`, append these tests at the end of the file:

```js
// Stands in for the v2 hooks the guard uses, keeping each registered handler
// so a test can call it the way opencode would.
async function hooked(plugin, sessions = {}) {
  const handlers = {}
  const hook = kind => async (name, fn) => { handlers[`${kind}.${name}`] = fn }
  await plugin.setup({
    skill: { transform: async fn => fn({ add: () => {} }) },
    session: { hook: hook('session'), get: async ({ sessionID }) => sessions[sessionID] ?? { id: sessionID } },
    tool: { hook: hook('tool') },
    permission: { hook: hook('permission') },
  })
  return handlers
}

const guarded = { ...MODEL, skills: [...MODEL.skills, { name: 'lazy', description: 'Lazy. Stays on after.', trigger: 'always', command: false, gate: 'none', dir: 'lazy' }] }

async function evaluate(handlers, sessionID, action = 'edit') {
  const event = { action, sessionID }
  await handlers['permission.evaluate'](event)
  return event
}

test('denies an edit until a pipeline skill and every modifier are loaded', async t => {
  const { plugin } = await load(guarded, t)
  const handlers = await hooked(plugin)
  const first = await evaluate(handlers, 's1')
  assert.equal(first.effect, 'deny')
  assert.equal(first.message, denyReason(['quick', 'lazy']))
  await handlers['tool.execute.after']({ tool: 'skill', status: 'completed', sessionID: 's1', input: { id: 'alpha' } })
  await handlers['tool.execute.after']({ tool: 'skill', status: 'completed', sessionID: 's1', input: { id: 'lazy' } })
  assert.equal((await evaluate(handlers, 's1')).effect, undefined)
})

test('keeps each session separate and ignores actions other than edit', async t => {
  const { plugin } = await load(guarded, t)
  const handlers = await hooked(plugin)
  await handlers['tool.execute.after']({ tool: 'skill', status: 'completed', sessionID: 's1', input: { id: 'alpha' } })
  await handlers['tool.execute.after']({ tool: 'skill', status: 'completed', sessionID: 's1', input: { id: 'lazy' } })
  assert.equal((await evaluate(handlers, 's2')).effect, 'deny')
  assert.equal((await evaluate(handlers, 's2', 'skill')).effect, undefined)
})

test('lets a subagent session through', async t => {
  const { plugin } = await load(guarded, t)
  const handlers = await hooked(plugin, { child: { id: 'child', parentID: 's1' } })
  assert.equal((await evaluate(handlers, 'child')).effect, undefined)
})

test('allows every edit when VIBEKIT_GATE is off', async t => {
  const { plugin } = await load(guarded, t)
  const handlers = await hooked(plugin)
  process.env.VIBEKIT_GATE = 'off'
  t.after(() => { delete process.env.VIBEKIT_GATE })
  assert.equal((await evaluate(handlers, 's1')).effect, undefined)
})

test('pushes the bootstrap skill into the system prompt', async t => {
  const model = { ...guarded, skills: [...guarded.skills, { name: 'using-vibekit', description: 'Boot.', trigger: 'start', command: false, gate: 'none', dir: 'using-vibekit' }] }
  const { plugin } = await load(model, t)
  const handlers = await hooked(plugin)
  const context = { system: [] }
  await handlers['session.context'](context)
  assert.equal(context.system.length, 1)
  assert.equal(context.system[0].type, 'text')
  assert.match(context.system[0].text, /using-vibekit/)
})
```

- [ ] Step 4: Run `npm run generate`
- [ ] Step 5: Run `node --test tests/opencode.test.mjs`
- [ ] Step 6: Run `npm run check`
- [ ] Step 7: Run `npm test`
- [ ] Step 8: Commit `feat(opencode): load vibekit and guard edits`

### Task 5: pi loads vibekit and runs the guard → verify: `node --test tests/pi.test.mjs` exits 0, `npm run check` exits 0 and `npm test` exits 0

**Blocked by:** Task 3

**Files:**
- Modify: `runtimes/pi.mjs` (whole file)
- Modify: `tests/pi.test.mjs` (whole file)
- Regenerate: `.pi/vibekit.js`, `package.json`

- [ ] Step 1: Replace the whole of `runtimes/pi.mjs` with exactly:

```js
// runtimes/pi.mjs
import { pipelineSkills, modifierSkills, missingSkills, denyReason, startText } from '../lib/gate.mjs'

export const id = 'pi'

// Pi reads a `pi` block from package.json: native skills, plus one extension
// that appends the bootstrap skill to the system prompt and runs the edit
// guard. A pi extension that throws blocks the tool, so every handler here
// catches its own errors and lets the call through.
function extension(model) {
  return `// Generated by vibekit. Do not edit.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SKILLS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../skills')
const BOOTSTRAP = ${JSON.stringify(model.config.bootstrap)}
const PIPELINE = ${JSON.stringify(pipelineSkills(model.skills))}
const MODIFIERS = ${JSON.stringify(modifierSkills(model.skills))}
const missingSkills = ${missingSkills.toString()}
const denyReason = ${denyReason.toString()}
const startText = ${startText.toString()}

// The model loads a skill by reading its SKILL.md, and a typed /skill:name
// arrives in the prompt as a skill block.
const SKILL_PATH = /([^/\\\\]+)[/\\\\]SKILL\\.md$/
const PROMPT_SKILL = /<skill name="([^"]+)"/g

function body(name) {
  return readFileSync(path.join(SKILLS, name, 'SKILL.md'), 'utf8').replace(/^---\\r?\\n[\\s\\S]*?\\r?\\n---(?:\\r?\\n)?/, '')
}

export default function (pi) {
  const loaded = new Map()
  const mark = (id, name) => {
    if (!loaded.has(id)) loaded.set(id, new Set())
    loaded.get(id).add(name)
  }

  let start = ''
  try {
    start = startText(BOOTSTRAP, body(BOOTSTRAP))
  } catch {}

  pi.on('before_agent_start', async (event, ctx) => {
    try {
      const id = ctx.sessionManager.getSessionId()
      for (const match of String(event.prompt ?? '').matchAll(PROMPT_SKILL)) mark(id, match[1])
      if (start) return { systemPrompt: event.systemPrompt + '\\n\\n' + start }
    } catch {}
  })

  pi.on('tool_call', async (event, ctx) => {
    try {
      const id = ctx.sessionManager.getSessionId()
      if (event.toolName === 'read') {
        const match = String(event.input?.path ?? '').match(SKILL_PATH)
        if (match) mark(id, match[1])
        return
      }
      if (!['write', 'edit'].includes(event.toolName) || process.env.VIBEKIT_GATE === 'off') return
      const missing = missingSkills(loaded.get(id) ?? new Set(), PIPELINE, MODIFIERS)
      if (missing.length) return { block: true, reason: denyReason(missing) }
    } catch {}
  })
}
`
}

export function emit(model) {
  return { '.pi/vibekit.js': extension(model) }
}

export function pkg() {
  return { pi: { skills: ['./skills'], extensions: ['./.pi/vibekit.js'] } }
}

export function ships() {
  return ['.pi/']
}
```

- [ ] Step 2: Replace the whole of `tests/pi.test.mjs` with exactly:

```js
// tests/pi.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { id, emit, pkg, ships } from '../runtimes/pi.mjs'
import { denyReason } from '../lib/gate.mjs'
import { MODEL, skillFile } from './helpers.mjs'

const guarded = {
  ...MODEL,
  skills: [
    ...MODEL.skills,
    { name: 'lazy', description: 'Lazy. Stays on after.', trigger: 'always', command: false, gate: 'none', dir: 'lazy' },
    { name: 'using-vibekit', description: 'Boot.', trigger: 'start', command: false, gate: 'none', dir: 'using-vibekit' },
  ],
}

// The extension finds its skills at ../skills relative to itself, so it is
// imported from a throwaway tree shaped like the shipped package, then handed
// a stand-in for pi that keeps each registered handler.
async function load(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'vibekit-pi-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  writeFileSync(join(root, 'package.json'), '{"type":"module"}')
  for (const { name } of guarded.skills) {
    mkdirSync(join(root, 'skills', name), { recursive: true })
    writeFileSync(join(root, 'skills', name, 'SKILL.md'), skillFile({ name }))
  }
  mkdirSync(join(root, '.pi'))
  const file = join(root, '.pi/vibekit.js')
  writeFileSync(file, emit(guarded)['.pi/vibekit.js'])
  const handlers = {}
  ;(await import(pathToFileURL(file).href)).default({ on: (name, fn) => { handlers[name] = fn } })
  return { root, handlers }
}

const session = sessionID => ({ sessionManager: { getSessionId: () => sessionID } })
const call = (handlers, toolName, input, sessionID = 's1') => handlers.tool_call({ toolName, input }, session(sessionID))

test('is identified as pi', () => {
  assert.equal(id, 'pi')
})

test('contributes skills and the extension, and ships the extension folder', () => {
  assert.deepEqual(pkg(MODEL).pi, { skills: ['./skills'], extensions: ['./.pi/vibekit.js'] })
  assert.ok('.pi/vibekit.js' in emit(MODEL))
  assert.deepEqual(ships(MODEL), ['.pi/'])
})

test('blocks a write until a pipeline skill and every modifier are read', async t => {
  const { root, handlers } = await load(t)
  assert.deepEqual(await call(handlers, 'write', { path: 'x.txt' }), { block: true, reason: denyReason(['quick', 'lazy']) })
  await call(handlers, 'read', { path: join(root, 'skills/alpha/SKILL.md') })
  await call(handlers, 'read', { path: join(root, 'skills/lazy/SKILL.md'), offset: 1 })
  assert.equal(await call(handlers, 'edit', { path: 'x.txt' }), undefined)
  assert.equal((await call(handlers, 'write', { path: 'x.txt' }, 's2')).block, true)
})

test('counts a skill typed as /skill:name in the prompt', async t => {
  const { handlers } = await load(t)
  await handlers.before_agent_start({ prompt: '<skill name="alpha" location="x">a</skill><skill name="lazy" location="y">b</skill>', systemPrompt: 'base' }, session('s1'))
  assert.equal(await call(handlers, 'write', { path: 'x.txt' }), undefined)
})

test('appends the bootstrap skill to the system prompt', async t => {
  const { handlers } = await load(t)
  const result = await handlers.before_agent_start({ prompt: 'hi', systemPrompt: 'base' }, session('s1'))
  assert.match(result.systemPrompt, /^base\n\n<EXTREMELY_IMPORTANT>/)
  assert.match(result.systemPrompt, /using-vibekit/)
})

test('lets every call through when VIBEKIT_GATE is off or a handler fails', async t => {
  const { handlers } = await load(t)
  process.env.VIBEKIT_GATE = 'off'
  t.after(() => { delete process.env.VIBEKIT_GATE })
  assert.equal(await call(handlers, 'write', { path: 'x.txt' }), undefined)
  delete process.env.VIBEKIT_GATE
  assert.equal(await handlers.tool_call({ toolName: 'write', input: {} }, {}), undefined)
})
```

- [ ] Step 3: Run `npm run generate`
- [ ] Step 4: Run `node --test tests/pi.test.mjs`
- [ ] Step 5: Run `npm run check`
- [ ] Step 6: Run `npm test`
- [ ] Step 7: Commit `feat(pi): load vibekit and guard edits`
