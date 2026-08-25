# parse fired not attempted: Implementation Plan

Heading uses a colon rather than the template's em dash, matching the spec and the rule `plain` now ships. Nothing parses this heading.

**Spec:** docs/specs/2026-08-22-parse-fired-not-attempted-design.md
**Goal:** Make `evals/parse.mjs` report a skill as fired only when the session was actually offered it, so a failed Skill call stops counting as a load.
**Architecture:** One filter at result assembly in `evals/parse.mjs` corrects all three `run.skills` consumers in `evals/score.mjs` with a single definition of fired. A separate one-line change in `evals/score.mjs` splits the failure reason so an unavailable skill reads differently from one the session declined to invoke. `tools` and `dispatches` stay unfiltered by design, and a test pins that.

## Global constraints

- `tools` and `dispatches` are never filtered. They record a decision the model made rather than guidance it received.
- `/docs` is gitignored per `.gitignore:4`, so neither this plan nor the spec can be committed. `/evals/results` is gitignored per `.gitignore:5`.
- `evals/parse.mjs:9` describes the file as "Pure: JSONL text in, facts out. No fs, no network". The change must not break that.
- No new eval sessions are run by any task in this plan.
- Do not introduce an em dash or a semicolon into prose, including commit messages. Exactly one em dash exists in a tracked file and it is a deliberate probe in `evals/scenarios.json`.
- Commit messages omit Co-Authored-By trailers.

## Task 1: filter attempted-but-unavailable skills at parse time → verify: `npm test` exits 0 and reports at least 208 tests

**Files:**
- Create: `evals/fixtures/skill-unavailable.jsonl`
- Modify: `evals/parse.mjs:71`
- Modify: `evals/parse.mjs:74-85`
- Modify: `tests/eval-parse.test.mjs`

- [x] Step 1: Create `evals/fixtures/skill-unavailable.jsonl` with exactly these four lines. It mirrors `evals/fixtures/skill-fired.jsonl` with one difference: `vibekit:example-plain` is absent from the init event's `skills` list, which is why the call errored. The `user` event is included so the fixture records the real failure rather than only its cause. `parse.mjs` does not read `user` events and will ignore it.

```
{"type":"system","subtype":"init","model":"claude-haiku-4-5-20251001","tools":["Bash","Read","Skill"],"skills":["vibekit:example-command","vibekit:using-vibekit"],"slash_commands":["vibekit:example-command"]}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Skill","input":{"skill":"vibekit:example-plain"}}]}}
{"type":"user","message":{"role":"user","content":[{"type":"tool_result","is_error":true,"content":"<tool_use_error>Unknown skill: vibekit:example-plain</tool_use_error>"}]}}
{"type":"result","subtype":"success","is_error":false,"num_turns":2,"total_cost_usd":0.0239948,"usage":{"input_tokens":2,"cache_creation_input_tokens":12892,"cache_read_input_tokens":23686,"output_tokens":283}}
```

- [x] Step 2: In `evals/parse.mjs`, insert the filter immediately before the early return that currently sits at line 71. Read the file first and place it after the loop that builds `skills` and after `initSkills` is assigned, so both are complete.

```js
  // A Skill block records an attempt, not a load. The runtime can only load a
  // skill it offered, so an attempt naming something outside initSkills came
  // back as "Unknown skill" and the body was never read. Counting those as
  // fired let sessions report a skill as fired in a worktree lacking it.
  //
  // Filtered here rather than at each expectation so one definition of "fired"
  // serves all three consumers in score.mjs: skill, after and skillAbsent.
  //
  // tools and dispatches are deliberately NOT filtered. They record a decision
  // the model made, and an errored Write still means the session chose to write
  // before designing, which is what the `before` expectation catches.
  const fired = skills.filter(s => initSkills.includes(s.name))
```

- [x] Step 3: In the early return currently at `evals/parse.mjs:71`, replace the `skills` property with `fired`. The line currently reads

```js
    return { ok: false, error: 'no result event', skills, tools, dispatches, usage, cost, subtype, initSkills, finalText }
```

and becomes

```js
    return { ok: false, error: 'no result event', skills: fired, tools, dispatches, usage, cost, subtype, initSkills, finalText }
```

- [x] Step 4: In the normal return that currently opens at `evals/parse.mjs:74`, replace the `skills,` property line, currently at line 77, with `skills: fired,`. No other property changes.

- [x] Step 5: Append two tests to `tests/eval-parse.test.mjs`, following the shape of the existing tests in that file, which read fixtures through the `fixture` helper defined at its line 7.

```js
test('a skill the session was never offered is not reported as fired', () => {
  const t = parseTranscript(fixture('skill-unavailable'))
  assert.equal(t.ok, true)
  assert.deepEqual(t.skills, [])
})

// The attempt stays in `tools` on purpose. `before` reads run.tools to enforce
// the brainstorm gate, and a session that tried to act still made the decision
// the gate exists to catch. Without this test, filtering `tools` to match
// `skills` looks like a tidy-up rather than a weakening of that gate.
test('an attempted skill is still recorded in tools', () => {
  const t = parseTranscript(fixture('skill-unavailable'))
  assert.ok(t.tools.some(u => u.name === 'Skill'), 'tools must record the attempt')
})
```

- [x] Step 6: Run `npm test`
- [x] Step 7: Commit

## Task 2: report an unavailable skill distinctly from one never invoked → verify: `npm test` exits 0 and reports at least 210 tests

**Files:**
- Modify: `evals/score.mjs:99`
- Modify: `tests/eval-score.test.mjs`

- [x] Step 1: In `evals/score.mjs`, replace the line currently at 99. It reads

```js
    if (!hit) return `skill ${expect.skill} never fired`
```

and becomes

```js
    if (!hit) {
      // Only claim unavailability when the transcript says what was offered. A
      // run object carrying no initSkills says nothing either way, so it keeps
      // the original wording rather than asserting something unobserved.
      const offered = run.initSkills ?? []
      return offered.length && !offered.includes(expect.skill)
        ? `skill ${expect.skill} was not available to the session`
        : `skill ${expect.skill} never fired`
    }
```

The `run.initSkills ?? []` guard is load-bearing. The `ok()` helper at `tests/eval-score.test.mjs:6` builds run objects with no `initSkills` field, so reading it unguarded throws in every existing test that reaches this branch.

- [x] Step 2: Append two tests to `tests/eval-score.test.mjs`. They build run objects inline rather than changing the shared `ok()` helper, because only these two need `initSkills`. Existing tests in that file assert on reasons through `scoreScenario(...).failures`, as at its line 64.

```js
test('a skill the session was never offered reports unavailability', () => {
  const scenario = { id: 's', expect: { skill: 'vibekit:example-plain' } }
  const run = { ...ok(), initSkills: ['vibekit:using-vibekit'] }
  assert.match(scoreScenario(scenario, [run]).failures[0], /was not available/)
})

test('a skill that was offered and not invoked still reports never fired', () => {
  const scenario = { id: 's', expect: { skill: 'vibekit:example-plain' } }
  const run = { ...ok(), initSkills: ['vibekit:example-plain'] }
  assert.match(scoreScenario(scenario, [run]).failures[0], /never fired/)
})
```

- [x] Step 3: Run `npm test`
- [x] Step 4: Commit
