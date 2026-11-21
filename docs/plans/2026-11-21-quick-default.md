# quick default: Implementation Plan

**Spec:** docs/specs/2026-11-21-quick-default-design.md
**Goal:** Make `quick` the default path for implementation work, with a fact-based size gate that asks the user to move big work to the normal flow or `repl`.
**Architecture:** `quick` takes `brainstorm`'s trigger and becomes a hard gate that thinks silently through `decide`, builds in units and proves the result. `brainstorm` keeps its hard gate but fires only on escalation. The eval scorer gains a `toolAbsent` key so the gate scenarios can assert no edit happened.

## Global constraints
- Every edited string obeys `plain`'s rules, which `npm test` checks.
- Generated files are regenerated with `npm run generate`, never hand-edited.
- No shipped file names an outside source, as `tests/no-external-references.test.mjs` requires.
- Unfinished edits from a stopped `quick` run stay in the working tree. `quick` never reverts them.

### Task 1: toolAbsent eval key → verify: `npm test` exits 0 and `grep -c "toolAbsent" tests/eval-score.test.mjs` prints at least 3

**Files:**
- Modify: `evals/score.mjs:75-81` (the `KNOWN_EXPECTATIONS` set)
- Modify: `evals/score.mjs:121-129` (after the `skillAbsent` loop)
- Modify: `tests/eval-score.test.mjs:454` (insert after the last `skillAbsent` test)

- [x] Step 1: In `evals/score.mjs`, change the line `'skill', 'before', 'after', 'skillAbsent',` to `'skill', 'before', 'after', 'skillAbsent', 'toolAbsent',`.
- [x] Step 2: In `evals/score.mjs`, directly after the closing `}` of the `for (const name of [].concat(expect.skillAbsent ?? []))` loop, insert:

```js
  // skillAbsent's mirror over tools: none of the named tools ran. A gate that
  // must stop and ask is only proven when no edit tool ran at all.
  for (const name of [].concat(expect.toolAbsent ?? [])) {
    if (run.tools.some(t => t.name === name)) return `tool ${name} used`
  }
```

- [x] Step 3: In `tests/eval-score.test.mjs`, after the test `skillAbsent paired with skill: a session that did nothing fails the positive half`, insert:

```js
test('toolAbsent is unsatisfied when the named tool ran', () => {
  const s = { id: 's', expect: { toolAbsent: 'Skill' } }
  assert.equal(scoreScenario(s, [fired()]).rate, 0)
})

test('toolAbsent is satisfied when the named tool did not run', () => {
  const s = { id: 's', expect: { toolAbsent: 'Write' } }
  assert.equal(scoreScenario(s, [fired()]).rate, 1)
})

test('toolAbsent accepts an array and is unsatisfied by any member running', () => {
  const s = { id: 's', expect: { toolAbsent: ['Write', 'Skill'] } }
  assert.equal(scoreScenario(s, [fired()]).rate, 0)
  assert.equal(scoreScenario(s, [ok()]).rate, 1)
})
```

- [x] Step 4: Run `npm test`
- [x] Step 5: Commit `feat(evals): toolAbsent expectation`

### Task 2: rewrite quick → verify: `npm run check` exits 0, `npm test` exits 0, `grep -c "Skipped:" skills/quick/SKILL.md` prints 0, and `grep -c "Ran: <check>" skills/quick/SKILL.md` prints at least 1

**Files:**
- Modify: `skills/quick/SKILL.md` (whole file)
- Regenerate: `CLAUDE.md`, `AGENTS.md`, `rules/AGENTS.md`, `README.md`, `commands/quick.toml` and any other file `npm run generate` writes

- [x] Step 1: Replace the whole of `skills/quick/SKILL.md` with:

````markdown
---
name: quick
description: "Use before any implementation work: features, fixes, behavior changes. Checks the size first, then thinks the design through silently, builds in one go and proves it works by running it. Asks the user to move big work to the normal flow or repl."
trigger: About to start creative or implementation work, before code is written
gate: hard
command: true
---

# quick

The default path. One intent in, the change designed, built and proven in one go, with no documents in between.

## 0. Modifiers

Invoke `lazy`, `terse` and `plain`, any that are not already on. They stay on for the rest of the session, and every line `quick` prints follows them.

## 1. Gate

Check these facts about the request before any edit:

