// tests/eval-session.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runSession } from '../evals/session.mjs'

const transcript = readFileSync('evals/fixtures/skill-fired.jsonl', 'utf8')
const scenario = { id: 's', prompt: 'hi', model: 'haiku', expect: { skill: 'vibekit:example-plain' } }

function fakeSpawn(record) {
  return (cmd, args, opts) => {
    record.push({ cmd, args, opts })
    return { status: 0, stdout: transcript, stderr: '' }
  }
}

test('runs claude with the plugin dir under test', async () => {
  const calls = []
  await runSession(scenario, '/plugins/candidate', fakeSpawn(calls))
  assert.equal(calls[0].cmd, 'claude')
  const args = calls[0].args
  assert.ok(args.includes('--plugin-dir'))
  assert.equal(args[args.indexOf('--plugin-dir') + 1], '/plugins/candidate')
})

test('always passes --verbose with stream-json, which the CLI requires', () => {
  const calls = []
  runSession(scenario, '/plugins/candidate', fakeSpawn(calls))
  const args = calls[0].args
  assert.ok(args.includes('--output-format') && args.includes('stream-json'))
  assert.ok(args.includes('--verbose'), '--output-format=stream-json requires --verbose')
})

test('runs in a disposable temp cwd, never the repo', () => {
  const calls = []
  runSession(scenario, '/plugins/candidate', fakeSpawn(calls))
  const cwd = calls[0].opts.cwd
  assert.ok(cwd.startsWith(tmpdir()), `cwd ${cwd} must be under ${tmpdir()}`)
  assert.notEqual(cwd, process.cwd())
})

test('removes the temp cwd afterwards', () => {
  const calls = []
  runSession(scenario, '/plugins/candidate', fakeSpawn(calls))
  assert.equal(existsSync(calls[0].opts.cwd), false)
})

test('disallows Bash so a session cannot run arbitrary commands', () => {
  const calls = []
  runSession(scenario, '/plugins/candidate', fakeSpawn(calls))
  const args = calls[0].args
  assert.ok(args.includes('--disallowedTools'), 'must pass --disallowedTools')
  assert.equal(args[args.indexOf('--disallowedTools') + 1], 'Bash')
})

test('returns the parsed transcript', () => {
  const result = runSession(scenario, '/plugins/candidate', fakeSpawn([]))
  assert.equal(result.ok, true)
  assert.equal(result.skills[0].name, 'vibekit:example-plain')
})

test('seeds scenario files into the session cwd before the run', () => {
  const calls = []
  const seeded = { 'docs/specs/x-design.md': '---\nstatus: approved\n---\n' }
  const spawn = (cmd, args, opts) => {
    calls.push({ cmd, args, opts })
    // Read inside the spawn stub: this is the only moment the cwd is alive
    // and the session would be looking at it.
    calls[0].seen = readFileSync(join(opts.cwd, 'docs/specs/x-design.md'), 'utf8')
    return { status: 0, stdout: transcript, stderr: '' }
  }
  runSession({ ...scenario, files: seeded }, '/plugins/candidate', spawn)
  assert.equal(calls[0].seen, seeded['docs/specs/x-design.md'])
})

test('creates parent directories for seeded files', () => {
  const calls = []
  const spawn = (cmd, args, opts) => {
    calls.push({ opts })
    calls[0].ok = existsSync(join(opts.cwd, 'a/b/c/deep.md'))
    return { status: 0, stdout: transcript, stderr: '' }
  }
  runSession({ ...scenario, files: { 'a/b/c/deep.md': 'x' } }, '/plugins/candidate', spawn)
  assert.equal(calls[0].ok, true)
})

test('a scenario with no files still runs', () => {
  const calls = []
  const result = runSession(scenario, '/plugins/candidate', fakeSpawn(calls))
  assert.equal(result.ok, true)
})
