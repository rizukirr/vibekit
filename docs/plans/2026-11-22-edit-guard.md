# edit guard: Implementation Plan

**Spec:** docs/specs/2026-11-22-edit-guard-design.md
**Goal:** Block Write, Edit and NotebookEdit in a Claude Code main session until a working vibekit skill has run.
**Architecture:** A bash script `hooks/edit-gate`, run through `hooks/run-hook.cmd`, greps the session record for a working skill and exits 2 when none ran. `runtimes/claude-code.mjs` registers it as a PreToolUse hook and passes the skill list, derived from frontmatter, as one comma-joined argument.

## Global constraints
- No new dependency. The hook is bash and standard tools only, no `jq`, no `node`.
- Generated files are regenerated with `npm run generate`, never hand-edited.
- Every edited string obeys `plain`'s rules, which `npm test` checks.
- No shipped file names an outside source, as `tests/no-external-references.test.mjs` requires.
- `run-hook.cmd` forwards at most 8 arguments on Windows, so the skill list is one comma-joined argument.
- Run limits: at most 3 verify rounds, at most $0 on paid runs

### Task 1: edit-gate script and its tests → verify: `test -x hooks/edit-gate` exits 0 and `npm test` exits 0

**Files:**
- Create: `hooks/edit-gate` (mode 755)
- Modify: `tests/hook.test.mjs:4-5` (imports) and the end of the file (new tests)

- [x] Step 1: Create `hooks/edit-gate` with exactly this content, then run `chmod +x hooks/edit-gate`:

```bash
#!/usr/bin/env bash
# PreToolUse hook: blocks Write, Edit and NotebookEdit in the main session
# until a working vibekit skill has run. $1 is the comma-joined skill list.

set -uo pipefail

if [ "${VIBEKIT_GATE:-}" = "off" ]; then
    exit 0
fi

input=$(cat)

# A subagent's call carries agent_id, and vibekit's subagents are dispatched
# by a stage that already passed the gate. Inside a JSON string the quotes
# are escaped, so an unescaped "agent_id" can only be the key itself.
case "$input" in
    *'"agent_id"'*) exit 0 ;;
esac

path=$(printf '%s' "$input" \
    | sed -n 's/.*"transcript_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    | head -n 1 \
    | sed 's/\\\\/\\/g')

# Fail open: a missing or unreadable record must never block every edit.
if [ -z "$path" ] || [ ! -r "$path" ]; then
    exit 0
fi

names=$(printf '%s' "${1:-}" | tr ',' '|')
if [ -z "$names" ]; then
    exit 0
fi

# Only the two exact record forms count. The bare text /vibekit:<name>
# also appears in skill descriptions, which every session carries.
if grep -qE "\"name\":\"Skill\",\"input\":\\{\"skill\":\"vibekit:($names)\"|<command-name>/vibekit:($names)</command-name>" "$path"; then
    exit 0
fi

echo "No vibekit gate has run in this session. Invoke vibekit:quick first, then retry. To turn this check off, set VIBEKIT_GATE=off." >&2
exit 2
```

- [x] Step 2: In `tests/hook.test.mjs`, replace the two lines

```js
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
```

with

```js
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
```

- [x] Step 3: Append to the end of `tests/hook.test.mjs`:

```js
// edit-gate: run the real script through the wrapper, the way Claude Code does.
const GATE_LIST = 'brainstorm,quick'

function runGate(input, env = {}) {
  const command = process.platform === 'win32'
    ? { file: 'hooks\\run-hook.cmd', args: ['edit-gate', GATE_LIST], shell: true }
    : { file: 'bash', args: ['hooks/run-hook.cmd', 'edit-gate', GATE_LIST], shell: false }
  return spawnSync(command.file, command.args, {
    input: JSON.stringify(input),
    encoding: 'utf8',
    shell: command.shell,
    env: { ...process.env, VIBEKIT_GATE: '', ...env },
  })
}

function record(...lines) {
  const path = join(mkdtempSync(join(tmpdir(), 'vibekit-gate-')), 'session.jsonl')
  writeFileSync(path, `${lines.map(line => JSON.stringify(line)).join('\n')}\n`)
  return path
}

const skillCall = skill => ({ message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill } }] } })
const plainText = text => ({ message: { content: text } })

test('edit-gate blocks an edit when no working skill has run', () => {
  const result = runGate({ transcript_path: record(plainText('hello')) })
  assert.equal(result.status, 2)
  assert.match(result.stderr, /invoke vibekit:quick/i)
  assert.match(result.stderr, /VIBEKIT_GATE=off/)
})

test('edit-gate allows an edit after a Skill call to a working skill', () => {
  assert.equal(runGate({ transcript_path: record(skillCall('vibekit:quick')) }).status, 0)
})

test('edit-gate allows an edit after a typed slash command for a working skill', () => {
  const path = record(plainText('<command-name>/vibekit:quick</command-name>'))
  assert.equal(runGate({ transcript_path: path }).status, 0)
})

test('edit-gate does not count a modifier skill', () => {
  assert.equal(runGate({ transcript_path: record(skillCall('vibekit:lazy')) }).status, 2)
})

test('edit-gate does not count a prose mention of a command', () => {
  assert.equal(runGate({ transcript_path: record(plainText('try /vibekit:quick next')) }).status, 2)
})

test('edit-gate lets a subagent edit through', () => {
  assert.equal(runGate({ transcript_path: record(plainText('hello')), agent_id: 'sub-1' }).status, 0)
})

test('edit-gate is off when VIBEKIT_GATE=off', () => {
  assert.equal(runGate({ transcript_path: record(plainText('hello')) }, { VIBEKIT_GATE: 'off' }).status, 0)
})

test('edit-gate fails open when the record is missing', () => {
  assert.equal(runGate({}).status, 0)
  assert.equal(runGate({ transcript_path: join(tmpdir(), 'vibekit-no-such-record.jsonl') }).status, 0)
})
```

