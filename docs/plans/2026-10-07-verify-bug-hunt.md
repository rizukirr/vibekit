# verify bug hunt: Implementation Plan

**Spec:** docs/specs/2026-10-07-verify-bug-hunt-design.md
**Goal:** `verify` hunts for the bugs and regressions a change produced, fixes the ones with a settled reference unattended, and brings the rest to the user.
**Architecture:** One new step in `skills/verify/SKILL.md` plus small edits to its severity, fix loop, verdict and ending text. The eval harness gains a `baseFiles` key so a scenario can commit files before the change under verification. Four eval scenarios and one threshold measure the new behaviour.

## Global constraints

- `verify` never edits. Every fix is dispatched.
- A reproduction writes nothing into the working tree. `git status --porcelain` stays empty through the hunt.
- The rule "only a blocker produces `not ready`" stands as written.
- The fix loop keeps its shape: one subagent, one brief, confined to files already in the diff, one round.
- Edit `skills/verify/SKILL.md` only, then run `npm run generate`. No generated file is edited by hand.
- No shipped file names a project under `external/`.
- All text follows the `plain` rules.
- No new scoring keys in `evals/score.mjs`.

## How the goals are measured

Goals 6 and 7 are checked by the task clauses below. Goals 1 to 5 are eval pass rates, which `verify` measures after the tasks are done by running:

````sh
node evals/run.mjs --scenarios verify-fires,verify-refuses-without-spec,verify-claims-nothing-unearned,verify-nit-does-not-gate,verify-dispatches-the-fix,verify-reports-the-hunt,verify-fixes-a-settled-bug,verify-fixes-a-regression,verify-asks-on-an-undecided-bug
````

That command spawns `claude` sessions on the user's account. Its dry run, with the scenarios from Task 3 in place, printed `90 sessions: est. $9.00-$40.50`. It exits 0 only when every scenario meets its floor in `evals/thresholds.json`.

### Task 1: baseFiles in the eval harness → verify: `node --test tests/eval-session.test.mjs` exits 0

**Files:**
- Modify: `evals/session.mjs:53-81`
- Modify: `evals/session.mjs:90-91`
- Modify: `evals/session.mjs:115`
- Modify: `tests/eval-session.test.mjs:7`
- Modify: `tests/eval-session.test.mjs:180`

- [x] Step 1: In `tests/eval-session.test.mjs`, insert this import before line 7, which is the `runSession` import:

````js
import { spawnSync } from 'node:child_process'
````

- [x] Step 2: Append this test after line 180, the last line of the file, with one blank line before it:

````js
// Real git here, unlike the stubs above: which commit a file landed in is a
// property of the repository, and a recorded argument list cannot show it.
test('baseFiles are committed in the base commit, under the work commit', () => {
  let base
  const spawn = (cmd, args, opts) => {
    if (cmd === 'git') return spawnSync(cmd, args, opts)
    base = spawnSync('git', ['show', 'HEAD~1:src/greet.js'], { cwd: opts.cwd, encoding: 'utf8' })
    return { status: 0, stdout: transcript, stderr: '' }
  }
  const files = { 'src/greet.js': 'work\n' }
  const result = runSession({ ...repoScenario, baseFiles: { 'src/greet.js': 'base\n' }, files }, '/plugins/candidate', spawn)
  assert.equal(base.status, 0, base.stderr)
  assert.equal(base.stdout, 'base\n')
  assert.equal(result.files['src/greet.js'], 'work\n')
})
````

- [x] Step 3: Run `node --test tests/eval-session.test.mjs` and confirm the new case fails while every other case passes.
- [x] Step 4: In `evals/session.mjs`, replace the `SEED_COMMANDS` constant at lines 58-64 with the two lists below. Leave the comment at lines 53-56 and the `GIT_ID` line at 57 as they are.

````js
// Split at the branch point: `baseFiles` are committed before it and `files`
// after, so a scenario can state what held before the change under verification.
const SEED_BASE = [
  ['init', '-b', 'main'],
  ['add', '-A'],
  ['commit', '--allow-empty', '-m', 'base'],
  ['switch', '-c', 'work'],
]
const SEED_WORK = [
  ['add', '-A'],
  ['commit', '-m', 'work'],
]
````

- [x] Step 5: Replace the `seedRepo` function at lines 74-81 with:

````js
function git(cwd, spawn, commands) {
  for (const cmd of commands) {
    const proc = spawn('git', [...GIT_ID, ...cmd], { cwd, encoding: 'utf8' })
    if (proc.status !== 0) {
      throw new Error(`git ${cmd.join(' ')} failed in the eval fixture: ${proc.stderr ?? ''}`)
    }
  }
}

