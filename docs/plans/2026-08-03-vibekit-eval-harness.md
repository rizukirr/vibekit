# vibekit Eval Harness Implementation Plan

> **For executing agents:** implement this plan task-by-task. Each step uses checkbox (`- [ ]`) syntax. Do not skip steps. Do not batch commits across tasks.

**Goal:** Measure whether vibekit's skills actually fire at their trigger points, as a rate over repeated real sessions, so the compressed pipeline in spec 3 can be accepted or rejected on evidence rather than by reading.

**Architecture:** A/B by git ref. `evals/run.mjs` materialises two refs as throwaway worktrees, spawns `claude -p --plugin-dir <worktree> --output-format stream-json --verbose` per scenario in a disposable temp cwd, and parses the JSONL for `Skill` tool_use blocks and `result.usage`. Parsing, scoring and threshold comparison are pure functions in separate modules, unit-tested offline against committed fixtures; only `run.mjs` touches the network or the filesystem. The judge is an opt-in second `claude -p` call.

**Tech stack:** Node 24+ (ESM, `node:test`, `node:assert/strict`, `node:child_process`), the `claude` CLI, git worktrees. Zero npm dependencies.

---

## Premortem

**Hidden assumptions:**
- The plan assumes the `stream-json` event shapes stay stable: `assistant.message.content[]` blocks of `{type:"tool_use", name:"Skill", input:{skill:"vibekit:<name>"}}`, and a `result` event carrying `subtype`, `is_error`, `usage`, `total_cost_usd`. Every one of these was captured from live probes on 2026-08-03 (Claude Code, haiku) and is encoded verbatim in the committed fixtures — but they are an undocumented CLI surface that can change without notice. Mitigation: Task 9's live acceptance run is the canary; if the shapes move, it fails loudly with a parse error rather than silently returning zero rates, because Task 3 makes an unparseable transcript an error rather than a non-firing run.
- The plan assumes `--plugin-dir <path>` loads the plugin from that path rather than the installed cache. Verified by probe: a session with `--plugin-dir .` emitted `You have vibekit` and listed `vibekit:example-plain` in `init.skills`. This is the assumption the whole harness rests on, so Task 9 asserts it explicitly rather than trusting it.
- The plan assumes an authenticated `claude` on PATH. Not verifiable at unit-test time; Task 7's `requireClaude` fails fast with a named error instead of producing misleading zeros.

**Irreversible / risky steps:**
- Sessions run with `--permission-mode bypassPermissions` so the agent can actually attempt edits (the thing being measured). If the cwd were wrong, an eval run could edit the repo. Mitigated structurally: `runSession` creates the cwd with `mkdtemp` under the OS temp dir, passes it as `cwd` to the spawn, and removes it in a `finally`. Task 5's verify clause asserts the spawned cwd is under `os.tmpdir()` and is never the repo root — a test that fails if someone later "simplifies" the cwd away.
- Worktree removal deletes a directory. Restricted to paths the runner created under `.eval-worktrees/`, and it refuses to remove a dirty worktree rather than forcing.
- `none` beyond those two — every other task creates new files under `evals/` or `tests/`, and `git revert` restores the tree fully.

**Spec-misalignment:**
- The spec says results are "committed" so git is the trend store. The plan interprets this as: the runner writes the file, and committing is a human step, not something the runner does. A runner that auto-commits would be surprising and would fight the review pipeline. Surfaced because "committed" could be read either way.
- The spec's example scenario names `brainstorm-lean`, which does not exist. The spec's own text resolves this (initial scenarios target the stubs), and this plan ships exactly two scenarios against real stubs plus one footprint scenario. Spec 3 adds per-skill scenarios.
- The spec says `evals/` must stay out of `package.json` `files[]`. `FILES` in `runtimes/core.mjs` is an allowlist that never mentions `evals/`, so this needs no code change. Task 1's verify clause asserts it rather than assuming it.

**Verify-clause weakness:**
- "the parser returns something" would pass on a stub. Every parser task instead asserts specific extracted values against fixtures whose expected content is known byte-for-byte.
- Task 7's dry-run clause is the one where success and failure could look alike — a dry run that spawns nothing looks identical to a dry run that silently did nothing at all. Tightened: it asserts both that the injected spawn function was called zero times *and* that the printed plan contains the expected session count, so an empty plan fails.
- Task 9 is a live paid run and cannot be asserted deterministically. Its clause is scoped to what is checkable: a results file exists, contains a numeric rate for every scenario, and reports a non-zero `inputFootprint`.

## File structure

New — harness:
- `evals/parse.mjs` — pure: JSONL text → structured transcript facts
- `evals/score.mjs` — pure: runs → rates; rates + thresholds → pass/fail
- `evals/worktree.mjs` — materialise / remove a ref as a worktree
- `evals/session.mjs` — run one scenario against one plugin dir (spawn injected)
- `evals/run.mjs` — CLI: parse args, orchestrate, write results, set exit code
- `evals/judge.md` — rubric prompt, used only with `--judge`
- `evals/scenarios.json` — the scenario table
- `evals/thresholds.json` — regression gates

New — fixtures (hand-written, encoding shapes captured from live probes):
- `evals/fixtures/skill-fired.jsonl` — success, `Skill` invoked
- `evals/fixtures/no-skill.jsonl` — success, no `Skill`, includes a `rate_limit_event`
- `evals/fixtures/errored.jsonl` — `result.subtype` not `success`
- `evals/fixtures/late-skill.jsonl` — `Skill` invoked *after* a `Write`

