# debug standalone route: Implementation Plan

**Spec:** docs/specs/2026-10-22-debug-standalone-route-design.md
**Goal:** A failure the user reports directly gets a route to a fix: `debug` writes an approved fix spec for a local diagnosis and hands to `plan`, and sends a structural one to `brainstorm`.
**Architecture:** All behaviour lives in `skills/debug/SKILL.md`: the Route section gains a standalone column, a new section carries the fix spec template, and the report and handoff sections name the new destinations. One eval scenario in `evals/scenarios.json` measures it. No other skill changes.

## Global constraints
- Every edited string obeys `plain`'s rules, which `npm test` checks.
- Generated files are regenerated with `npm run generate`, never hand-edited.
- No change to `plan`, `exec`, `verify` or `quick`.

### Task 1: standalone route and fix spec in debug → verify: `npm run check && npm test && grep -q 'the fix spec below, then' skills/debug/SKILL.md && test "$(grep -c '^## \(Problem\|Goals\|Non-goals\|Constraints\|Approach\|Alternatives considered\|Testing\|Open questions\)$' skills/debug/SKILL.md)" -ge 8`

**Files:**
- Modify: `skills/debug/SKILL.md:75-108`

- [x] Step 1: Replace lines 75 to 100 of `skills/debug/SKILL.md` (from `## 6. Route` through the closing fence of the report block) with the text between the `~~~` markers below. Lines 102 to 105, the `## Repair nothing yourself` section, stay byte for byte as they are.

~~~
## 6. Route

Diagnosis is the product. Someone else fixes it.

Where the failure came from decides where the fix goes. A `not ready` verdict from `verify` or a failed `exec` clause is inside a run: a plan is in flight to take the fix. A failure the user reported is standalone: nothing is in flight, and `exec` and `plan` both refuse to start without an approved spec.

| Route | Inside a run | Standalone |
|---|---|---|
| Local: one function or file, no interface change | `exec` as a new task | the fix spec below, then `plan` |
| Structural: crosses a boundary, changes an interface, needs design | `plan`, as the problem statement for a new plan | `brainstorm`, with the report as its problem statement |
| `unreproducible` | routes nothing, the user decides | routes nothing, the user decides |
| Refuted twice | routes nothing, the user decides | routes nothing, the user decides |

Every routed fix carries a **guard test that fails before the fix and passes after**. Without the pre-fix failure it is not a guard, it is a test that happens to be green, and a check that cannot fail is not a check.

Name the guard test in the route. Do not write it.

## The report

Report in the conversation. Write nothing and commit nothing, with one exception: the fix spec on a standalone local route.

```
Failure:  the command, its exit status, and its output verbatim
Repro:    how you made it fail, and how many times, or why you could not
Isolated: the commit, the hunk, or the conditions
Cause:    one falsifiable claim, with file:line
Refuted:  what the refuter returned, both times if there were two
Guard:    the test the fix must add, and what makes it fail today
Route:    exec | plan | brainstorm | fix spec | user
```

## The fix spec

Only on a standalone local route, and only after the user approves the report. Approving the report as printed is approving the spec, so the spec is written with `status: approved` and gets no draft commit.

Write it to `docs/specs/YYYY-MM-DD-fix-<topic>-design.md` and commit that file alone, on the current branch. Copy every field from the report verbatim. A paraphrased cause is a second cause nobody refuted.

```
---
title: fix <topic>
date: YYYY-MM-DD
status: approved
---

# fix <topic>: Design

## Problem
<the report's Failure, Repro and Isolated lines>

## Goals
1. The guard test named in the report fails at BASE and passes at HEAD.
2. The failing command from Failure exits 0 at HEAD.
3. The full test suite passes at HEAD.

## Non-goals
No behaviour change other than the one the cause names.

## Constraints
No interface change.

## Approach
<the report's Cause and Refuted lines>

## Alternatives considered
N/A: a diagnosis, not a design. The refuter's result is under Approach.

## Testing
<the report's Guard line>

## Open questions
N/A: the report was approved as written.
```

If writing it shows the constraint cannot hold, the route was wrong: it is structural, and goes to `brainstorm` instead.

The spec is the only file this skill ever writes. It holds no fix and no test. Hand off to `plan`.
~~~

- [x] Step 2: Replace the line under `## Handoff` (the last paragraph of the file) with:

```
None of your own. `exec`, `plan` or `brainstorm` takes the route, and `verify` runs again from the top on whatever they produce, on a change it has not seen.
```

- [x] Step 3: Run `npm run generate`
- [x] Step 4: Run `npm run check && npm test`
- [x] Step 5: Commit `skills/debug/SKILL.md` with the message `feat(debug): route a standalone diagnosis to a fix spec or brainstorm`

### Task 2: eval scenario for the standalone route → verify: `node -e "const s=require('./evals/scenarios.json').find(x=>x.id==='debug-standalone-writes-spec');if(!s||s.n!==10||s.expect.skill!=='vibekit:plan'||!s.expect.after.includes('vibekit:debug')||s.expect.fileMatching!=='^docs/specs/.*fix.*-design\\\\.md$')process.exit(1)" && npm test`

**Files:**
- Modify: `evals/scenarios.json:304`

- [ ] Step 1: In `evals/scenarios.json`, directly after the object whose `id` is `debug-dispatches-the-refutation` (it closes at line 304), insert this object, with a comma after the preceding `}`:

```json
  {
    "id": "debug-standalone-writes-spec",
    "prompt": "`npm test` fails. test/parse.test.mjs says: parse('a,b,c') returned ['a','b'], expected ['a','b','c']. Work out what is wrong. If your diagnosis holds, I approve it.",
    "files": {
      "src/parse.mjs": "export const parse = line => line.split(',').slice(0, -1)\n",
      "test/parse.test.mjs": "import assert from 'node:assert'\nimport { parse } from '../src/parse.mjs'\nassert.deepEqual(parse('a,b,c'), ['a', 'b', 'c'])\n"
    },
    "expect": {
      "skill": "vibekit:plan",
      "after": ["vibekit:debug"],
      "fileMatching": "^docs/specs/.*fix.*-design\\.md$"
    },
    "n": 10,
    "model": "sonnet"
  },
```

- [ ] Step 2: Run `npm test`
- [ ] Step 3: Commit `evals/scenarios.json` with the message `test(evals): debug writes a fix spec on a standalone route`