- [x] Step 4: Run `test -x hooks/edit-gate`
- [x] Step 5: Run `npm test`
- [x] Step 6: Commit `feat(hooks): edit-gate script`

### Task 2: register the hook in the generated hooks.json → verify: `npm run check` exits 0, `npm test` exits 0, and `grep -c '"PreToolUse"' hooks/hooks.json` prints at least 1

**Files:**
- Modify: `runtimes/claude-code.mjs:37-52` (the `hooks/hooks.json` entry)
- Modify: `tests/claude-code.test.mjs:1-4` (imports) and after the SessionStart test (new test)
- Regenerate: `hooks/hooks.json` and any other file `npm run generate` writes

- [x] Step 1: In `runtimes/claude-code.mjs`, inside the object passed to `json(...)` for `'hooks/hooks.json'`, add a `PreToolUse` key after the `SessionStart` array, so the `hooks` object reads:

```js
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
        // The edit gate. Its list is every skill that counts as entering the
        // pipeline: each hard gate and each command, so a new skill joins or
        // stays out by its own frontmatter. One comma-joined argument, because
        // run-hook.cmd forwards at most 8 arguments on Windows.
        PreToolUse: [{
          matcher: 'Write|Edit|NotebookEdit',
          hooks: [{
            type: 'command',
            command: `"\${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" edit-gate ${skills.filter(s => s.gate === 'hard' || s.command).map(s => s.name).sort().join(',')}`,
            shell: 'bash',
            async: false,
          }],
        }],
      },
```

- [x] Step 2: In `tests/claude-code.test.mjs`, after the line `import { MODEL } from './helpers.mjs'`, add:

```js
import { readFileSync } from 'node:fs'
import { buildModel } from '../lib/model.mjs'
```

- [x] Step 3: In `tests/claude-code.test.mjs`, after the test `emits a SessionStart hook that runs through the polyglot wrapper`, add:

```js
test('emits a PreToolUse edit gate listing every hard-gate or command skill on disk', () => {
  const model = buildModel(JSON.parse(readFileSync('vibekit.config.json', 'utf8')), 'skills')
  const entry = JSON.parse(emit(model)['hooks/hooks.json']).hooks.PreToolUse[0]
  const list = entry.hooks[0].command.split(' edit-gate ')[1].split(',')
  assert.equal(entry.matcher, 'Write|Edit|NotebookEdit')
  assert.match(entry.hooks[0].command, /run-hook\.cmd" edit-gate /)
  for (const skill of model.skills) {
    assert.equal(list.includes(skill.name), skill.gate === 'hard' || skill.command, skill.name)
  }
  assert.deepEqual(list, [...list].sort())
})
```

- [x] Step 4: Run `npm run generate`
- [x] Step 5: Run `npm run check`
- [x] Step 6: Run `npm test`
- [x] Step 7: Commit `feat(hooks): register the edit gate`

### Task 3: README names the guard → verify: `grep -c 'VIBEKIT_GATE=off' README.md` prints at least 1, `npm run check` exits 0, and `npm test` exits 0

**Files:**
- Modify: `README.md:11`

- [ ] Step 1: In `README.md`, after the line that starts `Six skills are gates.`, add a blank line and this paragraph:

```
In Claude Code, a hook backs this up. The agent cannot write or edit a file until it has run one of vibekit's working skills, usually `quick`, and the block message tells it so. Helper agents that vibekit dispatches are let through. To turn the check off for a session, set `VIBEKIT_GATE=off` in its environment.
```

- [ ] Step 2: Run `npm run check`
- [ ] Step 3: Run `npm test`
- [ ] Step 4: Commit `docs(readme): the edit guard`
