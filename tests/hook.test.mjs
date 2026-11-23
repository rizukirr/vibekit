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