function seedRepo(cwd, spawn, scenario) {
  seedFiles(cwd, scenario.baseFiles)
  git(cwd, spawn, SEED_BASE)
  seedFiles(cwd, scenario.files)
  git(cwd, spawn, SEED_WORK)
}
````

- [x] Step 6: In `runSession`, replace lines 90-91:

````js
    seedFiles(cwd, scenario.files)
    if (scenario.repo) seedRepo(cwd, spawn)
````

with:

````js
    if (scenario.repo) seedRepo(cwd, spawn, scenario)
    else seedFiles(cwd, scenario.files)
````

- [x] Step 7: On line 115, replace `seeded: scenario.files ?? {},` with `seeded: { ...scenario.baseFiles, ...scenario.files },`.
- [x] Step 8: Run `node --test tests/eval-session.test.mjs`
- [x] Step 9: Commit

### Task 2: the bug hunt in the verify skill → verify: `npm run check` exits 0 and `npm test` exits 0

**Files:**
- Modify: `skills/verify/SKILL.md`
- Modify: `README.md:47`

Line numbers below refer to `skills/verify/SKILL.md` as committed before this task. The steps run from the bottom of the file upward, so each line number is still valid when its step is reached. `README.md` line 47 sits inside the generated skill list and is rewritten by `npm run generate`, never by hand.

- [x] Step 1: Read `skills/verify/SKILL.md` in full.
- [x] Step 2: Replace line 137. Line 137 begins:

````text
## 6. Integration
````

New text:

````text
## 7. Integration
````
- [x] Step 3: Append to the end of line 135, on the same line, keeping the leading space. Line 135 begins:

````text
**On `not ready`**: every blocker with its evidence, then th
````

New text:

````text
 A demonstrated bug gets three choices of its own: fixing it belongs to `debug`, amending the spec belongs to `brainstorm`, where the behaviour becomes a goal or a non-goal, and keeping it as is is the override.
````
- [x] Step 4: Replace line 133. Line 133 begins:

````text
**On `ready`**: the `git diff --stat` summary, the open warn
````

New text:

````text
**On `ready`**: the `git diff --stat` summary, the open warns and nits, and every suspected bug with the reason it could not be reproduced. Then: approve, fix, or abort. Approval is always available. Only the user blocks: a suspected bug is judgement with nothing run behind it, and letting an unevidenced guess veto the person whose code it is inverts who decides.
````
- [x] Step 5: Replace line 122. Line 122 begins:

````text
Open:    remaining warns and nits, each with its severity
````

New text:

````text
Open:    remaining warns and nits, each with its severity, and any pre-existing bug
````
- [x] Step 6: Replace line 121. Line 121 begins:

````text
Fixed:   what the loop fixed, or none
````

New text:

````text
Fixed:   what the loop fixed, each bug with its reproduction before and after, or none
````
- [x] Step 7: Insert after line 120. Line 120 begins:

````text
Goals:   one line per goal, verdict, then the evidence
````

New text:

````text
Bugs:    one line per suspect: demonstrated or suspected, the claim with file:line, the reference,
         then the command and what it returned, or why it could not run. Then the count dropped.
         With no suspects, say so and name what you read and ran
````
- [x] Step 8: Insert after line 109. Line 109 begins:

````text
Stop at the first of these: a round produced no new findings
````

New text:

````text
After the round, hunt once more over the fix commit only. Anything that hunt demonstrates is a `blocker` carried to the user and never auto-fixed: a fix that breaks something else does not earn a second unattended round.
````
- [x] Step 9: Replace line 107. Line 107 begins:

````text
Then run the sweep and the ladder again from the top. **The 
````

New text:

````text
Then run the sweep and the ladder again from the top, with every reproduction command added to the sweep. **The re-run is the gate on the fix.** A fix that breaks a test comes back as a failed check, and a reproduction still showing the wrong behaviour comes back as a demonstrated bug. Both are `blocker`s: no special handling, and no way for a repair to slip past unchecked.
````
- [x] Step 10: Append to the end of line 105, on the same line, keeping the leading space. Line 105 begins:

````text
Confine the fix agent to files already in the diff. A fix re
````

New text:

````text
 A bug whose fix needs a file outside the diff is not dispatched at all: it stays a `blocker` and reaches the user.
````
- [x] Step 11: Insert after line 103. Line 103 begins:

````text
If any finding is auto-fixable, dispatch **one** fresh subag
````

New text:

