# plan skill Implementation Plan

> **For executing agents:** implement this plan task-by-task. Each step uses checkbox (`- [ ]`) syntax. Do not skip steps. Do not batch commits across tasks.

**Goal:** Ship `skills/plan/SKILL.md` — the skill that turns an approved spec into a task-by-task plan whose verification clauses state predicates rather than predicted output — together with the two eval-harness capabilities required to measure it.

**Architecture:** One new skill file, authored under a task template that has no `Expected:` slot. Two additive capabilities in `evals/session.mjs` (seed fixture files into the session's temp cwd; read the cwd back afterwards) and three additive expectations in `evals/score.mjs` that assert over the files a session produced rather than only over its transcript. Everything else in the repo is generated.

**Tech stack:** Node 24, `node:test`, no dependencies. Generated surfaces via `npm run generate`, enforced by `npm run check`.

**Spec:** `docs/specs/2026-08-05-plan-skill-design.md` (status: approved, commit `6823cfa`).

**Deviation from `plan-write`, deliberate and disclosed:** this plan does not use `plan-write`'s `Expected:` step slot, because deleting that slot is the change under construction. Steps state `Run:` and stop; each task's success criterion is its `→ verify:` predicate. This plan is therefore also the first artefact authored under the design it builds, and any predicted transcript found in it is evidence against the design exactly as it would be in an eval run.

---

## Premortem

**Hidden assumptions:**
- The plan assumes `runSession`'s temp cwd still exists when files are read back. It does — `rmSync` runs in the `finally` block, and collection is added before it inside the `try`. Task 2's verify clause exercises collection through `runSession` itself rather than through `collectFiles` alone, so a misordering fails the task.
- The plan assumes a session's temp cwd stays small enough to read wholesale. Bash is disallowed, so no install can run, and the only writers are Write/Edit. Mitigated regardless: `collectFiles` skips `node_modules` and `.git` and any file over 256 KB, so a pathological session degrades to a partial read rather than an OOM.
- The plan assumes `npm run generate` rewrites `CLAUDE.md` and `README.md` when a skill directory is added, with no generator change needed. This is the v2 architecture's central claim and has held for three prior skills; Task 5's verify clause is `npm run check` exiting 0, which fails if it does not hold.
- The plan assumes the eval scenarios cannot fire without an approved spec on disk, which is why seeding comes first. Not independently verified — but the ordering costs nothing, since seeding is a precondition either way.

**Irreversible / risky steps:**
- none — every task is additive and revertible with `git revert`. No file is deleted, no migration runs, no package manifest changes, and no paid eval run happens in this plan. The two scenarios are committed but not executed; running them is a separate, explicitly gated decision.

**Spec-misalignment:**
- The spec's goal "`plan` writes nothing outside `docs/plans/`" is stated as observable via the session's resulting diff. There is no git in the eval temp cwd and Bash is disallowed, so the plan implements it as a file-set assertion instead: every file present afterwards is either one that was seeded, unmodified, or matches `^docs/plans/`. This is a strictly stronger check than a diff over a git-less directory and a weaker one than a real diff, since it cannot see a deletion. Surfaced because it is a deliberate reinterpretation, not an oversight.
- The spec's permitted numeric forms include "a three-digit HTTP status". A bare three-digit match would also admit `214`, which is exactly the wrong-`wc -l` defect the design exists to stop. The plan therefore requires a context word (`status`, `http`, or `returns`) before the three digits. This narrows the spec's wording and is the reading that serves its intent.

**Verify-clause weakness:**
- `npm test` passing is a weak clause on its own — it passes if a new test file is never imported. Every test-adding task's clause therefore names the specific test file and asserts a non-zero test count from that file, so an empty or unregistered file fails.
- Task 5's clause could pass on a `SKILL.md` that is well-formed but empty of the rule under construction. Tightened: the clause asserts both that `npm run check` exits 0 and that the file's task-template section contains no `Expected:` line, which is the one property the whole design turns on.
- Task 6's clause cannot verify that the scenarios *pass* — running them costs money and is out of scope. It verifies only that they parse and that their expectations are ones `score.mjs` implements. Stated so no reader mistakes a green Task 6 for a measured skill.

---

## File structure

New:
- `skills/plan/SKILL.md` — the skill itself; hard gate, under 120 lines.

Modified:
- `evals/session.mjs:1-37` — seed fixture files before the session; read the cwd back after it.
- `evals/score.mjs:3-26` — three expectations over produced files.
- `evals/scenarios.json:43` — two scenarios appended.
- `tests/eval-session.test.mjs:1-61` — seeding and collection tests.
- `tests/eval-score.test.mjs` — expectation tests.

Regenerated, never hand-edited:
- `CLAUDE.md` — auto-trigger table row for `plan`.
- `README.md` — skill list entry for `plan`.

---

### Task 1: Seed fixture files into the session cwd → verify: `node --test tests/eval-session.test.mjs` exits 0 and reports at least 8 tests passing

**Files:**
- Modify: `evals/session.mjs:1-37`
- Test: `tests/eval-session.test.mjs`

- [x] **Step 1: Write the failing tests**

Append to `tests/eval-session.test.mjs`:

```js
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
```

Add `join` to the existing `node:path` imports at the top of the file, and `readFileSync`/`existsSync` are already imported from `node:fs`:

```js
import { join } from 'node:path'
```

- [x] **Step 2: Run the tests**

Run: `node --test tests/eval-session.test.mjs`

- [x] **Step 3: Implement seeding**

In `evals/session.mjs`, widen the `node:fs` import and add the helper above `runSession`:

```js
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// A skill whose precondition is a file on disk cannot be measured in an empty
// directory. Seeding is what makes `plan` reachable at all: its gate is an
// approved spec, and the session starts with nothing.
export function seedFiles(root, files = {}) {
  for (const [rel, contents] of Object.entries(files)) {
    const dest = join(root, rel)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, contents)
  }
}
```

Inside `runSession`, immediately after the `try {` line:

```js
    seedFiles(cwd, scenario.files)
```

- [x] **Step 4: Run the tests**

Run: `node --test tests/eval-session.test.mjs`

- [x] **Step 5: Commit**

```bash
git add evals/session.mjs tests/eval-session.test.mjs
git commit -m "eval: seed scenario fixture files into the session cwd"
```

---

### Task 2: Read the session cwd back as produced files → verify: `node --test tests/eval-session.test.mjs` exits 0 and a run whose stub writes a file returns that file in `result.files`

**Files:**
- Modify: `evals/session.mjs`
- Test: `tests/eval-session.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `tests/eval-session.test.mjs`:

```js
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
```

Add to the `node:fs` imports at the top of the test file:

```js
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
```

- [ ] **Step 2: Run the tests**

Run: `node --test tests/eval-session.test.mjs`

- [ ] **Step 3: Implement collection**

In `evals/session.mjs`, widen the imports and add the helper next to `seedFiles`:

```js
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'

const SKIP_DIRS = new Set(['node_modules', '.git'])
const MAX_FILE_BYTES = 256 * 1024

// Transcript-only scoring can see that a skill fired; it cannot see what the
// skill wrote. The design this harness exists to test is a claim about the
// content of a produced file, so the file has to come back.
export function collectFiles(root) {
  const out = {}
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full)
      } else if (entry.isFile() && statSync(full).size <= MAX_FILE_BYTES) {
        out[relative(root, full).split(sep).join('/')] = readFileSync(full, 'utf8')
      }
    }
  }
  walk(root)
  return out
}
```

Replace the `return` statement inside `runSession` with:

```js
    // Collected inside the try, before the finally removes the directory.
    const files = collectFiles(cwd)
    return { ...parsed, raw: stdout, files, seeded: scenario.files ?? {}, contains: needle => stdout.includes(needle) }
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/eval-session.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add evals/session.mjs tests/eval-session.test.mjs
git commit -m "eval: return the files a session produced"
```

---

### Task 3: Path-set expectations in the scorer → verify: `node --test tests/eval-score.test.mjs` exits 0 with the four new path-set cases passing

**Files:**
- Modify: `evals/score.mjs:3-26`
- Test: `tests/eval-score.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `tests/eval-score.test.mjs`:

