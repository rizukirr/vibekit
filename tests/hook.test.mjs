// tests/hook.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { denyReason } from '../lib/gate.mjs'

const config = JSON.parse(readFileSync('vibekit.config.json', 'utf8'))

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

// W4: the hook exits 0 unconditionally, so malformed JSON disables every skill
// with no error. Escaping must survive a body containing quotes and backslashes.
test('emits parseable JSON for a bootstrap body containing quotes, backslashes and tabs', () => {
  const path = `skills/${config.bootstrap}/SKILL.md`
  const original = readFileSync(path, 'utf8')
  try {
    writeFileSync(path, `${original}\nHostile: "quoted" \\backslash\\ \ttab\n`)
    const parsed = JSON.parse(runHook({ CLAUDE_PLUGIN_ROOT: process.cwd(), COPILOT_CLI: '' }))
    const context = parsed.hookSpecificOutput.additionalContext
    assert.ok(context.includes('Hostile:'), 'hostile line must survive escaping')
    assert.ok(context.includes('"quoted"'), 'quotes must survive escaping')
    assert.ok(context.includes('\\backslash\\'), 'backslashes must survive escaping')
  } finally {
    writeFileSync(path, original)
  }
})

// edit-gate: run the real script through the wrapper, the way Claude Code does.
const GATE_LIST = 'brainstorm+quick'
const MODIFIERS = 'lazy+plain+terse'

function runGate(input, env = {}) {
  const command = process.platform === 'win32'
    ? { file: 'hooks\\run-hook.cmd', args: ['edit-gate', GATE_LIST, MODIFIERS], shell: true }
    : { file: 'bash', args: ['hooks/run-hook.cmd', 'edit-gate', GATE_LIST, MODIFIERS], shell: false }
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
const modifiers = ['lazy', 'plain', 'terse'].map(name => skillCall(`vibekit:${name}`))

// The gate denies through a PreToolUse decision on stdout and always exits 0.
function denial(result) {
  assert.equal(result.status, 0, result.stderr)
  if (!result.stdout.trim()) return null
  const output = JSON.parse(result.stdout).hookSpecificOutput
  assert.equal(output.hookEventName, 'PreToolUse')
  assert.equal(output.permissionDecision, 'deny')
  return output.permissionDecisionReason
}

test('edit-gate denies an edit when no working skill has run, naming everything missing', () => {
  const reason = denial(runGate({ transcript_path: record(plainText('hello')) }))
  assert.equal(reason, denyReason(['quick', 'lazy', 'plain', 'terse']))
  assert.match(reason, /file was not changed/)
  assert.match(reason, /VIBEKIT_GATE=off/)
})

test('edit-gate allows an edit after a Skill call to a working skill', () => {
  assert.equal(denial(runGate({ transcript_path: record(skillCall('vibekit:quick'), ...modifiers) })), null)
})

test('edit-gate allows an edit after a typed slash command for a working skill', () => {
  const path = record(plainText('<command-name>/vibekit:quick</command-name>'), ...modifiers)
  assert.equal(denial(runGate({ transcript_path: path })), null)
})

test('edit-gate does not count a modifier skill', () => {
  assert.match(denial(runGate({ transcript_path: record(...modifiers) })), /vibekit:quick/)
})

test('edit-gate denies an edit until every modifier has run, naming only the missing ones', () => {
  const reason = denial(runGate({ transcript_path: record(skillCall('vibekit:quick'), skillCall('vibekit:lazy')) }))
  assert.match(reason, /vibekit:plain vibekit:terse/)
  assert.doesNotMatch(reason, /vibekit:(quick|lazy)/)
})

test('edit-gate does not count a prose mention of a command', () => {
  assert.match(denial(runGate({ transcript_path: record(plainText('try /vibekit:quick next'), ...modifiers) })), /vibekit:quick/)
})

test('edit-gate lets a subagent edit through', () => {
  assert.equal(denial(runGate({ transcript_path: record(plainText('hello')), agent_id: 'sub-1' })), null)
})

test('edit-gate is off when VIBEKIT_GATE=off', () => {
  assert.equal(denial(runGate({ transcript_path: record(plainText('hello')) }, { VIBEKIT_GATE: 'off' })), null)
})

test('edit-gate fails open when the record is missing', () => {
  assert.equal(denial(runGate({})), null)
  assert.equal(denial(runGate({ transcript_path: join(tmpdir(), 'vibekit-no-such-record.jsonl') })), null)
})

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

// A batch file run through cmd /c that exits from inside an if (...) block
// reports 0, whatever the exit code. Windows CI measured it in run 44934455053.
function exitsInsideBlocks(text) {
  const lines = text.split(/\r?\n/)
  const end = lines.indexOf('CMDBLOCK')
  const found = []
  let depth = 0
  for (const [index, raw] of lines.slice(0, end === -1 ? lines.length : end).entries()) {
    const line = raw.trim()
    if (depth > 0 && /^exit \/b\b/i.test(line)) found.push(index + 1)
    if (line.endsWith('(')) depth++
    else if (line === ')') depth--
  }
  return found
}

// The wrapper's batch half at 3c66c5d, which lost every exit code on Windows.
const BLOCK_EXIT_WRAPPER = String.raw`: << 'CMDBLOCK'
@echo off
if "%~1"=="" (
    echo run-hook.cmd: missing script name >&2
    exit /b 1
)
set "HOOK_DIR=%~dp0"
if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b
)
exit /b 0
CMDBLOCK`

test('the batch half of run-hook.cmd never exits from inside an if block', () => {
  assert.deepEqual(exitsInsideBlocks(readFileSync('hooks/run-hook.cmd', 'utf8')), [])
})

test('the block-exit scan catches the wrapper that lost exit codes on Windows', () => {
  assert.ok(exitsInsideBlocks(BLOCK_EXIT_WRAPPER).length > 0)
})

// Claude Code runs hooks/run-hook.cmd directly, so a script committed
// without its executable bit fails with Permission denied on install.
test('every hook script is committed executable', () => {
  const entries = execFileSync('git', ['ls-files', '-s', 'hooks/'], { encoding: 'utf8' })
    .trim().split('\n').map(line => line.split(/\s+/))
    .filter(([, , , path]) => !path.endsWith('.json'))
  assert.ok(entries.length > 0)
  for (const [mode, , , path] of entries) assert.equal(mode, '100755', `${path} is ${mode}`)
})
