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

// DIAG: temporary, Windows only. Measures where a non-zero exit code is lost.
test('DIAG windows exit code paths', { skip: process.platform !== 'win32' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'vibekit-diag-'))
  const bash = '"C:\\Program Files\\Git\\bin\\bash.exe"'
  const cases = {
    'block-bare.cmd': `@echo off\r\nif exist "C:\\Program Files\\Git\\bin\\bash.exe" (\r\n    ${bash} -c "exit 2"\r\n    exit /b\r\n)\r\n`,
    'block-percent.cmd': `@echo off\r\nif exist "C:\\Program Files\\Git\\bin\\bash.exe" (\r\n    ${bash} -c "exit 2"\r\n    exit /b %ERRORLEVEL%\r\n)\r\n`,
    'goto.cmd': `@echo off\r\nif exist "C:\\Program Files\\Git\\bin\\bash.exe" goto run\r\nexit /b 0\r\n:run\r\n${bash} -c "exit 2"\r\nexit /b %ERRORLEVEL%\r\n`,
    'echo-after.cmd': `@echo off\r\n${bash} -c "exit 2"\r\necho errorlevel-after-bash=%ERRORLEVEL%\r\nexit /b %ERRORLEVEL%\r\n`,
    'usr-bash.cmd': `@echo off\r\n"C:\\Program Files\\Git\\usr\\bin\\bash.exe" -c "exit 2"\r\nexit /b %ERRORLEVEL%\r\n`,
  }
  for (const [name, body] of Object.entries(cases)) {
    writeFileSync(join(dir, name), body)
    const r = spawnSync(join(dir, name), [], { encoding: 'utf8', shell: true })
    console.log('DIAG-WIN', name, JSON.stringify({ status: r.status, stdout: r.stdout, stderr: r.stderr }))
  }
  const direct = spawnSync('C:\\Program Files\\Git\\bin\\bash.exe', ['-c', 'exit 2'], { encoding: 'utf8' })
  console.log('DIAG-WIN direct-bin-bash', JSON.stringify({ status: direct.status }))
})