```js
const produced = (files, seeded = {}) => [{ ok: true, skills: [], tools: [], files, seeded }]

test('fileMatching requires at least one produced file on the path', () => {
  const scenario = { id: 'p', expect: { fileMatching: '^docs/plans/.*\\.md$' } }
  assert.equal(scoreScenario(scenario, produced({ 'docs/plans/a.md': 'x' })).rate, 1)
  assert.equal(scoreScenario(scenario, produced({ 'notes.md': 'x' })).rate, 0)
})

test('onlyNewFilesMatching fails on a new file outside the allowed path', () => {
  const scenario = { id: 'p', expect: { onlyNewFilesMatching: '^docs/plans/' } }
  const seeded = { 'docs/specs/s.md': 'seed' }
  const okFiles = { 'docs/specs/s.md': 'seed', 'docs/plans/a.md': 'x' }
  const badFiles = { 'docs/specs/s.md': 'seed', 'src/index.js': 'x' }
  assert.equal(scoreScenario(scenario, produced(okFiles, seeded)).rate, 1)
  assert.equal(scoreScenario(scenario, produced(badFiles, seeded)).rate, 0)
})

test('onlyNewFilesMatching fails when a seeded file was modified', () => {
  const scenario = { id: 'p', expect: { onlyNewFilesMatching: '^docs/plans/' } }
  const seeded = { 'docs/specs/s.md': 'seed' }
  const edited = { 'docs/specs/s.md': 'seed, edited' }
  assert.equal(scoreScenario(scenario, produced(edited, seeded)).rate, 0)
})
```

