---
title: plain typography skill
date: 2026-08-22
status: approved
---

# plain: Design

Heading deviates from brainstorm's `# <topic> — Design` template, which contains an em dash. Nothing parses that heading (only `skills/brainstorm/SKILL.md:130` contains it), and step 2 of this plan cleans that line anyway.

## Problem

Em dashes appear in the artifacts this repo produces. Measured across the last 15 pull requests, 13 of 15 bodies contain them, ranging from 0 to 19 per body.

The repo already bans them. `skills/terse/SKILL.md:98` states "No em dash." The repo also already measured that ban: `evals/scenarios.json:239-247` runs scenario `terse-omits-em-dash` at n=10, instructing the session to invoke `terse` and follow it exactly, then asserting `finalTextOmits: "—"`. Result is `"rate": 0` in both `evals/results/2026-08-11T15-18-28-057Z-HEAD.json` and `evals/results/2026-08-11T16-09-14-732Z-HEAD.json`. Ten failures out of ten, twice.

Two hypotheses for that zero were formed and both were refuted by read-only subagents:

1. **Scope.** The ban is nested under `## Shaping` and bounded by `## Boundaries` ("How you talk, not what you build"), so it never reaches artifacts. Refuted: the rule fails inside narration, where it indisputably applies. Also refuted on detail, since `skills/terse/SKILL.md:43` exempts PR bodies from compression, not from typography.
2. **Wrong layer.** Prose instructions cannot override token-level lexical defaults, so only a post-generation grep can work. Refuted decisively by the neighbouring bullet: `terse-omits-throat-clearing` at `evals/scenarios.json:250-253` uses the same prompt text, the same skill, and the same scorer path, and measures 1.00 across 20 sessions. High-frequency opener tokens are suppressed by a prose bullet one line below the em dash ban. Also refuted on feasibility, since `hooks/hooks.json` registers only `SessionStart` and no post-generation hook exists to host the remedy.

What survived both refutations is a single untried intervention. `skills/terse/SKILL.md` bans the em dash once at line 98 and then demonstrates it 13 times, including at line 106 inside the same `### Tells` list and at line 3 in the frontmatter that loads into context at trigger time. Repo-wide the count is 119. `docs/specs/2026-08-12-terse-shaping-rules-design.md:66` lists rewriting vibekit's own prose to obey these rules as an explicit non-goal, "considered and set aside during design". So the hypothesis that in-context counter-examples outweigh a stated rule has never been tested.

Separately, two of the three typography rules the user asked for do not exist anywhere in vibekit. There is no semicolon rule and no line-wrapping rule, so cleanup alone cannot deliver them.

## Goals

1. A new always-on skill `skills/plain/SKILL.md` exists, stating three typography rules, with `trigger` and `gate: none` frontmatter and a row in the generated trigger table. Observable: `npm run check` exits 0, and the auto-trigger table in `CLAUDE.md` contains exactly one row naming `plain`.
2. Scenario `plain-reachable` measures the skill firing at n=10. Observable: the scenario exists in `evals/scenarios.json` and a results file records a rate for it.
3. A new `producedFilesOmit` expectation asserts on the content of files a session wrote. Observable: `npm test` passes with new tests in `tests/eval-score.test.mjs` covering the present, absent, and array forms, and `KNOWN_EXPECTATIONS` in `evals/score.mjs` contains the key.
4. Zero em dashes and zero prose semicolons remain in source files, excluding the verbatim exceptions listed under Constraints. Observable: `git ls-files -z | xargs -0 grep -l '—'` returns only `evals/scenarios.json`.
5. No paragraph in `skills/*/SKILL.md` is hard wrapped. Observable: no two consecutive non-empty prose lines in those files both fall in the 60 to 85 character band, counting only prose. Table rows, fenced code blocks, and indented blocks are excluded from the check, since their line breaks are structural rather than column wrapping.
6. Measurement M1 is recorded before any `plain` rule text is written. Observable: a results file exists whose candidate is the cleanup commit and whose baseline is `fb7d43c`, containing a rate for `terse-omits-em-dash`.
7. Measurement M2 is recorded. Observable: a results file exists whose candidate is the `plain` commit and whose baseline is the cleanup commit.
8. No firing regression. Observable: at M1 and M2, `brainstorm-precedes-code` holds at its `minFiringRate: 1` threshold and every `*-reachable` scenario meets its threshold in `evals/thresholds.json`.