````text
For a bug, the brief carries the reproduction command, its output verbatim, the reference, and the expected result. The fix agent adds the reproduction as a test when a test file is already in the diff. With none in the diff it adds no test, and you say so in `Unseen`: a new test file belongs to no task, so it would trip the scope check.
````
- [x] Step 12: Replace line 101. Line 101 begins:

````text
## 5. The bounded fix loop
````

New text:

````text
## 6. The bounded fix loop
````
- [x] Step 13: Replace line 99. Line 99 begins:

````text
**Fixability is a second, independent question: a finding is
````

New text:

````text
**Fixability is a second, independent question. A finding is auto-fixable in two cases: fixing it cannot change behaviour, or it is a demonstrated bug whose reference is settled.** A `nit` whose fix would alter behaviour still reaches the user, and a `blocker` that is a pure rename does not. A demonstrated bug with no settled reference is never auto-fixed: choosing its correct behaviour is a decision, and decisions belong to the user.
````
- [x] Step 14: Replace line 92. Line 92 begins:

````text
- **`warn`**: a ladder violation whose fix would change beha
````

New text:

````text
- **`warn`**: a ladder violation whose fix would change behaviour, a `partial` goal, or a suspected bug.
````
- [x] Step 15: Replace line 91. Line 91 begins:

````text
- **`blocker`**: a failed sweep check, a goal observed to fa
````

New text:

````text
- **`blocker`**: a failed sweep check, a goal observed to fail, an unmeasured goal, a non-goal the diff built, a demonstrated bug. **Only a blocker produces `not ready`.**
````
- [x] Step 16: Insert before line 87, followed by one blank line. Line 87 begins:

````text
## Severity
````

New text:

````text
## 5. The bug hunt

The spec says what the change must do. It does not say what the change must not break, and the goals walk cannot see behaviour no goal mentions. Hunt for it.

Scope is the diff, plus the callers of every function, export or command the diff changed. A bug that reproduces identically at `BASE` was not produced by this change: name it in `Open` as pre-existing, and it never gates.

1. **List suspects.** Each is one falsifiable claim with `file:line`: this input, this result, and what the result should be.
2. **Name the reference.** Three count as settled: the behaviour at `BASE`, a goal or constraint in the spec, or a crash on input the code plainly accepts. Anything else has no settled reference, and you say so. A difference from `BASE` that the spec asks for is not a suspect.
3. **Reproduce.** One command per suspect, with its output kept. A regression runs the same input at `BASE` and at `HEAD`.

A reproduction writes nothing into the working tree. Run it inline, or from a temporary directory outside the repository. The `BASE` side runs in a temporary `git worktree`, removed afterwards. One you cannot remove goes in `Unseen` with its path.

- **`demonstrated`**: the command ran and shows the wrong behaviour. Wrong on some runs only still counts: report how many out of how many.
- **`suspected`**: the command could not be run. Quote the error or name the reason. A command that errors proves nothing, exactly as in the sweep.
- **dropped**: the command ran and shows correct behaviour. Count these in the verdict.

Reading is how you find a suspect, never how you confirm one. A bug you only read about is `suspected`, however sure you are.
````
- [x] Step 17: Replace line 3. Line 3 begins:

````text
description: "Use before claiming a change is done, fixed or
````

New text:

````text
description: "Use before claiming a change is done, fixed or passing: checks the whole change against its spec, runs the checks no single task could, hunts for the bugs the change produced, and returns ready or not ready. Evidence or it did not happen."
````
- [x] Step 18: Run `npm run generate`
- [x] Step 19: Run `npm run check`
- [x] Step 20: Run `npm test`
- [x] Step 21: Commit

### Task 3: eval scenarios for the hunt → verify: `node evals/run.mjs --dry-run --scenarios verify-reports-the-hunt,verify-fixes-a-settled-bug,verify-fixes-a-regression,verify-asks-on-an-undecided-bug` exits 0 and `npm test` exits 0

**Files:**
- Modify: `evals/scenarios.json:197`
- Modify: `evals/thresholds.json:8`

The dry run rejects any scenario id it cannot find and any threshold naming an unknown scenario, so it proves all four entries and the threshold are in place. It spawns nothing.

- [x] Step 1: In `evals/scenarios.json`, insert the four entries below after line 197. Line 197 is the `  },` that closes the `verify-dispatches-the-fix` entry.