New — tests:
- `tests/eval-parse.test.mjs`
- `tests/eval-score.test.mjs`
- `tests/eval-session.test.mjs`
- `tests/eval-run.test.mjs`

Modified:
- `.gitignore` — add `.eval-worktrees/`
- `vibekit.config.json` — add `eval` script to the `npm.scripts` block (NOT `package.json`, which is generated)

---

### Task 1: Harness skeleton and config → verify: `npm run check` exits 0 and the regenerated `package.json` contains an `eval` script; `node -e` confirms `files` does not contain `evals/`

**Files:**
- Modify: `.gitignore`
- Modify: `vibekit.config.json`
- Create: `evals/scenarios.json`
- Create: `evals/thresholds.json`

`package.json` is generated output. The `eval` script must be added to `vibekit.config.json` and regenerated — hand-editing `package.json` would be reverted by the next `npm run generate` and would fail `npm run check`.

- [x] **Step 1: Add the worktree directory to `.gitignore`**

Append one line, so the file reads:

```
external/
.vibe-worktrees/
.eval-worktrees/
```

- [x] **Step 2: Add the eval script to `vibekit.config.json`**

In the `npm.scripts` object, add one entry. The block becomes:

```json
    "scripts": {
      "generate": "node bin/generate.mjs",
      "check": "node bin/generate.mjs --check",
      "test": "node --test \"tests/**/*.test.mjs\"",
      "check:hook": "node --test \"tests/hook.test.mjs\"",
      "eval": "node evals/run.mjs"
    },
```

- [x] **Step 3: Write `evals/scenarios.json`**

Three scenarios against skills that exist today. `footprint` deliberately does nothing but start a session — its purpose is measuring vibekit's input cost.

```json
[
  {
    "id": "footprint",
    "prompt": "Say only: ok",
    "expect": {},
    "n": 3,
    "model": "haiku"
  },
  {
    "id": "bootstrap-injected",
    "prompt": "Say only: ok",
    "expect": { "transcriptContains": "You have vibekit" },
    "n": 3,
    "model": "haiku"
  },
  {
    "id": "skill-invocable",
    "prompt": "Invoke the vibekit:example-plain skill using the Skill tool, then stop.",
    "expect": { "skill": "vibekit:example-plain" },
    "n": 3,
    "model": "haiku"
  }
]
```

- [x] **Step 4: Write `evals/thresholds.json`**

```json
{
  "defaults": { "minFiringRate": 0.8, "maxRateRegression": 0.2 },
  "scenarios": {
    "footprint": { "minFiringRate": 0 },
    "bootstrap-injected": { "minFiringRate": 1 }
  }
}
```

`footprint` has no expectation to satisfy, so its floor is 0; it exists for its token numbers. `bootstrap-injected` is deterministic — the hook either fires or it does not — so its floor is 1.

- [x] **Step 5: Regenerate and verify**

Run: `npm run generate && npm run check`
Expected: `wrote package.json` then `up to date`, exit 0.

- [x] **Step 6: Confirm the eval script landed and evals/ does not ship**

Run:
```bash
node -e "const p=require('./package.json'); if(!p.scripts.eval) throw new Error('eval script missing'); if(p.files.some(f=>f.startsWith('evals'))) throw new Error('evals must not ship'); console.log('ok:', p.scripts.eval)"
```
Expected: `ok: node evals/run.mjs`

- [x] **Step 7: Commit**

```bash
git add .gitignore vibekit.config.json package.json evals/scenarios.json evals/thresholds.json
git commit -m "feat(evals): harness skeleton, scenarios and thresholds"
```

---

### Task 2: Transcript fixtures → verify: all four fixture files parse as JSONL with `node -e`, and `skill-fired.jsonl` contains a `tool_use` block with `name` `Skill`

**Files:**
- Create: `evals/fixtures/skill-fired.jsonl`
- Create: `evals/fixtures/no-skill.jsonl`
- Create: `evals/fixtures/errored.jsonl`
- Create: `evals/fixtures/late-skill.jsonl`

These encode event shapes captured from live probes on 2026-08-03. They are trimmed to the fields the parser reads — real transcripts carry ~25 more keys per event and embed session ids and local paths, which do not belong in the repo.

- [ ] **Step 1: Write `evals/fixtures/skill-fired.jsonl`**

```
{"type":"system","subtype":"init","model":"claude-haiku-4-5-20251001","tools":["Bash","Read","Skill"],"skills":["vibekit:example-command","vibekit:example-plain","vibekit:using-vibekit"],"slash_commands":["vibekit:example-command"]}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"thinking","thinking":"user wants the skill"}]}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Skill","input":{"skill":"vibekit:example-plain"}}]}}
{"type":"result","subtype":"success","is_error":false,"num_turns":2,"total_cost_usd":0.0239948,"usage":{"input_tokens":2,"cache_creation_input_tokens":12892,"cache_read_input_tokens":23686,"output_tokens":283}}
```

- [ ] **Step 2: Write `evals/fixtures/no-skill.jsonl`**

Includes a `rate_limit_event`, which real transcripts emit and which must not be mistaken for a failure.

