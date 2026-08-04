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