````json
  {
    "id": "verify-reports-the-hunt",
    "prompt": "Every task in docs/plans/2026-10-07-greeting.md is complete and committed. Are we done?",
    "files": {
      "docs/specs/2026-10-07-greeting-design.md": "---\ntitle: greeting\ndate: 2026-10-07\nstatus: approved\n---\n\n# greeting: Design\n\n## Problem\n\nNo greeting exists.\n\n## Goals\n\n- A greet function. Observable: `node --test test/greet.test.js` exits 0.\n\n## Non-goals\n\n- Localisation.\n\n## Constraints\n\n- No dependencies.\n\n## Approach\n\nOne function in `src/`.\n\n## Testing\n\nUnit test.\n\n## Open questions\n\nNone.\n",
      "docs/plans/2026-10-07-greeting.md": "# greeting Implementation Plan\n\n**Spec:** docs/specs/2026-10-07-greeting-design.md\n**Goal:** A greet function.\n\n## Global constraints\n- No dependencies.\n\n### Task 1: greeting → verify: `node --test test/greet.test.js` exits 0\n\n**Files:**\n- Create: `src/greet.js`\n- Test: `test/greet.test.js`\n\n- [x] Step 1: Write it\n- [x] Step 2: Commit\n",
      "src/greet.js": "export const greet = name => `hello ${name}`\n",
      "test/greet.test.js": "import test from 'node:test'\nimport assert from 'node:assert/strict'\nimport { greet } from '../src/greet.js'\n\ntest('greet', () => {\n  assert.equal(greet('ada'), 'hello ada')\n})\n"
    },
    "expect": {
      "finalTextMatches": "Bugs:"
    },
    "repo": true,
    "n": 10,
    "model": "sonnet"
  },
  {
    "id": "verify-fixes-a-settled-bug",
    "prompt": "Every task in docs/plans/2026-10-07-greeting.md is complete and committed. Are we done?",
    "files": {
      "docs/specs/2026-10-07-greeting-design.md": "---\ntitle: greeting\ndate: 2026-10-07\nstatus: approved\n---\n\n# greeting: Design\n\n## Problem\n\nNo greeting exists.\n\n## Goals\n\n- A greet function that capitalises the name. Observable: `node --test test/greet.test.js` exits 0.\n\n## Non-goals\n\n- Localisation.\n\n## Constraints\n\n- No dependencies.\n- `greet` never throws on any string input.\n\n## Approach\n\nOne function in `src/`.\n\n## Testing\n\nUnit test.\n\n## Open questions\n\nNone.\n",
      "docs/plans/2026-10-07-greeting.md": "# greeting Implementation Plan\n\n**Spec:** docs/specs/2026-10-07-greeting-design.md\n**Goal:** A greet function.\n\n## Global constraints\n- No dependencies.\n\n### Task 1: greeting → verify: `node --test test/greet.test.js` exits 0\n\n**Files:**\n- Create: `src/greet.js`\n- Test: `test/greet.test.js`\n\n- [x] Step 1: Write it\n- [x] Step 2: Commit\n",
      "src/greet.js": "export const greet = name => `hello ${name[0].toUpperCase()}${name.slice(1)}`\n",
      "test/greet.test.js": "import test from 'node:test'\nimport assert from 'node:assert/strict'\nimport { greet } from '../src/greet.js'\n\ntest('greet', () => {\n  assert.equal(greet('ada'), 'hello Ada')\n})\n"
    },
    "expect": {
      "anyDispatchMatches": "[Ee]mpty|greet\\(\\\\?['\"`]\\\\?['\"`]\\)"
    },
    "repo": true,
    "n": 10,
    "model": "sonnet"
  },
  {
    "id": "verify-fixes-a-regression",
    "prompt": "Every task in docs/plans/2026-10-07-capitalise.md is complete and committed. Are we done?",
    "baseFiles": {
      "src/greet.js": "export const greet = name => `hello ${name.trim()}`\n"
    },
    "files": {
      "docs/specs/2026-10-07-capitalise-design.md": "---\ntitle: capitalise\ndate: 2026-10-07\nstatus: approved\n---\n\n# capitalise: Design\n\n## Problem\n\nThe greeting prints the name in lower case.\n\n## Goals\n\n- `greet` capitalises the first letter of the name. Observable: `node --test test/greet.test.js` exits 0.\n\n## Non-goals\n\n- Localisation.\n\n## Constraints\n\n- No dependencies.\n\n## Approach\n\nOne function in `src/`.\n\n## Testing\n\nUnit test.\n\n## Open questions\n\nNone.\n",
      "docs/plans/2026-10-07-capitalise.md": "# capitalise Implementation Plan\n\n**Spec:** docs/specs/2026-10-07-capitalise-design.md\n**Goal:** A capitalised greeting.\n\n## Global constraints\n- No dependencies.\n\n### Task 1: capitalise → verify: `node --test test/greet.test.js` exits 0\n\n**Files:**\n- Modify: `src/greet.js`\n- Test: `test/greet.test.js`\n\n- [x] Step 1: Write it\n- [x] Step 2: Commit\n",
      "src/greet.js": "export const greet = name => `hello ${name.charAt(0).toUpperCase()}${name.slice(1)}`\n",
      "test/greet.test.js": "import test from 'node:test'\nimport assert from 'node:assert/strict'\nimport { greet } from '../src/greet.js'\n\ntest('greet', () => {\n  assert.equal(greet('ada'), 'hello Ada')\n})\n"
    },
    "expect": {
      "anyDispatchMatches": "trim|[Ww]hitespace|[Ss]pace"
    },
    "repo": true,
    "n": 10,
    "model": "sonnet"
  },
  {
    "id": "verify-asks-on-an-undecided-bug",
    "prompt": "Every task in docs/plans/2026-10-07-price.md is complete and committed. Are we done?",
    "files": {
      "docs/specs/2026-10-07-price-design.md": "---\ntitle: price\ndate: 2026-10-07\nstatus: approved\n---\n\n# price: Design\n\n## Problem\n\nPrices are shown as raw cents.\n\n## Goals\n\n- `formatPrice(1999)` returns `$19.99`. Observable: `node --test test/price.test.js` exits 0.\n\n## Non-goals\n\n- Localisation.\n\n## Constraints\n\n- No dependencies.\n\n## Approach\n\nOne function in `src/`.\n\n## Testing\n\nUnit test.\n\n## Open questions\n\nNone.\n",
      "docs/plans/2026-10-07-price.md": "# price Implementation Plan\n\n**Spec:** docs/specs/2026-10-07-price-design.md\n**Goal:** A price formatter.\n\n## Global constraints\n- No dependencies.\n\n### Task 1: price → verify: `node --test test/price.test.js` exits 0\n\n**Files:**\n- Create: `src/price.js`\n- Test: `test/price.test.js`\n\n- [x] Step 1: Write it\n- [x] Step 2: Commit\n",
      "src/price.js": "export const formatPrice = cents => `$${(cents / 100).toFixed(2)}`\n",
      "test/price.test.js": "import test from 'node:test'\nimport assert from 'node:assert/strict'\nimport { formatPrice } from '../src/price.js'\n\ntest('formatPrice', () => {\n  assert.equal(formatPrice(1999), '$19.99')\n})\n"
    },
    "expect": {
      "finalTextMatches": "[Vv]erdict:\\s*not ready"
    },
    "repo": true,
    "n": 10,
    "model": "sonnet"
  },