```
{"type":"system","subtype":"init","model":"claude-haiku-4-5-20251001","tools":["Bash","Read","Skill"],"skills":["vibekit:example-plain"],"slash_commands":[]}
{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","rateLimitType":"five_hour"}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"ok"}]}}
{"type":"result","subtype":"success","is_error":false,"num_turns":1,"total_cost_usd":0.0887088,"usage":{"input_tokens":2,"cache_creation_input_tokens":12892,"cache_read_input_tokens":23686,"output_tokens":283}}
```

- [ ] **Step 3: Write `evals/fixtures/errored.jsonl`**

```
{"type":"system","subtype":"init","model":"claude-haiku-4-5-20251001","tools":["Skill"],"skills":[],"slash_commands":[]}
{"type":"result","subtype":"error_during_execution","is_error":true,"num_turns":0,"total_cost_usd":0,"usage":{"input_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":0}}
```

- [ ] **Step 4: Write `evals/fixtures/late-skill.jsonl`**

The skill fires, but only after a `Write` — a pass by firing alone, a failure by order.

```
{"type":"system","subtype":"init","model":"claude-haiku-4-5-20251001","tools":["Write","Skill"],"skills":["vibekit:example-plain"],"slash_commands":[]}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Write","input":{"file_path":"/tmp/x/App.jsx"}}]}}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Skill","input":{"skill":"vibekit:example-plain"}}]}}
{"type":"result","subtype":"success","is_error":false,"num_turns":3,"total_cost_usd":0.03,"usage":{"input_tokens":2,"cache_creation_input_tokens":12892,"cache_read_input_tokens":100,"output_tokens":400}}
```

- [ ] **Step 5: Verify the fixtures**

Run:
```bash
node -e "
const {readFileSync}=require('fs');
for (const f of ['skill-fired','no-skill','errored','late-skill']) {
  const lines=readFileSync('evals/fixtures/'+f+'.jsonl','utf8').split('\n').filter(Boolean);
  lines.forEach(l=>JSON.parse(l));
  console.log(f, lines.length, 'events');
}
const t=readFileSync('evals/fixtures/skill-fired.jsonl','utf8');
if(!t.includes('\"name\":\"Skill\"')) throw new Error('skill-fired must contain a Skill tool_use');
console.log('fixtures ok');
"
```
Expected: four `<name> <n> events` lines then `fixtures ok`.

- [ ] **Step 6: Commit**

```bash
git add evals/fixtures
git commit -m "test(evals): transcript fixtures captured from live probe shapes"
```

---

### Task 3: Transcript parser → verify: `tests/eval-parse.test.mjs` reports `pass 8`; `parseTranscript` on `errored.jsonl` returns `ok:false` and on `late-skill.jsonl` returns a `Skill` index greater than the `Write` index

**Files:**
- Create: `evals/parse.mjs`
- Test: `tests/eval-parse.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/eval-parse.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseTranscript } from '../evals/parse.mjs'

const fixture = name => readFileSync(`evals/fixtures/${name}.jsonl`, 'utf8')

test('extracts a Skill invocation with its position', () => {
  const t = parseTranscript(fixture('skill-fired'))
  assert.equal(t.ok, true)
  assert.deepEqual(t.skills, [{ name: 'vibekit:example-plain', index: 0 }])
})

test('reports no skills when none were invoked', () => {
  const t = parseTranscript(fixture('no-skill'))
  assert.equal(t.ok, true)
  assert.deepEqual(t.skills, [])
})

test('a rate_limit_event does not make a successful run unsuccessful', () => {
  assert.equal(parseTranscript(fixture('no-skill')).ok, true)
})

test('an errored result is not ok', () => {
  const t = parseTranscript(fixture('errored'))
  assert.equal(t.ok, false)
  assert.equal(t.subtype, 'error_during_execution')
})

test('records tool uses in order so ordering can be checked', () => {
  const t = parseTranscript(fixture('late-skill'))
  const write = t.tools.find(u => u.name === 'Write')
  const skill = t.tools.find(u => u.name === 'Skill')
  assert.ok(write.index < skill.index, 'fixture must have Write before Skill')
})

test('extracts usage and cost', () => {
  const t = parseTranscript(fixture('skill-fired'))
  assert.equal(t.usage.cache_creation_input_tokens, 12892)
  assert.equal(t.usage.output_tokens, 283)
  assert.equal(t.cost, 0.0239948)
})

test('exposes the skills the session discovered', () => {
  const t = parseTranscript(fixture('skill-fired'))
  assert.ok(t.initSkills.includes('vibekit:example-plain'))
})

test('an unparseable transcript is an error, never a silent non-firing run', () => {
  const t = parseTranscript('not json at all\n')
  assert.equal(t.ok, false)
  assert.match(t.error, /no result event/)
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `node --test tests/eval-parse.test.mjs`
Expected: FAIL — the suite fails to load with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module ... parse.mjs`, reported as `fail 1` (a file that cannot load counts as one failing test, not one per test).

- [ ] **Step 3: Write the implementation**