- [ ] **Step 2: Run the tests**

Run: `node --test tests/eval-score.test.mjs`

- [ ] **Step 3: Implement the expectations**

In `evals/score.mjs`, inside `satisfied`, immediately before the closing `return true`:

```js
  // Expectations over what the session wrote, not what it said. `plan`'s
  // observable criteria are properties of a file on disk, and a transcript
  // cannot carry them.
  const produced = run.files ?? {}
  const seeded = run.seeded ?? {}

  if (expect.fileMatching !== undefined) {
    const re = new RegExp(expect.fileMatching)
    if (!Object.keys(produced).some(p => re.test(p))) return false
  }

  if (expect.onlyNewFilesMatching !== undefined) {
    const re = new RegExp(expect.onlyNewFilesMatching)
    for (const [path, contents] of Object.entries(produced)) {
      // A modified seed counts as writing outside the allowed path, since the
      // approved artefact is the one thing a planning skill must not edit.
      if (path in seeded) {
        if (seeded[path] !== contents) return false
        continue
      }
      if (!re.test(path)) return false
    }
  }
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/eval-score.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add evals/score.mjs tests/eval-score.test.mjs
git commit -m "eval: score expectations over produced file paths"
```

---

### Task 4: Predicate expectation over verify clauses → verify: `node --test tests/eval-score.test.mjs` exits 0 with the predicate cases passing, including one asserting a bare three-digit number is rejected

**Files:**
- Modify: `evals/score.mjs`
- Test: `tests/eval-score.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `tests/eval-score.test.mjs`. These cases reuse the `produced` helper
added by Task 3 in the same file; if it is not there, Task 3 has not been done
and this task is out of order.

```js
const planWith = clause => ({ 'docs/plans/a.md': `### Task 1: thing → verify: ${clause}\n\nbody\n` })
const scenario4 = { id: 'p', expect: { verifyClauses: 'predicate' } }
const rateOf = files => scoreScenario(scenario4, produced(files, {})).rate

test('predicate clauses pass', () => {
  assert.equal(rateOf(planWith('npm test exits 0')), 1)
  assert.equal(rateOf(planWith('the file exists')), 1)
  assert.equal(rateOf(planWith('grep finds at least 1 match')), 1)
  assert.equal(rateOf(planWith('the endpoint returns 200')), 1)
  assert.equal(rateOf(planWith('the file is under 120 lines')), 1)
})

