# nit scenario assertion — Implementation Plan

**Spec:** docs/specs/2026-08-11-nit-scenario-assertion-design.md
**Goal:** Make `verify-nit-does-not-gate` assert that a nit yields `ready`, and stop asserting the containment claim that contradicts `verify`'s fix loop.
**Architecture:** Two changes, in order. First the scorer test that shows the replacement assertion rejects a `not ready` run and a silent one, because an assertion nobody has seen fail is not a check. Then the scenario's `expect` block, which is data — no harness code and no skill text moves.

## Global constraints
- Dependency free.
- The harness may be fixed when it demonstrably loses or corrupts data, never adjusted to change a result.
- No expectation is loosened. The replacement is a positive assertion, strictly stronger than the negative one it replaces.
- `evals/` never ships — absent from `package.json` `files[]`.
- Pin `git ls-files -s skills evals | sha256sum` before and after any paid run.
- No paid run in this plan.

### Task 1: show the replacement assertion can fail → verify: `npm test` exits 0

**Files:**
- Modify: `tests/eval-score.test.mjs:418`

- [x] Step 1: Append to `tests/eval-score.test.mjs`. The `said` helper it uses is
      defined at `tests/eval-score.test.mjs:394` and builds a single successful
      run carrying only a final message:

```js
// The assertion verify-nit-does-not-gate carries after 2026-08-11. It replaced
// `finalTextOmits: "not ready"`, which silence satisfies — a run that never
// reached a verdict scored the same as one that reached the right verdict.
test('the verdict assertion accepts ready and rejects not ready', () => {
  const s = { id: 'p', expect: { finalTextMatches: '[Vv]erdict:\\s*ready' } }
  assert.equal(scoreScenario(s, said('Verdict: ready')).rate, 1)
  assert.equal(scoreScenario(s, said('Verdict: not ready')).rate, 0)
})

test('the verdict assertion is not satisfied by silence', () => {
  const s = { id: 'p', expect: { finalTextMatches: '[Vv]erdict:\\s*ready' } }
  assert.equal(scoreScenario(s, said('Everything looks fine to me.')).rate, 0)
})
```

- [x] Step 2: Run `npm test` and record whether the two new tests pass. They are
      expected to pass immediately: `finalTextMatches` already exists at
      `evals/score.mjs:123-128` and this task adds no source. The check under
      test is the regex, not the scorer, and the lines that carry it are the two
      `rate, 0` assertions — a regex that matched `not ready` or matched silence
      would fail them here rather than in a paid run. Record which assertion
      would catch which mistake.
- [x] Step 3: Commit

### Task 2: repoint the scenario at the verdict claim → verify: `node -e "const s=require('./evals/scenarios.json'); const x=s.find(v => v.id === 'verify-nit-does-not-gate'); process.exit(Object.keys(x.expect).join() === 'finalTextMatches' ? 0 : 1)"` exits 0

**Files:**
- Modify: `evals/scenarios.json:176-179`

- [ ] Step 1: Replace the `expect` block of the `verify-nit-does-not-gate` object
      with:

```json
    "expect": {
      "finalTextMatches": "[Vv]erdict:\\s*ready"
    },
```

      Change nothing else in the object. Its `files`, `repo`, `n` and `model`
      keys stay exactly as they are, and no other scenario is touched — two of
      them, `verify-refuses-without-spec` and `verify-claims-nothing-unearned`,
      also carry `onlyNewFilesMatching` and both keep it.

- [ ] Step 2: Run `npm test`
- [ ] Step 3: Run `git diff` and confirm the only changed file is
      `evals/scenarios.json`, that no `"id"` line other than
      `verify-nit-does-not-gate` appears in the diff, and that no file under
      `skills/` appears.
- [ ] Step 4: Commit