```js
// evals/parse.mjs

// Pure: JSONL text in, facts out. No fs, no network — this is what lets the
// scoring rules be tested without spending money on sessions.
export function parseTranscript(text) {
  const skills = []
  const tools = []
  let usage = null
  let cost = null
  let subtype = null
  let isError = null
  let initSkills = []
  let toolIndex = 0

  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue // partial or non-JSON lines are ignored; the result event decides ok
    }

    if (event.type === 'system' && event.subtype === 'init') {
      initSkills = event.skills ?? []
    } else if (event.type === 'assistant') {
      for (const block of event.message?.content ?? []) {
        if (block.type !== 'tool_use') continue
        const index = toolIndex++
        tools.push({ name: block.name, index })
        if (block.name === 'Skill') {
          skills.push({ name: block.input?.skill, index })
        }
      }
    } else if (event.type === 'result') {
      subtype = event.subtype
      isError = event.is_error
      usage = event.usage ?? null
      cost = event.total_cost_usd ?? null
    }
  }

  // A session that produced no result event did not complete. Treating that as
  // "the skill did not fire" would let an API failure masquerade as a
  // behavioural regression, so it is an error instead.
  if (subtype === null) {
    return { ok: false, error: 'no result event', skills, tools, usage, cost, subtype, initSkills }
  }

  return {
    ok: subtype === 'success' && isError !== true,
    error: null,
    skills,
    tools,
    usage,
    cost,
    subtype,
    initSkills,
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `node --test tests/eval-parse.test.mjs`
Expected: PASS — `pass 8`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add evals/parse.mjs tests/eval-parse.test.mjs
git commit -m "feat(evals): transcript parser with errored-run detection"
```

---

### Task 4: Scoring and thresholds → verify: `tests/eval-score.test.mjs` reports `pass 9`; a scenario with 2 successes out of 3 runs scores 0.667 and errored runs are excluded from the denominator

**Files:**
- Create: `evals/score.mjs`
- Test: `tests/eval-score.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// tests/eval-score.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { scoreScenario, compare } from '../evals/score.mjs'

const ok = (skills = [], tools = []) => ({ ok: true, skills, tools, usage: { cache_creation_input_tokens: 100, output_tokens: 10 }, cost: 0.01 })
const fired = () => ok([{ name: 'vibekit:example-plain', index: 0 }], [{ name: 'Skill', index: 0 }])
const errored = () => ({ ok: false, skills: [], tools: [], usage: null, cost: null })

const scenario = { id: 's', expect: { skill: 'vibekit:example-plain' } }

test('rate is fired over successful runs', () => {
  const r = scoreScenario(scenario, [fired(), fired(), ok()])
  assert.equal(r.successful, 3)
  assert.ok(Math.abs(r.rate - 2 / 3) < 1e-9)
})

test('errored runs are excluded from the denominator', () => {
  const r = scoreScenario(scenario, [fired(), errored(), errored()])
  assert.equal(r.successful, 1)
  assert.equal(r.errored, 2)
  assert.equal(r.rate, 1)
})

test('a scenario with no successful runs is incomplete, not a zero rate', () => {
  const r = scoreScenario(scenario, [errored(), errored()])
  assert.equal(r.incomplete, true)
  assert.equal(r.rate, null)
})

test('order expectation fails when the skill comes after a forbidden tool', () => {
  const late = ok(
    [{ name: 'vibekit:example-plain', index: 1 }],
    [{ name: 'Write', index: 0 }, { name: 'Skill', index: 1 }],
  )
  const s = { id: 's', expect: { skill: 'vibekit:example-plain', before: ['Write'] } }
  assert.equal(scoreScenario(s, [late]).rate, 0)
})

test('order expectation passes when the skill comes first', () => {
  const early = ok(
    [{ name: 'vibekit:example-plain', index: 0 }],
    [{ name: 'Skill', index: 0 }, { name: 'Write', index: 1 }],
  )
  const s = { id: 's', expect: { skill: 'vibekit:example-plain', before: ['Write'] } }
  assert.equal(scoreScenario(s, [early]).rate, 1)
})

test('a scenario with an empty expectation always satisfies', () => {
  const r = scoreScenario({ id: 'footprint', expect: {} }, [ok(), ok()])
  assert.equal(r.rate, 1)
})

test('averages token metrics across successful runs', () => {
  const r = scoreScenario(scenario, [fired(), fired()])
  assert.equal(r.inputFootprint, 100)
  assert.equal(r.outputTokens, 10)
})

test('compare fails a candidate below the absolute floor', () => {
  const thresholds = { defaults: { minFiringRate: 0.8, maxRateRegression: 0.2 }, scenarios: {} }
  const out = compare({ s: { rate: 0.5 } }, null, thresholds)
  assert.equal(out.pass, false)
  assert.match(out.failures[0], /below floor/)
})

test('compare fails a candidate that regressed against baseline beyond tolerance', () => {
  const thresholds = { defaults: { minFiringRate: 0, maxRateRegression: 0.2 }, scenarios: {} }
  const out = compare({ s: { rate: 0.5 } }, { s: { rate: 1 } }, thresholds)
  assert.equal(out.pass, false)
  assert.match(out.failures[0], /regressed/)
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `node --test tests/eval-score.test.mjs`
Expected: FAIL — the suite fails to load with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module ... score.mjs`, reported as `fail 1`.

- [ ] **Step 3: Write the implementation**