## Non-goals

- Slop and ADHD output shaping. Those live in `terse`, are measured, and are shipped. Duplicating them would create two always-on skills that can disagree about the same output.
- Any **semantic** change to `terse`'s placement rule or `## Boundaries`. `plain` gets its own boundary line instead. Punctuation inside those sections does change, because goal 4 applies to every source file and `terse` is not exempt from the rule it used to state. Corrected on 2026-08-22 after verify found this non-goal contradicting goal 4.
- Reference files, a scoring table, or a phrase list in the `stop-slop` style. The three rules are mechanical and greppable, which is the entire reason they are separable from `terse`.
- A post-generation hook. `hooks/hooks.json` registers only `SessionStart`, and the second refuter confirmed no hook event can see assistant output.
- Re-anchoring `terse-omits-em-dash` to make it easier to pass. Editing the probe to move the number is editing the gate to pass the gate.
- Semicolons in `.mjs` source. Those are syntax, not prose.

## Constraints

- Generated files are never hand-edited. `.vibekit-manifest` lists them: `README.md`, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `commands/*`, `package.json`, `hooks/hooks.json`, and the plugin manifests. All 24 em dashes across `README.md`, `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md` sit inside `<!-- vibekit:generated:skill-list -->` regions and derive from skill `description:` frontmatter, so they clear via `npm run generate`.
- **Verbatim exception, kept deliberately.** `evals/scenarios.json:243` holds `"finalTextOmits": "—"`. That em dash is the probe. Removing it deletes the measurement.
- `tests/terse.test.mjs:42-44` pins `terse`'s `description` and `trigger` by value. Its own comment states why: those strings drive firing and five scenarios measure it. Cleaning that frontmatter forces the test to change in the same commit, and this is the highest-risk edit in the cleanup.
- Skills contain templates required to be reproduced word for word, including brainstorm's pushback line at `skills/brainstorm/SKILL.md:84` and its spec heading template at line 130. **These are cleaned, not exempted.** The verbatim exception in `plain` governs the runtime obligation, that a session told to output text word for word must do so including banned characters. It does not protect vibekit's own templates from being rewritten, since those are ours to change. After cleaning, reproducing them verbatim emits no em dash and the two rules stop competing. What the exception does mean in practice is that the cleanup cannot be a tree-wide find and replace, because a template quoted inside a skill and a template quoted inside an eval fixture need different decisions.
- `.gitignore:4` ignores `/docs`, so this spec cannot be committed. `.gitignore:5` ignores `/evals/results`, so measurement outputs are local only and must be quoted into the verification report rather than linked.
- In code comments, rule 3 defers to the project linter. A formatter that reflows comments wins, and the skill says so, to avoid generating an unwinnable fight on every save.
- n is 10 minimum for every new scenario. n=5 was measured moving from 0.80 to 0.40 with no code change.
- No preset thresholds. All new scenarios inherit the 0.8 default from `evals/thresholds.json`.

## Approach

A third always-on modifier, `skills/plain/SKILL.md`, beside `terse` and `lazy`. Its boundary line is "How text is typed, not how much of it there is", pairing with terse's "How you talk, not what you build" and lazy's "What you build, not how you talk".

It carries three rules. No em dash. No semicolon. No hard wrapping inside a paragraph. Scope is every string the session emits, artifacts included, with an explicit exception for text a skill requires reproduced verbatim.

The repo cleanup is task 2 of the plan rather than a follow-up, because it is the mechanism the diagnosis points at, not hygiene. Shipping a typography skill into a repo that violates it 119 times reproduces the exact failure this spec documents.

Build order, each step its own commit:

1. `producedFilesOmit` expectation plus tests. No skill changes.
2. Em dash and semicolon removal from skill prose and the ten eval fixture spec documents, including the `tests/terse.test.mjs` frontmatter pins.
3. Unwrapping `skills/*/SKILL.md`.
4. **M1 measurement gate.**
5. `skills/plain/SKILL.md`, `npm run generate`, and four new scenarios.
6. **M2 measurement gate.**

