# eval repo fixtures — Implementation Plan

**Spec:** docs/specs/2026-08-09-eval-repo-fixtures-design.md
**Goal:** Let an eval scenario declare `repo: true` and receive a seeded git repository plus a bounded command allowlist, so `verify`'s sweep is measurable.
**Architecture:** One optional top-level scenario key read in `runSession`. When set, git is spawned through the same injected `spawn` the session uses, so the seeding is observable in unit tests and adds no dependency. When absent, the spawned argv is byte-identical to today's, so no recorded result can move.

## Global constraints
- Dependency free. Bare Node plus `git`.
- Additive only. No existing scenario, expectation, or recorded rate may move.
- `evals/` never ships — absent from `package.json` `files[]`.
- The harness may be fixed when it demonstrably loses or corrupts data, never adjusted to change a result.
- Pin `git ls-files -s skills evals | sha256sum` before and after every paid run.

### Task 1: repo seeding and the command allowlist → verify: `npm test` exits 0

**Files:**
- Modify: `evals/session.mjs:57-71`
- Modify: `tests/eval-session.test.mjs:142`

- [x] Step 1: Append three tests to `tests/eval-session.test.mjs`, each of which
      must be observed failing before Step 2 is written:

```js
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
```

- [x] Step 2: Run `npm test` and record which of the three fail, and with what
      message. A test that passes before the change is written is not a check.
- [x] Step 3: In `evals/session.mjs`, add above `runSession`:

```js
// A scenario whose skill sweeps a repository cannot be measured in a directory
// that is not one. Two commits, not one: `verify` derives BASE from a
// merge-base, and a single-commit repository has no parent to diff against. The
// empty root commit makes the whole seeded state the change under verification.
const GIT_ID = ['-c', 'user.name=vibekit-eval', '-c', 'user.email=eval@vibekit.invalid']
const SEED_COMMANDS = [
  ['init', '-b', 'main'],
  ['commit', '--allow-empty', '-m', 'base'],
  ['switch', '-c', 'work'],
  ['add', '-A'],
  ['commit', '-m', 'work'],
]

// An allowlist is not a sandbox; it bounds which commands run, not what they
// can reach. It is narrower than the current posture in every respect but one,
// recorded in the spec's Open questions.
const REPO_TOOLS = [
  'Bash(git:*)', 'Bash(node:*)', 'Bash(ls:*)', 'Bash(cat:*)',
  'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Task', 'Skill',
].join(' ')

function seedRepo(cwd, spawn) {
  for (const cmd of SEED_COMMANDS) {
    const proc = spawn('git', [...GIT_ID, ...cmd], { cwd, encoding: 'utf8' })
    if (proc.status !== 0) {
      throw new Error(`git ${cmd.join(' ')} failed in the eval fixture: ${proc.stderr ?? ''}`)
    }
  }
}
```

- [x] Step 4: In `runSession`, call it after `seedFiles(cwd, scenario.files)`:

```js
    if (scenario.repo) seedRepo(cwd, spawn)
```

- [x] Step 5: Replace the `--disallowedTools` entry in the `args` array, and the
      comment sitting above it, so the permission flags depend on the key. Leave
      every other element in place. The replaced comment's reasoning is not
      dropped — it moves to `REPO_TOOLS` and to the branch below:

```js
      // A temp cwd does not contain arbitrary command execution, so the default
      // is no Bash at all. A repo scenario trades that for a named allowlist
      // rather than for nothing. Write/Edit stay available either way, because
      // attempting them is the behaviour under measurement.
      ...(scenario.repo
        ? ['--allowedTools', REPO_TOOLS]
        : ['--disallowedTools', 'Bash']),
```

- [x] Step 6: Run `npm test`
- [x] Step 7: Commit

### Task 2: opt the two unsatisfiable scenarios in → verify: `grep -c '"repo": true' evals/scenarios.json` is at least 2

**Files:**
- Modify: `evals/scenarios.json:169`
- Modify: `evals/scenarios.json:184`

- [ ] Step 1: Add `"repo": true,` to the `verify-nit-does-not-gate` object,
      alongside its existing `"n"` and `"model"` keys. Change nothing else in
      the object — its `expect` block stays exactly as it is.
- [ ] Step 2: Add `"repo": true,` to the `verify-dispatches-the-fix` object, on
      the same terms.
- [ ] Step 3: Run `npm test`
- [ ] Step 4: Run `git diff --stat` and confirm the only changed file is
      `evals/scenarios.json`, and that no line containing `expect`, or any other
      scenario id, appears in the diff.
- [ ] Step 5: Commit

### Task 3: paid smoke run at n=1 → verify: a results file naming `verify-nit-does-not-gate` exists under `evals/results/`

**Files:**
- Create: `evals/results/<timestamp>-HEAD.json`

- [ ] Step 1: Run `git ls-files -s skills evals | sha256sum` and record the digest.
- [ ] Step 2: Run `npm run eval -- --scenarios verify-nit-does-not-gate -n 1`
- [ ] Step 3: Read the stored final text of the session. Count matches for
      `git repository` in it. A count above 0 means the seeding did not take,
      and Task 4 does not start.
- [ ] Step 4: Run `git ls-files -s skills evals | sha256sum` and confirm it
      equals the digest from Step 1.
- [ ] Step 5: Commit the results file.

### Task 4: measure both scenarios at n=10 → verify: a results file naming both `verify-nit-does-not-gate` and `verify-dispatches-the-fix` exists under `evals/results/`

**Files:**
- Create: `evals/results/<timestamp>-HEAD.json`

- [ ] Step 1: Run `git ls-files -s skills evals | sha256sum` and record the digest.
- [ ] Step 2: Run `npm run eval -- --scenarios verify-nit-does-not-gate,verify-dispatches-the-fix -n 10`
- [ ] Step 3: Run `git ls-files -s skills evals | sha256sum` and confirm it
      equals the digest from Step 1.
- [ ] Step 4: For any scenario below its floor, read the recorded failure
      strings and the stored final texts, and state whether the cause is the
      fixture or the skill. Do not change the expectation either way.
- [ ] Step 5: Commit the results file.