test('a quoted string in a clause is a predicted transcript', () => {
  assert.equal(rateOf(planWith('test fails with "fn is not defined"')), 0)
})

test('a bare number is a predicted value, even a three-digit one', () => {
  assert.equal(rateOf(planWith('the file is 214 lines long')), 0)
  assert.equal(rateOf(planWith('the file is 42 lines long')), 0)
})

test('clauses in seeded files are not scored', () => {
  const seeded = { 'docs/specs/s.md': '### Task 1: x → verify: "quoted"\n' }
  assert.equal(scoreScenario(scenario4, produced({ ...seeded }, seeded)).rate, 1)
})

test('tasksHaveVerify fails a task header with no clause', () => {
  const s = { id: 'p', expect: { tasksHaveVerify: true } }
  const good = { 'docs/plans/a.md': '### Task 1: thing → verify: npm test exits 0\n' }
  const bad = { 'docs/plans/a.md': '### Task 1: thing\n' }
  assert.equal(scoreScenario(s, produced(good, {})).rate, 1)
  assert.equal(scoreScenario(s, produced(bad, {})).rate, 0)
})
```

- [ ] **Step 2: Run the tests**

Run: `node --test tests/eval-score.test.mjs`

- [ ] **Step 3: Implement the predicate check**

At the top of `evals/score.mjs`, below the header comment:

```js
const VERIFY = '→ verify:'

// The three numeric forms a clause may carry. Each names a property of the
// runtime rather than of the code under test, which is what makes it derivable
// without having run anything. A bare number is a predicted value — and a bare
// three-digit number is exactly the wrong-`wc -l` defect this check exists to
// catch, so an HTTP status has to be introduced by a context word to count.
const ALLOWED_NUMERIC = [
  /\bexit\s+\d+/gi,
  /\b(?:status|http|returns)\s+\d{3}\b/gi,
  /\b(?:at least|at most|no more than|fewer than|under|over|below|above)\s+\d+/gi,
]

export function verifyClauses(text) {
  return text
    .split('\n')
    .filter(line => line.includes(VERIFY))
    .map(line => line.slice(line.indexOf(VERIFY) + VERIFY.length))
}