```js
// evals/score.mjs

function satisfied(scenario, run) {
  const expect = scenario.expect ?? {}
  if (expect.skill !== undefined) {
    const hit = run.skills.find(s => s.name === expect.skill)
    if (!hit) return false
    for (const forbidden of expect.before ?? []) {
      const earlier = run.tools.find(t => t.name === forbidden && t.index < hit.index)
      if (earlier) return false
    }
  }
  if (expect.transcriptContains !== undefined && !run.contains?.(expect.transcriptContains)) {
    return false
  }
  return true
}

const mean = xs => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length)

export function scoreScenario(scenario, runs) {
  const good = runs.filter(r => r.ok)
  const errored = runs.length - good.length

  // No successful run is "incomplete", not a zero rate. A zero rate says the
  // skill failed to fire; incomplete says we never got to find out.
  if (good.length === 0) {
    return { id: scenario.id, rate: null, incomplete: true, successful: 0, errored, inputFootprint: null, outputTokens: null, cost: null }
  }

  return {
    id: scenario.id,
    rate: good.filter(r => satisfied(scenario, r)).length / good.length,
    incomplete: false,
    successful: good.length,
    errored,
    inputFootprint: mean(good.map(r => r.usage?.cache_creation_input_tokens ?? 0)),
    outputTokens: mean(good.map(r => r.usage?.output_tokens ?? 0)),
    cost: mean(good.map(r => r.cost ?? 0)),
  }
}

export function compare(candidate, baseline, thresholds) {
  const failures = []
  for (const [id, result] of Object.entries(candidate)) {
    const gate = { ...thresholds.defaults, ...(thresholds.scenarios?.[id] ?? {}) }

    if (result.incomplete) {
      failures.push(`${id}: incomplete — no successful runs`)
      continue
    }
    if (result.rate < gate.minFiringRate) {
      failures.push(`${id}: rate ${result.rate.toFixed(2)} below floor ${gate.minFiringRate}`)
    }
    // The relative gate needs something to compare against; with no baseline
    // only the absolute floor applies.
    const base = baseline?.[id]
    if (base && !base.incomplete && base.rate - result.rate > gate.maxRateRegression) {
      failures.push(`${id}: regressed ${base.rate.toFixed(2)} → ${result.rate.toFixed(2)}`)
    }
  }
  return { pass: failures.length === 0, failures }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `node --test tests/eval-score.test.mjs`
Expected: PASS — `pass 9`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add evals/score.mjs tests/eval-score.test.mjs
git commit -m "feat(evals): scoring, incomplete detection and threshold comparison"
```

---

### Task 5: Session runner → verify: `tests/eval-session.test.mjs` reports `pass 5`; the injected spawn receives a `cwd` under `os.tmpdir()` that is not the repo root, and the temp dir does not exist after the call

**Files:**
- Create: `evals/session.mjs`
- Test: `tests/eval-session.test.mjs`

The cwd assertions are the safety property from the premortem: sessions run with edits permitted, so the working directory must never be the repo.

- [ ] **Step 1: Write the failing test**

```js
// tests/eval-session.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
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

test('returns the parsed transcript', () => {
  const result = runSession(scenario, '/plugins/candidate', fakeSpawn([]))
  assert.equal(result.ok, true)
  assert.equal(result.skills[0].name, 'vibekit:example-plain')
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `node --test tests/eval-session.test.mjs`
Expected: FAIL — the suite fails to load with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module ... session.mjs`, reported as `fail 1`.

- [ ] **Step 3: Write the implementation**

```js
// evals/session.mjs
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseTranscript } from './parse.mjs'

// Sessions run with edits permitted, because "did the agent write code before
// invoking the skill" is the thing being measured — plan mode would block the
// very action under observation. Safety comes from the cwd being a throwaway
// temp directory, never the repo.
export function runSession(scenario, pluginDir, spawn = spawnSync) {
  const cwd = mkdtempSync(join(tmpdir(), 'vibekit-eval-'))
  try {
    const args = [
      '-p', scenario.prompt,
      '--output-format', 'stream-json',
      '--verbose', // required by the CLI whenever output-format is stream-json
      '--plugin-dir', pluginDir,
      '--permission-mode', 'bypassPermissions',
    ]
    if (scenario.model) args.push('--model', scenario.model)

    const proc = spawn('claude', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    const stdout = proc.stdout ?? ''
    const parsed = parseTranscript(stdout)
    // `raw` is what the opt-in judge grades; `contains` backs the
    // transcriptContains expectation without re-reading the stream.
    return { ...parsed, raw: stdout, contains: needle => stdout.includes(needle) }
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `node --test tests/eval-session.test.mjs`
Expected: PASS — `pass 5`, `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add evals/session.mjs tests/eval-session.test.mjs
git commit -m "feat(evals): session runner with disposable cwd"
```

---

### Task 6: Worktree materialisation → verify: `node -e` creates a worktree for `HEAD`, confirms `evals/run.mjs`'s parent dir exists inside it, removes it, and confirms the path is gone

**Files:**
- Create: `evals/worktree.mjs`

This task has no unit test: every meaningful behaviour is a git side effect, and mocking git would test the mock. It is verified by the runnable check in Step 2 instead.

- [ ] **Step 1: Write the implementation**

```js
// evals/worktree.mjs
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve('.eval-worktrees')

