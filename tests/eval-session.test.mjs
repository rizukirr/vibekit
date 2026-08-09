// tests/eval-session.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
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

test('returns files the session produced, keyed by relative path', () => {
  const spawn = (cmd, args, opts) => {
    mkdirSync(join(opts.cwd, 'docs/plans'), { recursive: true })
    writeFileSync(join(opts.cwd, 'docs/plans/2026-08-05-thing.md'), '# Plan\n')
    return { status: 0, stdout: transcript, stderr: '' }
  }
  const result = runSession(scenario, '/plugins/candidate', spawn)
  assert.equal(result.files['docs/plans/2026-08-05-thing.md'], '# Plan\n')
})

test('returns seeded files alongside produced ones, and records what was seeded', () => {
  const files = { 'docs/specs/x-design.md': 'seed\n' }
  const result = runSession({ ...scenario, files }, '/plugins/candidate', fakeSpawn([]))
  assert.equal(result.files['docs/specs/x-design.md'], 'seed\n')
  assert.equal(result.seeded['docs/specs/x-design.md'], 'seed\n')
})

test('skips node_modules so a pathological session cannot blow up the read', () => {
  const spawn = (cmd, args, opts) => {
    mkdirSync(join(opts.cwd, 'node_modules/pkg'), { recursive: true })
    writeFileSync(join(opts.cwd, 'node_modules/pkg/index.js'), 'x')
    return { status: 0, stdout: transcript, stderr: '' }
  }
  const result = runSession(scenario, '/plugins/candidate', spawn)
  assert.deepEqual(Object.keys(result.files), [])
})

// A per-file cap does not bound the total. Many medium files each pass the
// per-file guard and still exhaust memory together.
test('collection stops at the aggregate ceiling and says so', () => {
  const spawn = (cmd, args, opts) => {
    mkdirSync(join(opts.cwd, 'big'), { recursive: true })
    // 40 files x 250KB each = 10MB, every one under the 256KB per-file cap.
    for (let i = 0; i < 40; i++) {
      writeFileSync(join(opts.cwd, `big/f${i}.txt`), 'x'.repeat(250 * 1024))
    }
    return { status: 0, stdout: transcript, stderr: '' }
  }
  const result = runSession(scenario, '/plugins/candidate', spawn)
  assert.equal(result.filesTruncated, true)
  const bytes = Object.values(result.files).reduce((n, c) => n + c.length, 0)
  assert.ok(bytes <= 8 * 1024 * 1024, `collected ${bytes} bytes`)
})

test('a small session is not marked truncated', () => {
  const result = runSession(scenario, '/plugins/candidate', fakeSpawn([]))
  assert.equal(result.filesTruncated, false)
})

const repoScenario = { ...scenario, repo: true }
const claudeCall = calls => calls.find(c => c.cmd === 'claude')

test('a repo scenario gets an allowlist instead of a Bash ban', () => {
  const calls = []
  runSession(repoScenario, '/plugins/candidate', fakeSpawn(calls))
  const args = claudeCall(calls).args
  assert.ok(args.includes('--allowedTools'), 'must pass --allowedTools')
  assert.equal(args.includes('--disallowedTools'), false)
  assert.match(args[args.indexOf('--allowedTools') + 1], /Bash\(git:\*\)/)
})

test('a scenario without the key keeps the Bash ban and gets no allowlist', () => {
  const calls = []
  runSession(scenario, '/plugins/candidate', fakeSpawn(calls))
  const args = claudeCall(calls).args
  assert.equal(args.includes('--allowedTools'), false)
  assert.equal(args[args.indexOf('--disallowedTools') + 1], 'Bash')
})

test('a repo scenario is seeded as a two-commit git repository', () => {
  const calls = []
  runSession(repoScenario, '/plugins/candidate', fakeSpawn(calls))
  const git = calls.filter(c => c.cmd === 'git').map(c => c.args.join(' '))
  assert.ok(git.some(a => a.includes('init')), 'must init')
  assert.ok(git.some(a => a.includes('--allow-empty')), 'must make a base commit')
  assert.ok(git.some(a => a.includes('switch')), 'must branch off the base')
  assert.ok(git.every(a => a.includes('eval@vibekit.invalid')), 'must not use global git config')
})

test('a failing git invocation stops the run rather than spawning a session', () => {
  const spawn = (cmd, args, opts) =>
    cmd === 'git'
      ? { status: 1, stdout: '', stderr: 'fatal: nope' }
      : { status: 0, stdout: transcript, stderr: '' }
  assert.throws(() => runSession(repoScenario, '/plugins/candidate', spawn), /fatal: nope/)
})