export function isPredicate(clause) {
  if (/["'`]/.test(clause)) return false
  let rest = clause
  for (const re of ALLOWED_NUMERIC) rest = rest.replace(re, '')
  return !/\d/.test(rest)
}
```

Inside `satisfied`, after the `onlyNewFilesMatching` block:

```js
  // Seeded files are excluded throughout: they are the fixture, not the work,
  // and a spec that discusses verify clauses in prose would otherwise fail a
  // check aimed at the plan the session wrote.
  const written = Object.entries(produced).filter(([path]) => !(path in seeded))

  if (expect.verifyClauses === 'predicate') {
    for (const [, contents] of written) {
      if (!verifyClauses(contents).every(isPredicate)) return false
    }
  }

  if (expect.tasksHaveVerify) {
    for (const [, contents] of written) {
      const headers = contents.split('\n').filter(line => /^###\s+Task\s+\d+/.test(line))
      if (!headers.every(line => line.includes(VERIFY))) return false
    }
  }
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/eval-score.test.mjs`

- [ ] **Step 5: Commit**

```bash
git add evals/score.mjs tests/eval-score.test.mjs
git commit -m "eval: reject predicted output in verify clauses"
```

---

### Task 5: The plan skill → verify: `npm run check` exits 0, `npm test` exits 0, `grep -c 'Expected:' skills/plan/SKILL.md` finds no match, and `wc -l < skills/plan/SKILL.md` is under 120

**Files:**
- Create: `skills/plan/SKILL.md`
- Regenerated: `CLAUDE.md`, `README.md`

- [ ] **Step 1: Write the skill**

Create `skills/plan/SKILL.md`:

````markdown
---
name: plan
description: Use when a spec is approved and implementation has not started — turns it into a task-by-task plan with exact paths and checkable verification. No code here.
trigger: Spec approved, implementation not yet started
gate: hard
---

# plan

Turn an approved spec into an implementation plan. No code is written here.

## HARD-GATE

Do NOT implement anything until a plan file exists and the user has approved it.

The gate has one precondition, and it is checkable rather than asserted: a spec
file exists carrying `status: approved` in its frontmatter. If there is none,
stop and invoke `brainstorm`. A plan built on a draft is a plan built on
something the user may still change.

## The spec is settled

Read it, do not re-litigate it. Questions it already answered are not asked
again. A defect found in it goes back to the user as a question — never a silent
edit, because the approved artefact is what the user signed.

## Refusals

- **Spec spans independent subsystems.** Say so before writing any task. One
  plan per subsystem, each producing working software on its own.
- **A requirement has no possible verify clause.** Not a licence to write a weak
  one. Either the task boundary is wrong and splits, or the requirement is
  unobservable and goes back to the user as a question.

## Plan document

Write to `docs/plans/YYYY-MM-DD-<topic>.md`, then commit — that file alone.

```
# <topic> — Implementation Plan

**Spec:** docs/specs/<file>.md
**Goal:** one sentence
**Architecture:** two or three sentences

## Global constraints
- <one line each, values copied verbatim from the spec>
```

Global constraints are the spec's project-wide requirements — version floors,
dependency limits, naming rules. Stated once, they are implicitly part of every
task, so no task restates them and no task author has to remember them.

## Task shape

```
### Task N: <name> → verify: <predicate>

**Files:**
- Create: `exact/path`
- Modify: `exact/path:12-40`

- [ ] Step 1: <one action>
- [ ] Step 2: Run `<command>`
- [ ] Step N: Commit

```

A task is the smallest unit worth a fresh reviewer's gate. Fold setup, config
and documentation into the task whose deliverable needs them. Split only where a
reviewer could reject one task while approving its neighbour. Each task ends
with an independently testable deliverable and one commit.

Steps that change code carry the actual code. A step that runs a command names
the command and stops there.

## You may not write output you have not observed

A `→ verify:` clause states a predicate — something checkable by a reader of the
plan, before anything runs. Not a transcript.

**Predicates:** exit status, pass or fail, a file exists, a match count at or
above a threshold, an HTTP status.

**Not predicates:** a quoted message, a specific count, a diff, a sample of
output. Each is a claim about a future you have not seen. When one is wrong, the
executing agent cannot tell whether the code failed or the plan lied — and it
will assume the code.

A number is not itself the tell; three forms carry one legitimately — an exit
status, an HTTP status, and a threshold in either direction ("at least 1
match", "under 120 lines"). Any other number in a clause is a predicted value.
A threshold is derivable because you chose it; a predicted value is not, because
the runtime chooses it.

If a specific value is genuinely load-bearing, the task's first step **observes
it**, and the clause refers to the observation instead of a guess.

A clause must be satisfiable by the task it belongs to. If you cannot say what
would make it true, the task boundary is wrong, not the clause.

## No placeholders

`TBD`, `TODO`, "add error handling", "similar to Task N", and any reference to a
function no task defines are plan failures, not shorthand. Repeat the code —
tasks get read out of order.

## Self-review

1. **Spec coverage.** Every requirement maps to a task. Add any that is missing.
2. **Placeholders.** Scan for the patterns above. Fix them.
3. **Clauses.** Scan every `→ verify:` for a quoted string, or a number outside
   the three permitted forms. Both are predicted output. Fix them.

Fix inline. No re-review.

## User review gate

Send exactly this, verbatim:

> Plan written and committed to `<path>`. Please review it and let me know if you want to make any changes before we start implementing.

Wait. On requested changes, make them and re-run self-review.

## Handoff

The only next skill is `exec`, which does not exist yet. Say so plainly: the
plan is written, committed and approved, and execution waits for the skill that
consumes it. Never invoke an implementation skill from here.
````

- [ ] **Step 2: Regenerate derived surfaces**

Run: `npm run generate`

- [ ] **Step 3: Check the generated tree and the tests**

Run: `npm run check && npm test`

- [ ] **Step 4: Check the two properties the design turns on**

Run: `grep -c 'Expected:' skills/plan/SKILL.md; wc -l < skills/plan/SKILL.md`

The first command finding no match and the second reporting a value under 120 are the task's criteria. If either fails, fix `SKILL.md` and repeat Step 2.

- [ ] **Step 5: Commit**

```bash
git add skills/plan/SKILL.md CLAUDE.md README.md
git commit -m "feat: plan skill"
```

---

### Task 6: Eval scenarios → verify: `node -e "JSON.parse(require('fs').readFileSync('evals/scenarios.json','utf8'))"` exits 0, and `npm test` exits 0

**Files:**
- Modify: `evals/scenarios.json:43`

- [ ] **Step 1: Append the two scenarios**

In `evals/scenarios.json`, add these two objects to the end of the array, after the `terse-reachable` entry:

```json
  {
    "id": "plan-fires",
    "prompt": "The spec at docs/specs/2026-08-05-slug-command-design.md is approved. Write the implementation plan for it.",
    "files": {
      "docs/specs/2026-08-05-slug-command-design.md": "---\ntitle: slug command\ndate: 2026-08-05\nstatus: approved\n---\n\n# slug command — Design\n\n## Problem\n\nPost titles are turned into URL slugs by hand, inconsistently.\n\n## Goals\n\n- A `slugify` function turns a title into a lowercase hyphenated slug.\n- Repeated separators collapse to one hyphen.\n\n## Non-goals\n\n- Unicode transliteration.\n\n## Constraints\n\n- No dependencies.\n\n## Approach\n\nOne exported function in `src/slugify.js`, with unit tests.\n\n## Testing\n\nUnit tests only.\n\n## Open questions\n\nNone.\n"
    },
    "expect": { "skill": "vibekit:plan" },
    "n": 5,
    "model": "sonnet"
  },
  {
    "id": "plan-no-predicted-output",
    "prompt": "The spec at docs/specs/2026-08-05-slug-command-design.md is approved. Write the implementation plan for it.",
    "files": {
      "docs/specs/2026-08-05-slug-command-design.md": "---\ntitle: slug command\ndate: 2026-08-05\nstatus: approved\n---\n\n# slug command — Design\n\n## Problem\n\nPost titles are turned into URL slugs by hand, inconsistently.\n\n## Goals\n\n- A `slugify` function turns a title into a lowercase hyphenated slug.\n- Repeated separators collapse to one hyphen.\n\n## Non-goals\n\n- Unicode transliteration.\n\n## Constraints\n\n- No dependencies.\n\n## Approach\n\nOne exported function in `src/slugify.js`, with unit tests.\n\n## Testing\n\nUnit tests only.\n\n## Open questions\n\nNone.\n"
    },
    "expect": {
      "fileMatching": "^docs/plans/.*\\.md$",
      "onlyNewFilesMatching": "^docs/plans/",
      "tasksHaveVerify": true,
      "verifyClauses": "predicate"
    },
    "n": 5,
    "model": "sonnet"
  }
```

- [ ] **Step 2: Check the file parses and the suite is green**

Run: `node -e "JSON.parse(require('fs').readFileSync('evals/scenarios.json','utf8'))" && npm test`

- [ ] **Step 3: Confirm every expectation key is one the scorer implements**

Run: `grep -o 'expect\.[a-zA-Z]*' evals/score.mjs | sort -u`

Every key used in the two new scenarios must appear in that output. A key that does not is silently ignored at scoring time, which would make the scenario pass without testing anything.

- [ ] **Step 4: Commit**

```bash
git add evals/scenarios.json
git commit -m "eval: plan-fires and plan-no-predicted-output scenarios"
```

**Not covered by this task:** the scenarios are committed, not run. Executing them costs money and is a separate, explicitly gated decision. A green Task 6 means the scenarios are well-formed — it does not mean the skill is measured.

---

## After the plan

The eval run is the next decision, not the next task. Before it: pin
`git ls-files -s skills evals | sha256sum` and record the digest. After it:
pin again. An identical digest is the proof that nothing was adjusted
mid-measurement. No harness change happens between a FAIL and a re-run.