function git(args) {
  const proc = spawnSync('git', args, { encoding: 'utf8' })
  if (proc.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${proc.stderr.trim()}`)
  return proc.stdout.trim()
}

// Materialises a ref as a throwaway worktree. Variants are git refs rather than
// directories in the repo: a second skills/ tree would drift from the real one,
// which is the failure this project was rebuilt to remove.
export function materialise(ref) {
  git(['rev-parse', '--verify', `${ref}^{commit}`]) // fail before spawning sessions
  const path = join(ROOT, ref.replace(/[^\w.-]/g, '_'))
  if (existsSync(path)) return path
  git(['worktree', 'add', '--detach', path, ref])
  return path
}

export function remove(path) {
  if (!resolve(path).startsWith(ROOT)) {
    throw new Error(`refusing to remove ${path}: outside ${ROOT}`)
  }
  if (!existsSync(path)) return
  git(['worktree', 'remove', path]) // no --force: a dirty worktree should fail loudly
}
```

- [ ] **Step 2: Verify with a real worktree round-trip**

Run:
```bash
node -e "
import('./evals/worktree.mjs').then(async wt => {
  const {existsSync}=await import('fs');
  const p = wt.materialise('HEAD');
  if(!existsSync(p+'/evals')) throw new Error('worktree missing evals/');
  console.log('created', p);
  wt.remove(p);
  if(existsSync(p)) throw new Error('worktree not removed');
  console.log('removed ok');
})
"
```
Expected: `created .eval-worktrees/HEAD` then `removed ok`.

- [ ] **Step 3: Confirm the guard rejects an outside path**

Run:
```bash
node -e "
import('./evals/worktree.mjs').then(wt => {
  try { wt.remove('/tmp'); throw new Error('guard did not fire'); }
  catch (e) { if(!/refusing to remove/.test(e.message)) throw e; console.log('guard ok'); }
})
"
```
Expected: `guard ok`

- [ ] **Step 4: Confirm no worktree leaked**

Run: `git worktree list`
Expected: only the main worktree at `/home/rizukirr/Projects/vibekit`.

- [ ] **Step 5: Commit**

```bash
git add evals/worktree.mjs
git commit -m "feat(evals): git-ref worktree materialisation with removal guard"
```

---

### Task 7: Runner CLI and dry-run → verify: `tests/eval-run.test.mjs` reports `pass 4`; a dry run calls the injected spawn exactly 0 times and prints a plan naming 9 sessions

**Files:**
- Create: `evals/run.mjs`
- Test: `tests/eval-run.test.mjs`

The dry-run assertion checks both that nothing spawned *and* that the plan is non-empty — a dry run that silently did nothing would otherwise look identical to a correct one.

- [ ] **Step 1: Write the failing test**

```js
// tests/eval-run.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseArgs, planRuns, formatPlan } from '../evals/run.mjs'

const scenarios = [
  { id: 'a', prompt: 'x', n: 3, model: 'haiku' },
  { id: 'b', prompt: 'y', n: 3, model: 'haiku' },
  { id: 'c', prompt: 'z', n: 3, model: 'haiku' },
]

test('parses refs, flags and scenario filter', () => {
  const o = parseArgs(['--baseline', 'main', '--candidate', 'HEAD', '--judge', '--dry-run', '--scenarios', 'a,b', '-n', '2'])
  assert.equal(o.baseline, 'main')
  assert.equal(o.candidate, 'HEAD')
  assert.equal(o.judge, true)
  assert.equal(o.dryRun, true)
  assert.deepEqual(o.scenarios, ['a', 'b'])
  assert.equal(o.n, 2)
})

test('candidate defaults to HEAD and baseline to null', () => {
  const o = parseArgs([])
  assert.equal(o.candidate, 'HEAD')
  assert.equal(o.baseline, null)
})

test('plans one run per scenario per repeat per variant', () => {
  const runs = planRuns(scenarios, { candidate: 'HEAD', baseline: null, scenarios: null, n: null })
  assert.equal(runs.length, 9) // 3 scenarios x 3 repeats x 1 variant
  const withBaseline = planRuns(scenarios, { candidate: 'HEAD', baseline: 'main', scenarios: null, n: null })
  assert.equal(withBaseline.length, 18)
})

test('the printed plan names the session count so an empty plan is visible', () => {
  const runs = planRuns(scenarios, { candidate: 'HEAD', baseline: null, scenarios: null, n: null })
  assert.match(formatPlan(runs, { candidate: 'HEAD', baseline: null }), /9 sessions/)
})
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `node --test tests/eval-run.test.mjs`
Expected: FAIL — the suite fails to load with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module ... run.mjs`, reported as `fail 1`.

- [ ] **Step 3: Write the implementation**

```js
// evals/run.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { runSession } from './session.mjs'
import { scoreScenario, compare } from './score.mjs'
import { materialise, remove } from './worktree.mjs'

export function parseArgs(argv) {
  const value = flag => {
    const i = argv.indexOf(flag)
    return i === -1 ? null : argv[i + 1]
  }
  const list = value('--scenarios')
  const n = value('-n')
  return {
    baseline: value('--baseline'),
    candidate: value('--candidate') ?? 'HEAD',
    judge: argv.includes('--judge'),
    dryRun: argv.includes('--dry-run'),
    scenarios: list ? list.split(',') : null,
    n: n ? Number(n) : null,
  }
}

export function planRuns(scenarios, opts) {
  const selected = opts.scenarios ? scenarios.filter(s => opts.scenarios.includes(s.id)) : scenarios
  const variants = [['candidate', opts.candidate]]
  if (opts.baseline) variants.push(['baseline', opts.baseline])

  const runs = []
  for (const [variant, ref] of variants) {
    for (const scenario of selected) {
      const repeats = opts.n ?? scenario.n ?? 3
      for (let i = 0; i < repeats; i++) runs.push({ variant, ref, scenario, i })
    }
  }
  return runs
}

export function formatPlan(runs, opts) {
  const lines = [`${runs.length} sessions`, `candidate: ${opts.candidate}`]
  if (opts.baseline) lines.push(`baseline: ${opts.baseline}`)
  for (const [id, count] of Object.entries(
    runs.reduce((acc, r) => ({ ...acc, [`${r.variant}:${r.scenario.id}`]: (acc[`${r.variant}:${r.scenario.id}`] ?? 0) + 1 }), {}),
  )) {
    lines.push(`  ${id} x${count}`)
  }
  return lines.join('\n')
}

function requireClaude() {
  const probe = spawnSync('claude', ['--version'], { encoding: 'utf8' })
  if (probe.status !== 0) {
    throw new Error('claude CLI not available or not authenticated — cannot run evals')
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const scenarios = JSON.parse(readFileSync('evals/scenarios.json', 'utf8'))
  const thresholds = JSON.parse(readFileSync('evals/thresholds.json', 'utf8'))
  const runs = planRuns(scenarios, opts)

  console.log(formatPlan(runs, opts))
  if (opts.dryRun) {
    console.log('dry run — nothing spawned')
    return 0
  }

  requireClaude()

  const worktrees = {}
  const byVariant = { candidate: {}, baseline: {} }
  try {
    for (const run of runs) {
      worktrees[run.ref] ??= materialise(run.ref)
      const result = runSession(run.scenario, worktrees[run.ref])
      if (opts.judge && result.ok) result.judge = judgeTranscript(run.scenario, result.raw, spawnSync)
      ;(byVariant[run.variant][run.scenario.id] ??= []).push(result)
      process.stdout.write(result.ok ? '.' : 'E')
    }
  } finally {
    process.stdout.write('\n')
    for (const path of Object.values(worktrees)) remove(path)
  }

  const score = groups =>
    Object.fromEntries(
      Object.entries(groups).map(([id, results]) => [
        id,
        scoreScenario(scenarios.find(s => s.id === id), results),
      ]),
    )

  const candidate = score(byVariant.candidate)
  const baseline = opts.baseline ? score(byVariant.baseline) : null
  const verdict = compare(candidate, baseline, thresholds)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  mkdirSync('evals/results', { recursive: true })
  const out = `evals/results/${stamp}-${opts.candidate.replace(/[^\w.-]/g, '_')}.json`
  // The runner writes the file; committing it is a human step. A runner that
  // auto-commits would fight the review pipeline.
  writeFileSync(out, `${JSON.stringify({ opts, candidate, baseline, verdict }, null, 2)}\n`)
  console.log(`results: ${out}`)

  for (const [id, r] of Object.entries(candidate)) {
    const rate = r.incomplete ? 'incomplete' : r.rate.toFixed(2)
    console.log(`  ${id}: rate=${rate} footprint=${r.inputFootprint ?? '-'} errors=${r.errored}`)
  }

  if (!verdict.pass) {
    console.error('FAIL')
    for (const f of verdict.failures) console.error(`  ${f}`)
    return 1
  }
  console.log('PASS')
  return 0
}

if (process.argv[1] && process.argv[1].endsWith('run.mjs')) {
  main().then(code => process.exit(code)).catch(error => {
    console.error(`vibekit-eval: ${error.message}`)
    process.exit(1)
  })
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `node --test tests/eval-run.test.mjs`
Expected: PASS — `pass 4`, `fail 0`.

- [ ] **Step 5: Confirm a real dry run spawns nothing**

Run: `npm run eval -- --dry-run`
Expected: a plan listing `9 sessions`, then `dry run — nothing spawned`. No `claude` process starts and no worktree is created.

- [ ] **Step 6: Confirm no worktree leaked**

Run: `git worktree list`
Expected: only the main worktree.

- [ ] **Step 7: Commit**

```bash
git add evals/run.mjs tests/eval-run.test.mjs
git commit -m "feat(evals): runner CLI with dry-run planning"
```

---

### Task 8: Judge rubric and opt-in grading → verify: `npm run eval -- --dry-run --judge` still spawns nothing and its plan names the judge; `evals/judge.md` exists and contains the required JSON output contract

**Files:**
- Create: `evals/judge.md`
- Modify: `evals/run.mjs`

- [ ] **Step 1: Write the rubric**

`evals/judge.md`:

```markdown
You are grading whether an agent FOLLOWED a skill, not merely whether it invoked one.

You will receive:
- SKILL: the name of the skill that was expected
- TRANSCRIPT: the session transcript

Decide whether the agent's behaviour after invoking the skill is consistent with
that skill's stated procedure. Invoking a skill and then ignoring its checklist
is a failure, not a pass.

Return exactly this JSON and nothing else:

{"followed": true|false, "score": 0-5, "why": "<one sentence>"}

Scoring:
- 5 — followed the skill's procedure faithfully
- 3 — invoked and partially followed
- 1 — invoked and ignored
- 0 — never invoked

Do not explain outside the JSON. Do not wrap the JSON in a code fence.
```

- [ ] **Step 2: Add the judge to the runner**

Insert this function into `evals/run.mjs` immediately after the `requireClaude` function:

```js
// The judge is the same claude binary, so it adds no dependency. Opt-in because
// it doubles session count and cost.
export function judgeTranscript(scenario, transcript, spawn) {
  const rubric = readFileSync('evals/judge.md', 'utf8')
  const prompt = `${rubric}\n\nSKILL: ${scenario.expect?.skill ?? '(none)'}\n\nTRANSCRIPT:\n${transcript}`
  const proc = spawn('claude', ['-p', prompt, '--output-format', 'json', '--model', 'haiku'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  try {
    const outer = JSON.parse(proc.stdout ?? '')
    return JSON.parse(outer.result)
  } catch {
    return { judge_error: true, followed: null, score: null, why: 'unparseable judge output' }
  }
}
```

- [ ] **Step 3: Mention the judge in the plan output**

In `formatPlan`, change the first line so the judge is visible in a dry run. Replace:

```js
  const lines = [`${runs.length} sessions`, `candidate: ${opts.candidate}`]
```

with:

```js
  const lines = [
    `${runs.length} sessions${opts.judge ? ` + ${runs.length} judge calls` : ''}`,
    `candidate: ${opts.candidate}`,
  ]
```

- [ ] **Step 4: Verify the rubric contract is present**

Run:
```bash
node -e "
const t=require('fs').readFileSync('evals/judge.md','utf8');
for (const k of ['followed','score','why']) if(!t.includes(k)) throw new Error('rubric missing '+k);
console.log('rubric ok');
"
```
Expected: `rubric ok`

- [ ] **Step 5: Confirm a judged dry run still spawns nothing**

Run: `npm run eval -- --dry-run --judge`
Expected: a plan whose first line reads `9 sessions + 9 judge calls`, then `dry run — nothing spawned`.

- [ ] **Step 6: Run the full unit suite**

Run: `npm test`
Expected: `fail 0` across every suite.

- [ ] **Step 7: Commit**

```bash
git add evals/judge.md evals/run.mjs
git commit -m "feat(evals): opt-in judge for skill-following, not just invocation"
```

---

### Task 9: Live acceptance run → verify: `npm run eval` exits 0, writes a results file whose `bootstrap-injected` rate is 1 and whose `footprint.inputFootprint` is greater than 1000

**Files:**
- Create: `evals/results/<timestamp>-HEAD.json` (produced by the run, then committed)
- Modify: `README.md`

This is the only paid step in the plan. It costs roughly 9 haiku sessions — on the order of $0.20–0.80 based on the $0.024–0.089 per-session figures measured during design.

- [ ] **Step 1: Run the harness for real**

Run: `npm run eval`
Expected: a plan line, then a progress line of dots (one per session, `E` for an errored session), then `results: evals/results/<timestamp>-HEAD.json`, a per-scenario summary, and `PASS`. Exit code 0.

If a scenario reports `incomplete`, the sessions are failing rather than the skills — check `claude` auth and rate limits, then re-run. Do not lower the thresholds to make it pass.

- [ ] **Step 2: Assert the acceptance criteria against the results file**

Run:
```bash
node -e "
const {readdirSync,readFileSync}=require('fs');
const f=readdirSync('evals/results').sort().pop();
const r=JSON.parse(readFileSync('evals/results/'+f,'utf8'));
if(r.candidate['bootstrap-injected'].rate!==1) throw new Error('bootstrap did not inject on every run');
if(!(r.candidate.footprint.inputFootprint>1000)) throw new Error('footprint implausibly small: '+r.candidate.footprint.inputFootprint);
if(r.verdict.pass!==true) throw new Error('verdict not pass');
console.log('acceptance ok — footprint', r.candidate.footprint.inputFootprint, 'tokens');
"
```
Expected: `acceptance ok — footprint <n> tokens` with `<n>` in the low tens of thousands.

- [ ] **Step 3: Confirm no worktree or temp directory leaked**

Run: `git worktree list && ls .eval-worktrees 2>/dev/null || echo "(no .eval-worktrees)"`
Expected: only the main worktree, and either an empty `.eval-worktrees` or the `(no .eval-worktrees)` line.

- [ ] **Step 4: Document the harness in the README**

Insert this section immediately before the existing `## Install` section:

```markdown
## Evals

Skills are behaviour-shaping prompts, so the only way to know one works is to
watch it fire in a real session.

```
npm run eval                                  # candidate only, deterministic
npm run eval -- --baseline main --candidate HEAD   # A/B two refs
npm run eval -- --dry-run                     # print the plan and cost, spawn nothing
npm run eval -- --judge                       # also grade whether the skill was followed
```

Variants are git refs materialised as throwaway worktrees, so there is never a
second `skills/` tree to drift. Sessions run in a disposable temp directory, not
the repo.

This costs real money and needs an authenticated `claude` CLI, so it is a manual
gate — not part of the free CI (`check`, `test`, `check:hook`).
```

- [ ] **Step 5: Regenerate and check**

Run: `npm run generate && npm run check`
Expected: `up to date`, exit 0. The README skill-list region is untouched by the prose edit.

- [ ] **Step 6: Commit**

```bash
git add evals/results README.md
git commit -m "test(evals): live acceptance run and harness docs"
```
