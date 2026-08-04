# brainstorm Skill Implementation Plan

> **For executing agents:** implement this plan task-by-task. Each step uses checkbox (`- [ ]`) syntax. Do not skip steps. Do not batch commits across tasks.

**Goal:** Author `brainstorm` — the pipeline's entry gate — plus the two modifiers it delegates to, and measure whether extraction costs firing rate.

**Architecture:** Two arms, both authored fresh. Arm A is a self-contained `brainstorm` with the laziness ladder and compression policy written inline; it is committed and tagged as the control. Arm B adds `lazy` and `terse` as separate skills and slims `brainstorm` to reference them — not one behaviour-shaping sentence differs, only location. An eval scenario asserts `brainstorm` fires *before* any file write, and `npm run eval --baseline <tag> --candidate HEAD` measures both arms.

**Tech stack:** Markdown skill files under `skills/`, the vibekit v2 generator (`npm run generate`), the eval harness (`npm run eval`). Zero dependencies.

---

## Premortem

**Hidden assumptions:**
- The plan assumes vibekit's frontmatter parser accepts what these skills declare. Verified directly, not assumed: `description: >` folded YAML is **rejected** (`malformed frontmatter line`), so every description must be a single line. Both caveman and ponytail use folded descriptions upstream, so copying their frontmatter shape verbatim would break the build. Task 1's verify clause runs `npm run check`, which fails loudly on a malformed skill.
- The plan assumes the eval harness reads `evals/scenarios.json` from the **current checkout**, not from each materialised ref — so a scenario added once applies to both arms. Confirmed by reading `evals/run.mjs`: paths resolve through `at()` from the module's own directory, while refs are only ever passed as `--plugin-dir`. If this were wrong, Arm A's ref would lack the scenario and the baseline would report `incomplete` rather than a rate — which the harness surfaces loudly, so a wrong assumption fails visibly rather than silently.
- The plan assumes a sonnet session on "Let's make a react todo list" will reach for a skill at all. That is superpowers' own published acceptance test for exactly this gate, but it is a behavioural claim about a model, not a fact about this repo. Task 6 is where it is tested; a `rate` below 1.0 is information, not necessarily a bug in the skill.

**Irreversible / risky steps:**
- Task 6 spends real money — 5 repeats × 2 arms on sonnet ≈ $1–4.50. Bounded by `n: 5` in the scenario and by the harness refusing to run a plan of zero sessions. The `--dry-run` in Task 5 prints the estimate before anything is spawned.
- Task 4 rewrites `skills/brainstorm/SKILL.md` wholesale. Recoverable: Arm A is tagged before it happens, so `git show brainstorm-arm-a:skills/brainstorm/SKILL.md` restores it exactly.
- `none` beyond those two — every other task creates files under `skills/` or edits `evals/scenarios.json` and `evals/thresholds.json`, and `git revert` restores the tree.