- It needs a dependency that is not already installed.
- It touches a schema, a migration, or the shape of stored data.
- It touches auth, payments, permissions, or any other trust boundary.
- It spans more files than you can hold in one reading.
- The intent reads two ways.
- It asks for more than 3 separate things a user could see or use.

An item you cannot decide counts as tripped. A wasted question costs less than a wrong run.

None tripped: go to step 2.

Any tripped: stop before any edit and ask the user, in this shape:

> This needs a full run: <the item, in plain words>. Done in one go, <what could go wrong, in plain words, for example: nobody checks the design between the parts, so the result may not be what you meant>. Pick one: the normal flow (I ask you a few questions, write a spec and a plan, then build), or `repl` (I plan alone, show you a summary, then build without stopping). Or say "quick anyway" to keep going here.

Write it in words a 12-year-old would follow, with no file paths, function names or jargon unless the user used them first.

On the normal flow, invoke `brainstorm` with the intent. On `repl`, invoke `repl` with the intent. On "quick anyway", go to step 2. "Quick anyway" never waives `lazy`'s never-simplify-away list or `decide`'s one-way doors.

## 2. Think it through silently

Invoke `decide`. Then do brainstorm's thinking without the user and without files: trace every file the change touches, form the one challenge to the framing, and pick the laziest approach on `lazy`'s ladder that meets the request. Every question brainstorm would ask, you answer by `decide`.

No spec file, no plan file, no subagents, no decision log.

Print one line and keep going without waiting:

> Reading: <goal>. Smallest change: <change>.

## 3. Build in units

Build one thing a user could see or use at a time, at most 3. After each one, run its check before starting the next. A failed check stops the build at that unit.

## 4. Prove it

Find the one fact the change relies on, and prove it by running something: a test, a script that calls the real code, or the app itself. "It compiles" and "I read it" do not count.

Non-trivial logic leaves one runnable check behind, and you run it.

If nothing can run, say so, and do not claim the work is done.

## 5. Failures

A failed check goes to `debug`, as it always does. Approve its report once its refuter has run, then fix.

After two failed fixes that share an assumption, stop. Name the assumption, say what is done and what was checked, and offer the normal flow.

A `decide` one-way door met mid-build stops the run the same way, naming the door.

A stopped run leaves its unfinished edits in the working tree. Never revert them.

## The close

End with one line, picking the one evidence value that applies:

> Ran: <check> (<result>). Evidence: ran it | reproduced in app | could not run.
````

- [x] Step 2: Run `npm run generate`
- [x] Step 3: Run `npm run check`
- [x] Step 4: Run `npm test`
- [x] Step 5: Commit `feat(quick): default path with size gate`

### Task 3: brainstorm, decide and using-vibekit follow the new default → verify: `npm run check` exits 0, `npm test` exits 0, `grep -c "repl. or .quick" skills/decide/SKILL.md` prints at least 1, and `grep -c "1% chance" skills/using-vibekit/SKILL.md` prints at least 1

**Files:**
- Modify: `skills/brainstorm/SKILL.md:3-4` (frontmatter `description` and `trigger`)
- Modify: `skills/decide/SKILL.md:3-4` (frontmatter `description` and `trigger`)
- Modify: `skills/decide/SKILL.md:11,13,36,57,67`
- Modify: `skills/using-vibekit/SKILL.md:30`
- Regenerate: every file `npm run generate` writes

- [x] Step 1: In `skills/brainstorm/SKILL.md`, replace the `description` and `trigger` lines with:

```
description: "Use when quick's gate trips and the user picks the normal flow, or when vibe or repl hands off an intent. Hard gate, no code before an approved design."
trigger: Escalated by quick, or invoked by vibe or repl
```

- [x] Step 2: In `skills/decide/SKILL.md`, replace the `description` and `trigger` lines with:

```
description: "Loaded by repl or quick: answers every question a skill would put to the user during a run without the user. Settled answers are followed, one-way doors pause, experiments settle what they can, and two-way doors are decided and logged."
trigger: Loaded by repl or quick at the start of its run, never fires on its own
```

- [x] Step 3: In `skills/decide/SKILL.md`, replace `In a \`repl\` run, nobody is there to ask.` with `In a \`repl\` or \`quick\` run, nobody is there to ask.`
- [x] Step 4: In `skills/decide/SKILL.md`, replace the line `This skill applies only inside a \`repl\` run. Outside one, the user decides, as every other skill says.` with:

