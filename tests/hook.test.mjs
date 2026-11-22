// tests/hook.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