**Spec-misalignment:**
- The spec says Arm A is "self-contained... no modifier references". The plan interprets that as Arm A being committed **before** `lazy` and `terse` exist, so the two refs differ by the real shipping choice — one skill self-contained versus three skills with delegation — rather than by body text alone. The alternative reading (all three skills present in both arms, differing only in `brainstorm`'s body) isolates the variable more tightly but compares two states, one of which nobody would ship. Surfaced because both readings are defensible; the plan picks the shipping comparison.
- The spec's §Testing quotes a scenario expecting skill `vibekit:brainstorm`. The generated plugin namespaces skills by plugin name, so `vibekit:brainstorm` is correct and matches the observed shape from spec 2's probe (`{"skill":"vibekit:example-plain"}`). Task 5 asserts it against a real `init.skills` listing rather than trusting the spelling.
- The spec calls for the description to be "squeezed". The plan fixes an exact string rather than leaving it to judgment, so the always-on saving is measurable rather than aspirational.
- The spec estimates "~245 lines → ~140". Measured against the exact text this plan specifies, it is **197 → 164, a saving of 33**. The spec's starting figure was v1's `brainstorm-lean` length; authoring fresh from the five sources already produced a tighter file, so proportionally less remains to extract. The plan states the measured numbers and does not amend the spec, since that figure was an estimate rather than a requirement — but the discrepancy is surfaced here rather than discovered mid-execution.

**Verify-clause weakness:**
- "the skill file exists" would pass on an empty file. Every authoring task instead asserts `npm run check` passes **and** greps for specific load-bearing strings (the HARD-GATE sentence, the pushback template, the never-compress list).
- Task 4's clause is the one where success and failure could look alike — a "slimmed" file could be slimmed by deleting behaviour rather than by extraction. Tightened: it asserts the extracted blocks are **absent from `brainstorm`** *and* **present in `lazy`/`terse`**, and that a fixed list of behaviour-shaping sentences still appears verbatim in `brainstorm`.
- Task 6 cannot be asserted deterministically — it is a live measurement whose result is the point. Its clause is scoped to what is checkable: a results file exists with a numeric rate for both arms and no `incomplete`.

## File structure

New:
- `skills/brainstorm/SKILL.md` — the entry gate (Arm A in Task 1, rewritten to Arm B in Task 4)
- `skills/lazy/SKILL.md` — the laziness ladder and never-simplify-away list (ponytail)
- `skills/terse/SKILL.md` — the compression policy and auto-clarity override (caveman)

Modified:
- `evals/scenarios.json` — add the `brainstorm-precedes-code` scenario
- `evals/thresholds.json` — pin that scenario at `minFiringRate: 1.0`

Generated (by `npm run generate`, never hand-edited):
- `CLAUDE.md`, `AGENTS.md`, `README.md` trigger-table and skill-list regions
- `.vibekit-manifest`

---

### Task 1: brainstorm, Arm A (self-contained control) → verify: `npm run check` exits 0; `skills/brainstorm/SKILL.md` contains the HARD-GATE sentence, the seven-rung ladder, and the never-compress list; the generated `CLAUDE.md` trigger table shows `brainstorm` with gate `hard`

**Files:**
- Create: `skills/brainstorm/SKILL.md`

This is the control arm. Everything is inline — the ladder and the compression policy are written into the body rather than delegated. Do not create `lazy` or `terse` in this task; their absence is what makes this arm self-contained.

- [x] **Step 1: Write the skill**

Create `skills/brainstorm/SKILL.md` with exactly this content:

````markdown
---
name: brainstorm
description: Use before any creative or implementation work — features, components, behavior changes. Hard gate, no code before an approved design.
trigger: About to start creative or implementation work, before code is written
gate: hard
---

# brainstorm

Turn an idea into a validated design through dialogue, then hand off to `plan`.
No code is written here.

## HARD-GATE

Do NOT write code, scaffold a project, or invoke any implementation skill until
you have presented a design and the user has approved it in writing.

This applies to every project regardless of perceived simplicity. A todo list, a
one-function utility, a config change — all go through this gate. The design can
be three sentences, but it must exist and be approved.

**Anti-pattern:** "this is too simple to need a design." Simple projects are where
unexamined assumptions cause the most wasted work.

## Understand before you shorten

Trace the whole thing first — every file the change touches, the actual flow —
before proposing anything. The ladder below shortens the solution, never the
reading. Laziness that skips comprehension ships a confident wrong fix; it dresses
up as efficiency and is the dangerous kind.

## Procedure

1. Explore context — files, docs, recent commits.
2. Clarifying questions, one at a time.
3. Scope check.
4. Pushback turn.
5. Two or three approaches with a recommendation.
6. Present the design in sections, approval after each.
7. Write the spec doc, commit.
8. Self-review.
9. User review gate.
10. Hand off to `plan`. Terminal.

## Clarifying questions

One at a time. Never batch. Multiple choice when the option space is small,
open-ended when it is wide. Focus on purpose, constraints, success criteria.

Two rules that override the urge to proceed:

- **If multiple interpretations exist, present them — do not pick silently.**
- **If something is unclear, stop. Name what is confusing. Ask.**

## Scope check

Before spending questions on detail: if the request spans multiple independent
subsystems, say so immediately. Do not refine a project that must first be
decomposed.

Decompose into sub-projects with an explicit build order, then brainstorm the
first one. Each sub-project gets its own spec, plan and implementation cycle.

## Pushback turn

Exactly one, before approaches. Required. Challenge the framing if a simpler path
exists — silently accepting the user's framing is a failure mode.

Output verbatim, in this shape:

> **Pushback:** Before I sketch approaches, one challenge — `<one-sentence simpler framing or hidden assumption>`. Is the smaller version what you want, or do you need the larger framing? (If the larger framing is correct, say so and I'll proceed.)

If no simpler framing exists, say so explicitly:

> **Pushback:** No simpler framing — the requirement is already minimal. Proceeding to approaches.

Record the user's response in the spec's Approach section.

## The laziness ladder

Walk it when generating approaches. Stop at the first rung that holds, then prefer
the approach sitting highest:

1. **Does this need to exist at all?** Speculative need means skip it, and say so in one line.
2. **Already in this codebase?** A helper, util, type or pattern that already lives here — reuse it.
3. **Stdlib does it?** Use it.
4. **Native platform feature covers it?** `<input type="date">` over a picker library, CSS over JS, a database constraint over application code.
5. **Already-installed dependency solves it?** Use it. Never add a new one for what a few lines do.
6. **Can it be one line?** One line.
7. **Only then:** the minimum code that works.

**Never simplify away** — not on the ladder, always built: input validation at
trust boundaries, error handling that prevents data loss, security,
accessibility, and anything the user explicitly requested. Lazy means less code,
not a flimsier algorithm or a missing safety check.

## Approaches

Two or three, always, even when one seems obvious. The user decides obviousness.

Full prose, with trade-offs and your recommendation. Lead with the recommendation
and say why.

**At least one approach must sit at the laziest rung that still meets the
requirement**, so the user can choose it.

## Presenting the design

Scale each section to its complexity — a few sentences if straightforward, up to
about 300 words if nuanced. Ask after each section whether it looks right so far.

Cover architecture, components, data flow, error handling, testing.

Break the system into units with one clear purpose each, communicating through
well-defined interfaces. For each unit: what does it do, how do you use it, what
does it depend on? If a unit cannot be understood without reading its internals,
or its internals cannot change without breaking consumers, the boundaries need
work.

In an existing codebase, follow existing patterns. Include targeted improvements
where existing problems affect this work. Do not propose unrelated refactoring.

## Spec document

Write to `docs/specs/YYYY-MM-DD-<topic>-design.md`, then commit. Headings, in
order:

```
---
title: <topic>
date: YYYY-MM-DD
status: draft
---

# <topic> — Design

## Problem
## Goals
## Non-goals
## Constraints
## Approach
## Alternatives considered
## Testing
## Open questions
```

**Each goal states an observable success criterion.** "Make it work" is not a
goal. Strong criteria let downstream skills verify without asking the user.

If a section is genuinely not applicable, write `N/A — <one-line reason>`, never
`TODO`.

## Self-review

Fresh eyes on what you just wrote:

1. **Placeholders.** Any TBD, TODO, or vague requirement? Fix it.
2. **Internal consistency.** Do sections contradict each other?
3. **Scope.** Focused enough for a single implementation plan?
4. **Ambiguity.** Could any requirement be read two ways? Pick one and make it explicit.

Fix inline. No re-review.

## User review gate

Send exactly this, verbatim:

> Spec written and committed to `<path>`. Please review it and let me know if you want to make any changes before we start writing out the implementation plan.

Wait for the response. On requested changes, make them and re-run self-review.

**On approval:** change `status: draft` to `status: approved` in the frontmatter
and commit that single line with the message `spec: approve <topic>`. Downstream
skills gate on it, so this step is not optional.

## Compression policy

Compress assistant narration only. Everything else is verbatim.

**Compress:** transitions between steps, self-narration, restating the user's last
answer before the next question, acknowledgements, prefaces on approach proposals.

**Never compress:** every question asked of the user; the user's answers when
quoted; constraints and success criteria; all approaches with their trade-offs;
the design at every section; the written spec; the user-review-gate message; the
pushback turn; any destructive-operation warning or scope flag.

**Auto-clarity override** — drop compression entirely for security warnings,
irreversible-action confirmations, multi-step sequences where fragment order risks
misreading, and whenever the user asks to clarify or repeats a question. Resume
afterwards.

## Handoff

The only next skill is `plan`. Never invoke a frontend, component, or other
implementation skill from here.
````

- [x] **Step 2: Regenerate**

Run: `npm run generate`
Expected: `wrote` lines for `CLAUDE.md`, `AGENTS.md`, `README.md` and `.vibekit-manifest`, then `done`.

- [x] **Step 3: Verify the generator accepted it**

Run: `npm run check`
Expected: `up to date`, exit 0.

If it instead prints `vibekit: brainstorm: frontmatter ...`, the frontmatter is malformed — most likely a multi-line `description`. The parser accepts only single-line `key: value` pairs.

- [x] **Step 4: Verify the load-bearing content survived**

Run:
```bash
node -e "
const t = require('fs').readFileSync('skills/brainstorm/SKILL.md','utf8');
const must = [
  'Do NOT write code, scaffold a project, or invoke any implementation skill',
  'Does this need to exist at all?',
  'Never simplify away',
  'Never compress',
  'Auto-clarity override',
  'Pushback:',
  'Each goal states an observable success criterion',
  'If something is unclear, stop. Name what is confusing. Ask.',
];
for (const m of must) if (!t.includes(m)) throw new Error('missing: ' + m);
console.log('arm A content ok —', t.split('\n').length, 'lines');
"
```
Expected: `arm A content ok — 197 lines`.

- [x] **Step 5: Verify the trigger table**

Run: `sed -n '/vibekit:generated:trigger-table/,/\/vibekit:generated/p' CLAUDE.md`
Expected: a row reading `| About to start creative or implementation work, before code is written | \`brainstorm\` | hard |`

- [x] **Step 6: Commit and tag the control**

```bash
git add skills/brainstorm CLAUDE.md AGENTS.md README.md .vibekit-manifest
git commit -m "feat(skills): brainstorm, self-contained arm A"
git tag brainstorm-arm-a
```

---

### Task 2: lazy modifier → verify: `npm run check` exits 0; `skills/lazy/SKILL.md` contains all seven ladder rungs and the never-simplify-away list; the trigger table shows `lazy` with gate `none`

**Files:**
- Create: `skills/lazy/SKILL.md`

- [x] **Step 1: Write the skill**

Create `skills/lazy/SKILL.md` with exactly this content:

````markdown
---
name: lazy
description: Governs what you build — the laziness ladder. Default on for all coding work. Stdlib and native features before new code, one line before fifty.
trigger: Any coding work — writing, adding, refactoring, fixing, or designing code
gate: none
---

# lazy

You are a lazy senior developer. Lazy means efficient, not careless. The best code
is the code never written.

## Persistence

Active every response. No drift back to over-building. Still active if unsure.
Off only on "stop lazy" or "normal mode".

## Understand first

The ladder shortens the solution, never the reading. Trace the whole thing first —
every file the change touches, the actual flow — then climb. Laziness that skips
comprehension to ship a small diff is the dangerous kind: it dresses up as
efficiency and ships a confident wrong fix.

## The ladder

Stop at the first rung that holds, then prefer the highest rung that works:

1. **Does this need to exist at all?** Speculative need means skip it, and say so in one line.
2. **Already in this codebase?** A helper, util, type or pattern that already lives here — reuse it. Re-implementing what is a few files over is the most common slop.
3. **Stdlib does it?** Use it.
4. **Native platform feature covers it?** `<input type="date">` over a picker library, CSS over JS, a database constraint over application code.
5. **Already-installed dependency solves it?** Use it. Never add a new one for what a few lines do.
6. **Can it be one line?** One line.
7. **Only then:** the minimum code that works.

## Rules

- No unrequested abstractions: no interface with one implementation, no factory for one product, no config for a value that never changes.
- No scaffolding "for later". Later can scaffold for itself.
- Deletion over addition. Boring over clever — clever is what someone decodes at 3am.
- Fewest files. Shortest working diff, but only once you understand the problem. The smallest change in the wrong place is a second bug.
- **Bug fix means root cause, not symptom.** A report names a symptom. Before editing, check every caller of the function you are about to touch. One guard in the shared function is a smaller diff than a guard in every caller — and patching only the path the ticket names leaves every sibling caller broken.
- Two options the same size? Take the one that is correct on edge cases. Lazy means writing less code, not picking the flimsier algorithm.
- Mark a deliberate shortcut with a known ceiling using a `vibekit:` comment naming the ceiling and the upgrade path, e.g. `// vibekit: global lock, per-account locks if throughput matters`.
- **Lazy code without its check is unfinished.** Non-trivial logic — a branch, a loop, a parser, a money or security path — leaves one runnable check behind: the smallest thing that fails if the logic breaks. Trivial one-liners need no test; YAGNI applies to tests too.

## Never simplify away

Not on the ladder, always built: input validation at trust boundaries, error
handling that prevents data loss, security measures, accessibility basics, and
anything the user explicitly requested.

If the user insists on the full version, build it. Do not re-argue.

## Boundaries

`lazy` governs what you build, not how you talk — pair it with `terse` for prose.
"stop lazy" or "normal mode" reverts.
````

- [x] **Step 2: Regenerate and check**

Run: `npm run generate && npm run check`
Expected: `wrote` lines, `done`, then `up to date`.

- [x] **Step 3: Verify content**

Run:
```bash
node -e "
const t = require('fs').readFileSync('skills/lazy/SKILL.md','utf8');
const must = ['Does this need to exist at all?','Already in this codebase?','Stdlib does it?','Native platform feature covers it?','Already-installed dependency solves it?','Can it be one line?','the minimum code that works','Never simplify away','root cause, not symptom','vibekit:'];
for (const m of must) if (!t.includes(m)) throw new Error('missing: ' + m);
console.log('lazy ok');
"
```
Expected: `lazy ok`

- [x] **Step 4: Commit**

```bash
git add skills/lazy CLAUDE.md AGENTS.md README.md .vibekit-manifest
git commit -m "feat(skills): lazy modifier — the laziness ladder"
```

---

### Task 3: terse modifier → verify: `npm run check` exits 0; `skills/terse/SKILL.md` contains the never-compress list, the auto-clarity override, and the no-invented-abbreviations rule; the trigger table shows `terse` with gate `none`

**Files:**
- Create: `skills/terse/SKILL.md`

- [x] **Step 1: Write the skill**

Create `skills/terse/SKILL.md` with exactly this content:

````markdown
---
name: terse
description: Governs how you talk — compress narration, never artifacts. Default on. Questions, evidence, specs, plans and warnings are always verbatim.
trigger: Every response — compress conversation, never compress artifacts
gate: none
---

# terse

Cut output tokens by compressing narration. All technical substance stays. Only
fluff dies.

## Persistence

Active every response. No filler drift after many turns. Still active if unsure.
Off only on "stop terse" or "normal mode".

## The placement rule

**Compress the conversation. Never the artifacts.**

Narration is consumed once, by a human, in the moment. Artifacts are parsed later
by agents and read later by humans, and a compressed artifact is a silent bug.

### Compress

- Transitions between steps.
- Self-narration — "I'll now check the config" — drop it and check the config.
- Restating the user's last answer before responding to it.
- Acknowledgements: "Great!", "Certainly!", "Happy to help".
- Hedging and filler: just, really, basically, actually, simply.
- Prefaces on lists: "Here are three options I've been considering" becomes "Three options:".
- Tool-call narration. The tool result is the signal.

### Never compress

- Every question asked of the user, and the user's answers when quoted back.
- Constraints, requirements and success criteria.
- Specs, plans, verification reports and reviews — downstream agents parse these verbatim.
- Brief CONSTRAINTS blocks dispatched to subagents.
- Evidence: test output, error messages, diffs, command output and exit codes.
- Code blocks, commit messages and PR bodies.
- Destructive-operation warnings and irreversible-action confirmations.

### Auto-clarity override

Drop compression entirely for:

- Security warnings.
- Irreversible-action confirmations.
- Multi-step sequences where fragment order risks a misread.
- Any passage where compression itself creates ambiguity.
- When the user asks to clarify, or repeats a question.

Resume afterwards.

## What does not save tokens

Measured, not assumed. Do not do these — they cost clarity and save nothing:

- **Invented abbreviations** — `cfg`, `impl`, `req`, `res`, `fn`. The tokenizer splits them the same as the full word: zero tokens saved, and the reader still has to decode. The full word is cheaper *and* clearer.
- **Causal arrows** — `X → Y`. The arrow is its own token.

Standard, widely-known acronyms are fine: DB, API, HTTP.

## Style

Pattern: `[thing] [action] [reason]. [next step].`

Not: "Sure! I'd be happy to help with that. The issue you're experiencing is
likely caused by..."

Yes: "Bug in auth middleware. Token expiry check uses `<` not `<=`. Fix:"

Technical terms, function names, API names, CLI commands and error strings stay
exact. Preserve the user's language — compress the style, not the language.

## Boundaries

`terse` governs how you talk, not what you build — pair it with `lazy` for code
volume. "stop terse" or "normal mode" reverts.
````

- [x] **Step 2: Regenerate and check**

Run: `npm run generate && npm run check`
Expected: `wrote` lines, `done`, then `up to date`.

- [x] **Step 3: Verify content**

Run:
```bash
node -e "
const t = require('fs').readFileSync('skills/terse/SKILL.md','utf8');
const must = ['Compress the conversation. Never the artifacts.','Never compress','Auto-clarity override','Invented abbreviations','Causal arrows','Security warnings'];
for (const m of must) if (!t.includes(m)) throw new Error('missing: ' + m);
console.log('terse ok');
"
```
Expected: `terse ok`

- [x] **Step 4: Commit**

```bash
git add skills/terse CLAUDE.md AGENTS.md README.md .vibekit-manifest
git commit -m "feat(skills): terse modifier — compress conversation, never artifacts"
```

---

### Task 4: brainstorm, Arm B (extracted) → verify: `npm run check` exits 0; `skills/brainstorm/SKILL.md` no longer contains the ladder rungs or the compression policy, still contains every behaviour-shaping sentence, and is at least 30 lines shorter than the Arm A tag

**Files:**
- Modify: `skills/brainstorm/SKILL.md`

Extraction only. Two blocks are removed and replaced by references. **No other sentence changes.** If you find yourself rewording anything outside those two blocks, stop — that is the next experiment, not this one.

- [x] **Step 1: Remove the laziness ladder**

Delete the entire `## The laziness ladder` section — its heading, all seven rungs, and the "Never simplify away" paragraph.

- [x] **Step 2: Remove the compression policy**

Delete the entire `## Compression policy` section — its heading, the Compress list, the Never compress list, and the Auto-clarity override paragraph.

- [x] **Step 3: Add the delegation line**

Immediately after the `# brainstorm` heading's two-line intro, insert:

```markdown
Apply `lazy` (what you build) and `terse` (how you talk) throughout.
```

- [x] **Step 4: Repoint the one ladder reference**

In `## Understand before you shorten`, the sentence currently reads:

```
before proposing anything. The ladder below shortens the solution, never the
```

Change `The ladder below` to `The ladder in `lazy``, so it reads:

```
before proposing anything. The ladder in `lazy` shortens the solution, never the
```

- [x] **Step 5: Regenerate and check**

Run: `npm run generate && npm run check`
Expected: `up to date`. The description and trigger are unchanged, so the trigger table should not move — `npm run generate` may report nothing to write.

- [x] **Step 6: Verify extraction removed the right things and kept the rest**

Run:
```bash
node -e "
const {readFileSync} = require('fs');
const t = readFileSync('skills/brainstorm/SKILL.md','utf8');
const gone = ['## The laziness ladder','Does this need to exist at all?','## Compression policy','Auto-clarity override','Never simplify away'];
for (const g of gone) if (t.includes(g)) throw new Error('should have been extracted: ' + g);
const kept = [
  'Do NOT write code, scaffold a project, or invoke any implementation skill',
  'Pushback:',
  'If something is unclear, stop. Name what is confusing. Ask.',
  'If multiple interpretations exist, present them',
  'Each goal states an observable success criterion',
  'Spec written and committed to',
  'At least one approach must sit at the laziest rung',
  'Apply \`lazy\` (what you build) and \`terse\` (how you talk)',
];
for (const k of kept) if (!t.includes(k)) throw new Error('lost behaviour-shaping text: ' + k);
console.log('arm B ok —', t.split('\n').length, 'lines');
"
```
Expected: `arm B ok — <n> lines`.

- [x] **Step 7: Confirm the size reduction is real**

Run:
```bash
A=$(git show brainstorm-arm-a:skills/brainstorm/SKILL.md | wc -l)
B=$(wc -l < skills/brainstorm/SKILL.md)
echo "arm A: $A lines, arm B: $B lines, saved: $((A-B))"
test $((A-B)) -ge 30 || { echo "FAIL: expected at least 30 lines saved"; exit 1; }
```
Expected: `arm A: 197 lines, arm B: 164 lines, saved: 33`. The extraction was
simulated against the exact Arm A text while this plan was written, so these are
measured figures rather than estimates. The threshold is 30 rather than 33 to
leave room for a trailing-newline difference; a saving materially below 30 means
something other than the two named blocks was removed.

- [x] **Step 8: Commit**

```bash
git add skills/brainstorm CLAUDE.md AGENTS.md README.md .vibekit-manifest
git commit -m "refactor(skills): extract ladder and compression policy out of brainstorm"
```

---

### Task 5: Eval scenario → verify: `npm run eval -- --dry-run` lists `brainstorm-precedes-code` and prints a cost estimate; `evals/thresholds.json` pins it at `minFiringRate: 1.0`; no session is spawned

**Files:**
- Modify: `evals/scenarios.json`
- Modify: `evals/thresholds.json`

- [x] **Step 1: Add the scenario**

Append to the array in `evals/scenarios.json`, after the existing `skill-invocable` entry:

```json
  {
    "id": "brainstorm-precedes-code",
    "prompt": "Let's make a react todo list",
    "expect": { "skill": "vibekit:brainstorm", "before": ["Write", "Edit", "NotebookEdit"] },
    "n": 5,
    "model": "sonnet"
  }
```

The prompt is superpowers' published acceptance test for this gate. The `before` clause is the strong assertion: a skill that fires after the agent has already written the file has failed while still looking like a pass.

- [x] **Step 2: Pin the threshold**

In `evals/thresholds.json`, add to the `scenarios` object:

```json
    "brainstorm-precedes-code": { "minFiringRate": 1 }
```

A hard gate that fires four times in five is not a gate.

- [x] **Step 3: Confirm the skill id is spelled the way the runtime reports it**

Run:
```bash
node -e "
const s = JSON.parse(require('fs').readFileSync('evals/scenarios.json','utf8'));
const sc = s.find(x => x.id === 'brainstorm-precedes-code');
if (!sc) throw new Error('scenario missing');
if (sc.expect.skill !== 'vibekit:brainstorm') throw new Error('wrong skill id: ' + sc.expect.skill);
if (!sc.expect.before.includes('Write')) throw new Error('missing Write in before');
console.log('scenario ok:', JSON.stringify(sc.expect));
"
```
Expected: `scenario ok: {"skill":"vibekit:brainstorm","before":["Write","Edit","NotebookEdit"]}`

The `vibekit:` prefix matches the shape observed in spec 2's live probe, where a real invocation reported `{"skill":"vibekit:example-plain"}`.

- [x] **Step 4: Dry run**

Run: `npm run eval -- --dry-run`
Expected: a first line naming a session count and a cost estimate, a `candidate:` line, one `candidate:<id> xN` line per scenario including `candidate:brainstorm-precedes-code x5`, then `dry run — nothing spawned`. Exit 0. No `claude` process starts.

- [x] **Step 5: Confirm the validator accepts the new threshold key**

Run: `npm run eval -- --dry-run --scenarios brainstorm-precedes-code`
Expected: `5 sessions` and its cost estimate, then `dry run — nothing spawned`. A threshold key naming a scenario that does not exist would have failed here with `thresholds.json names unknown scenario(s)`.

- [x] **Step 6: Commit**

```bash
git add evals/scenarios.json evals/thresholds.json
git commit -m "test(evals): scenario asserting brainstorm fires before any file write"
```

---

### Task 6: Run the A/B → verify: `npm run eval -- --baseline brainstorm-arm-a --candidate HEAD --scenarios brainstorm-precedes-code` exits 0 or 1 and writes a results file containing a numeric `rate` for both `candidate` and `baseline`, with `incomplete: false` on each

**Files:**
- Create: `evals/results/<timestamp>-HEAD.json` (produced by the run, then committed)

This is the only paid step: 5 repeats × 2 arms = 10 sonnet sessions, roughly $1–4.50.

The result is information, not a pass/fail on the work. Report the numbers whatever they are. **Do not adjust the skill, the scenario, or the threshold to make the run come out well** — that would destroy the measurement this whole spec exists to produce.

- [x] **Step 1: Confirm the plan and cost before spending**

Run: `npm run eval -- --baseline brainstorm-arm-a --candidate HEAD --scenarios brainstorm-precedes-code --dry-run`
Expected: `10 sessions` with a cost estimate, `candidate: HEAD`, `baseline: brainstorm-arm-a`, then `dry run — nothing spawned`.

- [x] **Step 2: Run it**

Run: `npm run eval -- --baseline brainstorm-arm-a --candidate HEAD --scenarios brainstorm-precedes-code`
Expected: a plan line, a progress line of ten characters (`.` per successful session, `E` per errored one), a `results: evals/results/<timestamp>-HEAD.json` line, a per-scenario summary, and `PASS` or `FAIL`.

Either verdict is a valid outcome of this task. `FAIL` means the candidate's firing rate fell below 1.0 or regressed against the baseline — which is a finding, not a task failure.

If a scenario reports `incomplete`, the sessions themselves failed rather than the skill. Check `claude` auth and rate limits, then re-run once. Do not lower the threshold.

- [x] **Step 3: Extract both rates**

Run:
```bash
node -e "
const {readdirSync,readFileSync} = require('fs');
const f = readdirSync('evals/results').sort().pop();
const r = JSON.parse(readFileSync('evals/results/'+f,'utf8'));
const c = r.candidate['brainstorm-precedes-code'];
const b = r.baseline && r.baseline['brainstorm-precedes-code'];
if (!b) throw new Error('no baseline block — was --baseline passed?');
if (c.incomplete || b.incomplete) throw new Error('incomplete run — sessions failed, not the skill');
console.log('file:', f);
console.log('arm B (extracted) rate=' + c.rate + ' footprint=' + Math.round(c.inputFootprint) + ' out=' + Math.round(c.outputTokens) + ' errors=' + c.errored);
console.log('arm A (control)   rate=' + b.rate + ' footprint=' + Math.round(b.inputFootprint) + ' out=' + Math.round(b.outputTokens) + ' errors=' + b.errored);
console.log('verdict:', JSON.stringify(r.verdict));
"
```
Expected: two rate lines and a verdict. Record the numbers verbatim in your report.

- [x] **Step 4: Confirm nothing leaked**

Run: `git worktree list && (ls .eval-worktrees 2>/dev/null || echo "(no .eval-worktrees)")`
Expected: no `.eval-worktrees` entry in the worktree list.

- [x] **Step 5: Commit the result**

```bash
git add evals/results
git commit -m "test(evals): A/B result for brainstorm extraction"
```

---

### Task 7: Enforce the no-external-references rule → verify: `tests/no-external-references.test.mjs` passes; deliberately inserting the word `ponytail` into any SKILL.md makes it fail, and removing it makes it pass again

**Files:**
- Create: `tests/no-external-references.test.mjs`

vibekit **absorbs** ideas from the projects in `external/` and never depends on
them. A shipped file naming one implies a dependency the user does not have, and
`external/` is gitignored so the reference could not resolve anyway. Provenance
belongs in specs and plans — which are also shipped, but as documentation of how
the work was done rather than as instructions an agent follows.

The three skills this plan authors were checked and found clean when the plan was
written. This task turns that from a one-time check into an invariant, so the nine
skills still to be authored cannot regress it.

- [x] **Step 1: Write the test**

```js
// tests/no-external-references.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// vibekit absorbs ideas from the projects in external/; it never depends on them.
// Naming one in a shipped file implies a dependency the user does not have, and
// external/ is gitignored so the reference could never resolve.
const BORROWED_FROM = ['caveman', 'ponytail', 'superpowers', 'karpathy', 'prompt-engineering-guide']

function shippedFiles() {
  const skills = readdirSync('skills', { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
    .map(entry => join('skills', entry.name, 'SKILL.md'))
  return [...skills, 'README.md', 'CLAUDE.md', 'AGENTS.md']
}

test('no shipped file names a project vibekit only borrows from', () => {
  for (const path of shippedFiles()) {
    const text = readFileSync(path, 'utf8').toLowerCase()
    for (const name of BORROWED_FROM) {
      assert.ok(
        !text.includes(name),
        `${path} references '${name}' — vibekit absorbs, it does not depend`,
      )
    }
  }
})

test('the guard actually covers every skill directory', () => {
  const covered = shippedFiles().filter(p => p.startsWith('skills/'))
  const actual = readdirSync('skills', { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
  assert.equal(covered.length, actual.length)
  assert.ok(actual.length > 0, 'no skills found — the guard would pass vacuously')
})
```

The second test exists because the first passes vacuously if `shippedFiles()`
ever returns nothing.

- [x] **Step 2: Run it**

Run: `node --test tests/no-external-references.test.mjs`
Expected: PASS — `pass 2`, `fail 0`.

- [x] **Step 3: Prove the guard actually catches a violation**

A test that has never failed is not known to work. Insert a violation, confirm it
fails, then remove it:

```bash
cp skills/terse/SKILL.md /tmp/terse-backup.md
printf '\nBorrowed from ponytail.\n' >> skills/terse/SKILL.md
node --test tests/no-external-references.test.mjs 2>&1 | tail -5
cp /tmp/terse-backup.md skills/terse/SKILL.md
rm /tmp/terse-backup.md
```
Expected: the middle run FAILS with a message containing `skills/terse/SKILL.md references 'ponytail'`. After the restore, `git status --porcelain` must be empty.

- [x] **Step 4: Confirm the tree is restored and everything passes**

Run: `git status --porcelain && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)" && npm run check`
Expected: no output from `git status`, `fail 0` from the suite, and `up to date` from the check.

- [x] **Step 5: Commit**

```bash
git add tests/no-external-references.test.mjs
git commit -m "test: vibekit absorbs from external/, never references it"
```

---

### Task 8: Remove the surviving duplication → verify: `npm run check` exits 0; with whitespace normalised, `skills/brainstorm/SKILL.md` no longer contains "dresses up as efficiency" while `skills/lazy/SKILL.md` still does; `brainstorm` is 162 lines by `wc -l`, down from 163
<!-- Verify clause corrected 2026-08-04 during execution. It originally demanded the file be "at least 4 lines shorter" and checked the phrase as a contiguous substring. Both were unsatisfiable by construction: the replacement text this task mandates verbatim is 3 prose lines replacing 4, so the maximum possible saving is 1 line; and in skills/lazy/SKILL.md the phrase is line-wrapped as "it dresses up as\nefficiency", so a literal includes() can never match. The implementer reported both rather than deleting extra text to hit the number — which is the correct behaviour and the reason the clause, not the work, is what changed. -->

**Files:**
- Modify: `skills/brainstorm/SKILL.md`

Closes review findings W1 and N1. The extraction in Task 4 moved the ladder and
the compression policy but left a third duplicated block behind: `brainstorm`'s
`## Understand before you shorten` restates `lazy`'s `## Understand first` almost
claim for claim. Both were authored independently in Tasks 1 and 2, and Task 4's
scope did not include this paragraph, so nothing caught it.

N1 rides along: `rung` is used at the "At least one approach" line but defined only
in `lazy`, so the replacement text names the ladder's owner explicitly.

- [x] **Step 1: Replace the duplicated section**

In `skills/brainstorm/SKILL.md`, replace the whole `## Understand before you shorten` section — heading and its four-line paragraph — with:

```markdown
## Understand before you shorten

Trace the whole thing first — every file the change touches, the actual flow —
before proposing anything. `lazy` governs how short the solution gets; it never
shortens the reading.
```

The claims about confident wrong fixes and efficiency-in-disguise are not deleted
from the system — they live in `lazy`, which this skill already delegates to at
the top.

- [x] **Step 2: Name the ladder's owner where the term is used**

Find the line reading:

```
**At least one approach must sit at the laziest rung that still meets the
```

Replace that sentence's opening so the term is anchored. The full sentence becomes:

```markdown
**At least one approach must sit at the laziest rung of `lazy`'s ladder that still
meets the requirement**, so the user can choose it.
```

- [x] **Step 3: Regenerate and check**

Run: `npm run generate && npm run check`
Expected: `up to date`. The description and trigger are unchanged, so the trigger table does not move and `generate` may report nothing to write.

- [x] **Step 4: Verify the duplication is gone and the content still exists elsewhere**

Run:
```bash
node -e "
const {readFileSync} = require('fs');
const b = readFileSync('skills/brainstorm/SKILL.md','utf8');
const l = readFileSync('skills/lazy/SKILL.md','utf8');
if (b.replace(/\\s+/g,' ').includes('dresses up as efficiency')) throw new Error('duplication still in brainstorm');
if (!l.replace(/\\s+/g,' ').includes('dresses up as efficiency')) throw new Error('claim lost from lazy');
if (!b.includes(\"laziest rung of \`lazy\`'s ladder\")) throw new Error('rung not anchored');
if (!b.includes('Trace the whole thing first')) throw new Error('understand-first guard lost');
console.log('dedup ok —', b.split('\n').length, 'lines');
"
```
Expected: `dedup ok — 163 lines` (that count is `split('\n').length`, one more than `wc -l`, which reports 162 — down from 163).

- [x] **Step 5: Run the suite**

Run: `npm test`
Expected: `fail 0`.

- [x] **Step 6: Commit**

```bash
git add skills/brainstorm/SKILL.md
git commit -m "refactor(skills): drop the paragraph brainstorm duplicated from lazy"
```

---

### Task 9: Refresh the bootstrap → verify: `npm run check` exits 0; `skills/using-vibekit/SKILL.md` no longer contains the word "Stub", contains the 1% rule and the instruction-priority order, and names no individual skill

**Files:**
- Modify: `skills/using-vibekit/SKILL.md`

Closes review finding W2. This is the document the SessionStart hook injects into
**every** session, and it still described the plugin as an empty stub after three
real skills landed.

It is deliberately written to avoid naming individual skills. The trigger table in
`CLAUDE.md` is generated from skill frontmatter and is therefore never stale;
restating any of it here would create exactly the drift the generator exists to
prevent. This file is also always-on, so length is the budget.

- [x] **Step 1: Rewrite the skill**

Replace the entire contents of `skills/using-vibekit/SKILL.md` with:

````markdown
---
name: using-vibekit
description: Use when starting any conversation — establishes the auto-trigger discipline so guardrail skills fire instead of being silently skipped.
trigger: Session start
gate: none
---

# using-vibekit

If there is even a 1% chance a vibekit skill applies to what you are about to do,
invoke it.

This is not negotiable. "The task is too small", "I already know the answer" and
"it would be faster to just do it" are the rationalisations this plugin exists to
stop. A guardrail you talked yourself out of is a guardrail that was never there.

If a skill turns out to be wrong for the situation, you do not have to follow it —
but you do have to check.

## If you are a subagent

If you were dispatched to execute a specific task, skip this and follow your
brief. The orchestration discipline belongs to the session that dispatched you.

## Instruction priority

1. **The user's explicit instructions** — highest. If they say "skip the design step", skip it.
2. **vibekit skills** — these override default behaviour where they conflict.
3. **The default system prompt** — lowest.

## Finding the right skill

Every skill declares its own trigger, and the auto-trigger table in `CLAUDE.md` is
generated from those declarations — so it is never out of date. Read the table,
not a copy of it.

A skill whose row says `hard` is a gate. Respect it regardless of how simple the
task looks; simple tasks are where unexamined assumptions cost the most.

## Always on

Two skills are modifiers rather than steps: one governs what you build, the other
governs how you talk. Both are on by default and both say so in their own
descriptions. Apply them throughout rather than invoking them at a moment.

## How to invoke

Use the `Skill` tool. The skill's content loads and you follow it directly. Never
read a skill file as a substitute for invoking it — reading gives you the text
without the commitment.
````

- [x] **Step 2: Regenerate and check**

Run: `npm run generate && npm run check`
Expected: `wrote` lines for the generated docs (the description changed, so the skill-list region moves), then `up to date`.

- [x] **Step 3: Verify content**

Run:
```bash
node -e "
const t = require('fs').readFileSync('skills/using-vibekit/SKILL.md','utf8');
if (t.includes('Stub')) throw new Error('still describes itself as a stub');
for (const m of ['1% chance','Instruction priority','generated from those declarations','Skill\` tool']) {
  if (!t.includes(m)) throw new Error('missing: ' + m);
}
for (const skill of ['brainstorm','lazy','terse','example-command','example-plain']) {
  if (t.includes(skill)) throw new Error('names an individual skill: ' + skill + ' — the table is generated, do not restate it');
}
console.log('bootstrap ok —', t.split('\n').length, 'lines');
"
```
Expected: `bootstrap ok — <n> lines`.

- [x] **Step 4: Confirm the hook still emits parseable JSON carrying the new text**

Run: `npm run check:hook`
Expected: `ℹ pass 3`, `ℹ fail 0`. This test asserts the SessionStart hook's output parses as JSON and contains the bootstrap body, so a malformed rewrite would fail here.

- [x] **Step 5: Run the suite**

Run: `npm test`
Expected: `fail 0`.

- [x] **Step 6: Commit**

```bash
git add skills/using-vibekit/SKILL.md CLAUDE.md AGENTS.md README.md
git commit -m "feat(skills): bootstrap describes the discipline, not an empty stub"
```

---

### Task 10: De-tautologise the coverage assertion → verify: `node --test tests/no-external-references.test.mjs` reports `pass 2`; deleting the `README.md` entry from `shippedFiles()` makes the coverage test fail

**Files:**
- Modify: `tests/no-external-references.test.mjs`

Closes review finding N2. The second test's `assert.equal(covered.length, actual.length)`
compares two values derived from the same `readdirSync` and the same filter, so it
can never fail. It was written to stop the first test passing vacuously on an empty
file list; that guarantee currently rests entirely on the `assert.ok(actual.length > 0)`
beside it.

- [x] **Step 1: Replace the second test**

Replace the whole `test('the guard actually covers every skill directory', ...)` block with:

```js
test('the guard covers every skill plus all three generated docs', () => {
  const files = shippedFiles()
  const skillDirs = readdirSync('skills', { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))

  // Without this the first test passes vacuously on an empty list.
  assert.ok(skillDirs.length > 0, 'no skills found — the guard would pass vacuously')

  // Anchored on a file that must exist, so the assertion is not derived purely
  // from the same readdirSync the implementation uses.
  assert.ok(files.includes('skills/brainstorm/SKILL.md'), 'a known skill must be covered')

  for (const doc of ['README.md', 'CLAUDE.md', 'AGENTS.md']) {
    assert.ok(files.includes(doc), `${doc} must be covered`)
  }

  assert.equal(files.length, skillDirs.length + 3, 'every skill plus exactly three docs')
})
```

- [x] **Step 2: Run it**

Run: `node --test tests/no-external-references.test.mjs`
Expected: PASS — `pass 2`, `fail 0`.

- [x] **Step 3: Prove the new assertion can actually fail**

A test that has never failed is not known to work. Temporarily drop a doc from the
covered list, confirm the failure, then restore:

```bash
cp tests/no-external-references.test.mjs /tmp/guard-backup.mjs
sed -i "s/return \[...skills, 'README.md', 'CLAUDE.md', 'AGENTS.md'\]/return [...skills, 'CLAUDE.md', 'AGENTS.md']/" tests/no-external-references.test.mjs
node --test tests/no-external-references.test.mjs 2>&1 | grep -E "README.md must be covered|^ℹ (pass|fail)"
cp /tmp/guard-backup.mjs tests/no-external-references.test.mjs
rm /tmp/guard-backup.mjs
```
Expected: the middle run reports `fail 1` and a message containing `README.md must be covered`. After the restore, `git diff --stat tests/no-external-references.test.mjs` shows the file matches what Step 1 wrote.

- [x] **Step 4: Run the suite**

Run: `npm test && npm run check`
Expected: `fail 0`, then `up to date`.

- [x] **Step 5: Commit**

```bash
git add tests/no-external-references.test.mjs
git commit -m "test: make the coverage assertion capable of failing"
```

---

### Task 11: Re-measure with a judge and a delegation scenario → verify: `npm run eval -- --baseline brainstorm-arm-a --candidate HEAD --judge --scenarios brainstorm-precedes-code,lazy-reachable` writes a results file where both arms report `incomplete: false`, `brainstorm-precedes-code` carries a non-null `judge` block, and `lazy-reachable` has a numeric rate

**Files:**
- Modify: `evals/scenarios.json`
- Modify: `evals/thresholds.json`
- Create: `evals/results/<timestamp>-HEAD.json` (produced by the run, then committed)

Closes review finding W4. **W3 is deliberately NOT fixed** — see below.

**W3, accepted rather than closed.** The first run used `n: 5`, and at that sample
size a true rate of 0.85 still shows 5/5 about 44% of the time, so the comparison
is not tightly bounded. Raising `n` to 10 would narrow the interval without
changing the finding, at roughly double the cost. The maintainer chose to record
the limitation instead: **the honest claim is "no regression detected at n=5", not
"provably identical"**, and that wording belongs in the verification and review
documents. `n` stays at 5.

**W4** — the first run proved `brainstorm` *fires*. It could not prove the
delegation still carries behaviour, because firing happens at the start of a
session, before the ladder or the compression policy would ever apply. A run that
invoked `brainstorm`, ignored the delegation line and never loaded `lazy` would
have scored exactly 1.00. Two additions close this: a scenario asserting `lazy` is
reachable at all, and `--judge`, which grades whether a skill was *followed*
rather than merely invoked.

**This is a paid step.** 5 repeats × 2 scenarios × 2 arms = 20 sessions, plus 20
judge calls — roughly $2.40-$10.80. The dry run in Step 3 prints the estimate
before anything spawns.

The result is information. **Do not adjust any skill, scenario or threshold to make
it come out well** — that would destroy the measurement.

- [ ] **Step 1: Add the delegation scenario**

Leave `brainstorm-precedes-code`'s `"n": 5` unchanged. In `evals/scenarios.json`, append this scenario after it:

```json
  {
    "id": "lazy-reachable",
    "prompt": "Add a function that returns the number of days between two dates.",
    "expect": { "skill": "vibekit:lazy" },
    "n": 5,
    "model": "sonnet"
  }
```

This asserts the modifier is discoverable and invocable in a coding session. It
does not prove `brainstorm`'s delegation line specifically caused it — `lazy` has
its own trigger — but a rate near zero would prove the modifier is unreachable,
which is the failure mode W4 identifies.

- [ ] **Step 2: Add its threshold**

In `evals/thresholds.json`, add to the `scenarios` object:

```json
    "lazy-reachable": { "minFiringRate": 0.5 }
```

Deliberately looser than `brainstorm`'s 1.0. `lazy` is `gate: none` — a modifier,
not a hard gate — so demanding perfect invocation would be asserting something the
design never claimed.

- [ ] **Step 3: Confirm the plan and cost before spending**

Run: `npm run eval -- --baseline brainstorm-arm-a --candidate HEAD --judge --scenarios brainstorm-precedes-code,lazy-reachable --dry-run`
Expected: `20 sessions + 20 judge calls` with a cost estimate, `candidate: HEAD`, `baseline: brainstorm-arm-a`, per-scenario counts of x5 each, then `dry run — nothing spawned`.

**Report this estimate and STOP if it exceeds $15.** Return a `needs_input` result
naming the figure rather than spending it.

- [ ] **Step 4: Run it**

Run: `npm run eval -- --baseline brainstorm-arm-a --candidate HEAD --judge --scenarios brainstorm-precedes-code,lazy-reachable`
Expected: a plan line, a progress line, a `results:` path, a per-scenario summary now including `followed=` and `score=` segments, and `PASS` or `FAIL`.

Either verdict is a valid outcome. If a scenario reports `incomplete`, the sessions
failed rather than the skills — check auth and rate limits, re-run once, and do not
lower a threshold.

- [ ] **Step 5: Extract the numbers**

Run:
```bash
node -e "
const {readdirSync,readFileSync} = require('fs');
const f = readdirSync('evals/results').sort().pop();
const r = JSON.parse(readFileSync('evals/results/'+f,'utf8'));
console.log('file:', f);
for (const id of ['brainstorm-precedes-code','lazy-reachable']) {
  const c = r.candidate[id], b = r.baseline && r.baseline[id];
  if (!c) { console.log(id + ': absent from candidate'); continue }
  const j = v => v && v.judge ? ' followed=' + v.judge.followedRate.toFixed(2) + ' score=' + v.judge.meanScore.toFixed(1) + ' judgeErrors=' + v.judge.errors : ' judge=null';
  console.log(id + ' B rate=' + c.rate + ' n=' + c.successful + ' errors=' + c.errored + j(c));
  if (b) console.log(id + ' A rate=' + b.rate + ' n=' + b.successful + ' errors=' + b.errored + j(b));
}
console.log('verdict:', JSON.stringify(r.verdict));
"
```
Expected: two lines per scenario with numeric rates, and a `followed=`/`score=` segment on at least `brainstorm-precedes-code`. Record every figure verbatim.

- [ ] **Step 6: Confirm nothing leaked**

Run: `git status --porcelain && git worktree list`
Expected: `evals/results/` as the only new path, and no `.eval-worktrees` entry.

- [ ] **Step 7: Commit**

```bash
git add evals/scenarios.json evals/thresholds.json evals/results
git commit -m "test(evals): re-measure at n=10 with a judge and a delegation scenario"
```