Steps 2 and 3 stay separate. Step 3 rewrites roughly 1171 lines, and mixed together the frontmatter edits that drive firing become invisible inside that diff. Step 3 is reviewed by comparing rendered output rather than by reading the diff line by line, and `git blame --ignore-rev` covers the flattened history. Precedent for the convention is commit d2d31a4, which unwrapped `README.md`.

The eval fixtures at `evals/scenarios.json` lines 48, 58, 73, 90, 101, 116, 129, 157, 172, and 187 are cleaned along with everything else. They are inputs simulating a user's repo rather than vibekit's voice, but they sit in the context window of the sessions measuring the cleanup, which is the mechanism under test. Leaving them dirty could mask the effect.

**What M1 decides.** If the rate moves off 0, counter-examples were the mechanism and `plain` ships with an em dash rule known to bind. If it stays at 0, `plain` still ships, because goals 1 through 3 are independent of that result and two of the three rules exist nowhere today. In that case the em dash rule ships known inert, recorded here and in memory, and not in the skill. `tests/terse.test.mjs:31-35` sets that precedent: state the rule, keep the null result out of the skill, because a skill that undermines its own rule in the same breath is worse than one that omits it.

## Alternatives considered

**A typography section inside `terse`.** Cheaper by one skill and one scenario. Rejected because `terse`'s central sentence is "Compress the conversation. Never the artifacts" and its boundary is "How you talk, not what you build". Rules that must reach code comments and PR bodies cannot live under either without rewriting both, and that also breaks the deliberate symmetry between `terse` and `lazy`.

**Cleanup only, with no new skill.** The laziest option and the honest experiment. Rejected as a standalone because it delivers nothing for semicolons or line wrapping, which are stated nowhere. It survives as step 2 and gate 4 of this plan, which is where its value actually is.

**A post-generation grep and rewrite.** Proposed as root cause 2 and refuted. `hooks/hooks.json` registers only `SessionStart`, and grep for `Stop`, `PostToolUse`, and `UserPromptSubmit` across `hooks/`, `runtimes/`, `lib/`, and `bin/` returns nothing. There is no layer to put it in.

**Pushback response.** The user was challenged on whether a third always-on skill was needed given that `terse` already contains the ADHD ruleset and the slop tells. They chose the larger framing after the evidence showed both options were prose and that the untried variable was counter-examples rather than rule placement.

## Testing

Existing suites gate every step: `npm test`, `npm run check`, and a clean `git status --porcelain`.

New unit tests in `tests/eval-score.test.mjs` cover `producedFilesOmit` in the present, absent, and array forms, mirroring the `skillAbsent` tests added in PR #33.

Four new scenarios in `evals/scenarios.json`, all `n: 10`, all inheriting the 0.8 default:

| id | asserts |
|---|---|
| `plain-reachable` | the skill fires, mirroring `terse-reachable` |
| `plain-omits-em-dash-in-artifact` | `producedFilesOmit` over a file the session wrote |
| `plain-omits-semicolon` | `finalTextOmits` on prose, with a prompt that discourages fenced code so a `.mjs` semicolon cannot fail the check |
| `terse-omits-em-dash-short` | the Lead B diagnostic: same rule, two sentences instead of four paragraphs |

`terse-omits-em-dash` is left exactly as written and is the primary measurement at M1.

The Lead B diagnostic tests a distinct claim, that the em dash check is harder than its neighbour because `finalTextOmits: "—"` is unanchored across four paragraphs while `terse-omits-throat-clearing` is anchored with `^` and can only fail at position zero. If the short-output rate is high while the long-output rate stays at 0, opportunity count is the driver, and that changes how every future lexical rule in this repo is measured.

Rule 3 has no clean regex. The predicate is: no two consecutive non-empty prose lines both fall in the 60 to 85 character band. It catches column-wrapped paragraphs and passes short list items and headings, with known false positives on tables. If it proves too noisy, rule 3 ships measured only by the repo cleanup, stated plainly rather than papered over.

## Open questions

1. Does M1 move `terse-omits-em-dash` off 0.00? This is the point of the plan and cannot be answered before step 4 runs.
2. Is the rule 3 predicate usable, or does table noise make it unreportable? Answered when step 5's scenario first runs.
3. Should `plain`'s own `description:` line, which will be the only skill description in the repo without an em dash, be treated as a firing risk worth its own A/B? Currently folded into goal 8 rather than measured separately.