```
This skill applies only inside a `repl` or `quick` run. Outside one, the user decides, as every other skill says. In `quick`, a pause means stop and ask the user.
```

- [x] Step 5: In `skills/decide/SKILL.md`, append to the bullet that starts `- Skipping, merging or reordering a pipeline step.` the sentence ` This door applies to \`repl\` only. \`quick\` skips spec, plan, exec and verify by design.`
- [x] Step 6: In `skills/decide/SKILL.md`, append to the line that starts `In a brainstorm, every question is a two-way door.` the sentence ` In \`quick\`, the \`Reading:\` line is that review.`
- [x] Step 7: In `skills/decide/SKILL.md`, append to the line that starts `Every answer, settled or decided, is one row` the sentence ` \`quick\` keeps no log.`
- [x] Step 8: In `skills/using-vibekit/SKILL.md`, replace the line `A skill whose row says \`hard\` is a gate. Respect it regardless of how simple the task looks. Simple tasks are where unexamined assumptions cost the most.` with:

```
A skill whose row says `hard` is a gate. Respect it regardless of how simple the task looks. Simple tasks are where unexamined assumptions cost the most. Every implementation request goes through `quick`'s gate, and `brainstorm` is where a request lands when that gate trips.
```

- [x] Step 9: Run `npm run generate`
- [x] Step 10: Run `npm run check`
- [x] Step 11: Run `npm test`
- [x] Step 12: Commit `feat: brainstorm on escalation, decide inside quick`

### Task 4: evals match the new default → verify: the scenario check command in Step 6 exits 0, `npm test` exits 0, and `grep -c "quick-skips-brainstorm\|quick-does-not-auto-fire" evals/scenarios.json` prints 0

**Files:**
- Modify: `evals/scenarios.json` (scenarios `brainstorm-precedes-code`, `quick-skips-brainstorm`, `quick-bails-out`, `quick-does-not-auto-fire`, `quick-discloses`)

- [ ] Step 1: In the `brainstorm-precedes-code` scenario, change `"skill": "vibekit:brainstorm"` to `"skill": "vibekit:quick"`. Keep its id, so its threshold in `evals/thresholds.json` still applies.
- [ ] Step 2: Delete the whole `quick-skips-brainstorm` scenario object.
- [ ] Step 3: Replace the `expect` of `quick-bails-out` with:

```json
{ "skill": "vibekit:quick", "skillAbsent": ["vibekit:brainstorm", "vibekit:repl"], "toolAbsent": ["Write", "Edit", "NotebookEdit"], "finalTextMatches": "normal flow[\\s\\S]*repl" }
```

- [ ] Step 4: Replace the whole `quick-does-not-auto-fire` scenario object with:

```json
  {
    "id": "quick-auto-fires",
    "prompt": "I want to add a dark mode toggle to my website.",
    "expect": { "skill": "vibekit:quick", "skillAbsent": ["vibekit:brainstorm", "vibekit:vibe"] },
    "n": 10,
    "model": "sonnet"
  },
  {
    "id": "quick-gates-big",
    "prompt": "Add a product search bar, a wishlist page, a recently viewed strip, a size guide popup and a share button to my store's product pages.",
    "expect": { "skill": "vibekit:quick", "skillAbsent": ["vibekit:brainstorm", "vibekit:repl"], "toolAbsent": ["Write", "Edit", "NotebookEdit"], "finalTextMatches": "normal flow[\\s\\S]*repl" },
    "n": 10,
    "model": "sonnet"
  },
```

- [ ] Step 5: In `quick-discloses`, change `"finalTextMatches": "Skipped:.*brainstorm.*plan.*exec.*verify"` to `"finalTextMatches": "Ran:.*Evidence:"`.
- [ ] Step 6: Run this scenario check, which throws on invalid JSON or an unknown expectation key:

```sh
node --input-type=module -e "
import { scoreScenario } from './evals/score.mjs'
import fs from 'fs'
const d = JSON.parse(fs.readFileSync('evals/scenarios.json','utf8'))
const run = { ok: true, skills: [], tools: [], usage: { cache_creation_input_tokens: 1, output_tokens: 1 }, cost: 0, contains: () => false, raw: '', finalText: '' }
for (const s of d) scoreScenario(s, [run])
console.log('scored', d.length)
"
```

- [ ] Step 7: Run `npm test`
- [ ] Step 8: Commit `feat(evals): quick default scenarios`
