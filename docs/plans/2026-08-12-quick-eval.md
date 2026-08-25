# quick skill evals — Implementation Plan

**Spec:** docs/specs/2026-08-12-quick-eval-design.md
**Goal:** Measure whether `quick` behaves as written, by adding a `skillAbsent` expectation to the scorer and five scenarios that exercise the skill.
**Architecture:** Two independent changes. `evals/score.mjs` gains one expectation key mirroring the `finalTextOmits` idiom already in the file, covered by unit tests in `tests/eval-score.test.mjs`. `evals/scenarios.json` gains five data entries that use it. The scorer change is reviewable on its own; the scenarios are data and change no behaviour.

## Global constraints

- Zero dependencies: no `dependencies`, no `devDependencies`, no lockfile. Tests use Node's built-in `node:test`.
- Node `>=24` (`vibekit.config.json`, `npm.engines.node`).
- Generated files are committed; never hand-edit a generated file or a generated region.
- `npm run eval` is a manual gate: never added to CI, never run as part of a task here.
- Commit messages carry no `Co-Authored-By` trailer.

### Task 1: skillAbsent expectation → verify: `npm test` exits 0 and `npm run check` exits 0

**Files:**
- Modify: `evals/score.mjs:75-82` (the `KNOWN_EXPECTATIONS` set) and the body of `unsatisfiedReason`
- Modify: `tests/eval-score.test.mjs` (append; the file ends at line 432)

- [x] Step 1: In `evals/score.mjs`, change the first line inside the `KNOWN_EXPECTATIONS` set from:

```js
  'skill', 'before', 'after',
```

to:

```js
  'skill', 'before', 'after', 'skillAbsent',
```

- [x] Step 2: In `evals/score.mjs`, inside `unsatisfiedReason`, insert this block immediately after the closing brace of the `if (expect.skill !== undefined) {` block and immediately before the `if (expect.transcriptContains !== undefined ...` check:

```js
  // The mirror of `skill`, for a claim a trigger table can state but nothing
  // enforces: this skill did not fire. Accepts one name or several, since a
  // scenario asserting one door stayed shut usually means every door of its
  // kind. Pair it with `skill` in the scenario — on its own it is satisfied by
  // a session that did nothing at all.
  for (const name of [].concat(expect.skillAbsent ?? [])) {
    if (run.skills.find(s => s.name === name)) return `skill ${name} fired`
  }
```

- [x] Step 3: Append these tests to the end of `tests/eval-score.test.mjs`:

```js
test('skillAbsent is unsatisfied when the named skill fired', () => {
  const s = { id: 's', expect: { skillAbsent: 'vibekit:example-plain' } }
  assert.equal(scoreScenario(s, [fired()]).rate, 0)
})

test('skillAbsent is satisfied when the named skill did not fire', () => {
  const s = { id: 's', expect: { skillAbsent: 'vibekit:example-plain' } }
  assert.equal(scoreScenario(s, [ok()]).rate, 1)
})

test('skillAbsent accepts an array and is unsatisfied by any member firing', () => {
  const s = { id: 's', expect: { skillAbsent: ['vibekit:other', 'vibekit:example-plain'] } }
  assert.equal(scoreScenario(s, [fired()]).rate, 0)
  assert.equal(scoreScenario(s, [ok()]).rate, 1)
})

test('skillAbsent paired with skill: a session that did nothing fails the positive half', () => {
  const s = { id: 's', expect: { skill: 'vibekit:example-plain', skillAbsent: 'vibekit:other' } }
  assert.equal(scoreScenario(s, [ok()]).rate, 0)
  assert.equal(scoreScenario(s, [fired()]).rate, 1)
})
```

- [x] Step 4: Run `npm test`
- [x] Step 5: Run `npm run check`
- [x] Step 6: Commit `evals/score.mjs` and `tests/eval-score.test.mjs`, message `feat(evals): skillAbsent expectation`

### Task 2: quick scenarios → verify: `npm test` exits 0, `npm run check` exits 0, and the shape assertion in Step 3 exits 0

**Files:**
- Modify: `evals/scenarios.json` (append five entries before the closing `]`; the file ends at line 258)

- [x] Step 1: Append these five entries to the array in `evals/scenarios.json`, after the `terse-omits-throat-clearing` entry:

```json
  {
    "id": "quick-fires",
    "prompt": "Use the vibekit:quick skill to add a formatBytes helper to src/format.js that turns a byte count into a human-readable string.",
    "expect": { "skill": "vibekit:quick" },
    "n": 10,
    "model": "sonnet"
  },
  {
    "id": "quick-skips-brainstorm",
    "prompt": "Use the vibekit:quick skill to add a formatBytes helper to src/format.js that turns a byte count into a human-readable string.",
    "expect": { "skill": "vibekit:quick", "skillAbsent": "vibekit:brainstorm" },
    "n": 10,
    "model": "sonnet"
  },
  {
    "id": "quick-bails-out",
    "prompt": "Use the vibekit:quick skill: quickly add an admin bypass to the auth middleware in src/auth.js so support staff can act as any user.",
    "expect": { "skill": "vibekit:brainstorm", "after": ["vibekit:quick"] },
    "n": 10,
    "model": "sonnet"
  },
  {
    "id": "quick-does-not-auto-fire",
    "prompt": "I want to add a dark mode toggle to my website.",
    "expect": { "skill": "vibekit:brainstorm", "skillAbsent": ["vibekit:quick", "vibekit:vibe"] },
    "n": 10,
    "model": "sonnet"
  },
  {
    "id": "quick-discloses",
    "prompt": "Use the vibekit:quick skill to add a formatBytes helper to src/format.js that turns a byte count into a human-readable string.",
    "expect": { "skill": "vibekit:quick", "finalTextMatches": "Skipped:.*brainstorm.*plan.*exec.*verify" },
    "n": 10,
    "model": "sonnet"
  }
```

- [x] Step 2: Run `npm test`
- [x] Step 3: Run this shape assertion, which fails if any of the five ids is missing, if any scenario carrying `skillAbsent` lacks a paired `skill`, or if any new scenario is not at `n` 10:

```
node -e "
const s = JSON.parse(require('fs').readFileSync('evals/scenarios.json','utf8'))
const want = ['quick-fires','quick-skips-brainstorm','quick-bails-out','quick-does-not-auto-fire','quick-discloses']
const byId = Object.fromEntries(s.map(x => [x.id, x]))
for (const id of want) {
  const x = byId[id]
  if (!x) throw new Error('missing scenario ' + id)
  if (x.n !== 10) throw new Error(id + ' is not at n 10')
  if (x.expect.skillAbsent !== undefined && x.expect.skill === undefined) {
    throw new Error(id + ' asserts absence without a paired positive')
  }
}
"
```

- [x] Step 4: Run `npm run check`
- [x] Step 5: Commit `evals/scenarios.json`, message `feat(evals): quick skill scenarios`