````

- [x] Step 2: In `evals/thresholds.json`, replace line 8:

````json
    "terse-reachable": { "minFiringRate": 0.5 }
````

with:

````json
    "terse-reachable": { "minFiringRate": 0.5 },
    "verify-asks-on-an-undecided-bug": { "minFiringRate": 0.5 }
````

- [x] Step 3: Run `node evals/run.mjs --dry-run --scenarios verify-reports-the-hunt,verify-fixes-a-settled-bug,verify-fixes-a-regression,verify-asks-on-an-undecided-bug`
- [x] Step 4: Run `npm test`
- [x] Step 5: Commit

### Task 4: separate the two inserted fix loop paragraphs → verify: `node -e "const l=require('fs').readFileSync('skills/verify/SKILL.md','utf8').split('\n');for(const p of ['For a bug, the brief','After the round, hunt']){const i=l.findIndex(x=>x.startsWith(p));if(i<1||l[i-1]!=='')process.exit(1)}"` exits 0 and `npm run check` exits 0 and `npm test` exits 0

**Files:**
- Modify: `skills/verify/SKILL.md:122`
- Modify: `skills/verify/SKILL.md:129`

Added after Task 2 ran. Steps 8 and 11 of Task 2 gave their new paragraphs without the blank line that separates a paragraph from the one before it, so each new paragraph now sits on the line directly under its neighbour and renders as part of it. The line numbers below refer to the file as committed after Task 2.

- [ ] Step 1: Insert one empty line before line 129, which begins `After the round, hunt once more`.
- [ ] Step 2: Insert one empty line before line 122, which begins `For a bug, the brief carries`.
- [ ] Step 3: Run `npm run generate`
- [ ] Step 4: Run `npm run check`
- [ ] Step 5: Run `npm test`
- [ ] Step 6: Commit
