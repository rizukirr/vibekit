// tests/hook.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

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
