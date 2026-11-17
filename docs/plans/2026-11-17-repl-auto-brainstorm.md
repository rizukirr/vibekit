# repl auto brainstorm: Implementation Plan

**Spec:** docs/specs/2026-11-15-repl-auto-brainstorm-design.md
**Goal:** `repl` brainstorms and plans without the user, prints a plain summary and waits for a go, then builds unattended.
**Architecture:** `skills/repl/SKILL.md` gets new opening sections: start (decide and the log), brainstorm without the user, set up on a `repl-run/<topic>` branch, and plan plus summary. Its later sections keep their text and shift by one number. `skills/decide/SKILL.md` gains a two-way door line for brainstorm questions and a clause on the product-direction bullet. `evals/scenarios.json` gains one scenario and updates one prompt.

## Global constraints
- Every edited string obeys `plain`'s rules, which `npm test` checks.
- Generated files are regenerated with `npm run generate`, never hand-edited.
- No shipped file names an outside source, as `tests/no-external-references.test.mjs` requires, except the README's `## Credits` section.

### Task 1: repl brainstorms without the user → verify: `npm run check` exits 0, `npm test` exits 0, `grep -q 'repl/<topic>' skills/repl/SKILL.md` exits 1, and `grep -c 'repl-run/<topic>\|Asked: <question>\|How we.ll know it works:\|Reply "go" to start building\|Run limits: at most 3 verify rounds, at most \$0 on paid runs' skills/repl/SKILL.md` prints at least 5

**Files:**
- Modify: `skills/repl/SKILL.md:3` (description)
- Modify: `skills/repl/SKILL.md:11-35` (intro and sections 1 to 3)
- Modify: `skills/repl/SKILL.md` headings `## 4. The pipeline` through `## 8. Endings`, renumbered
- Regenerated: `README.md`, `commands/repl.toml`, `.opencode/plugins/vibekit.js`, and anything else `npm run generate` writes

- [x] Step 1: Replace line 3 with:

```
description: "Use when the user types /vibekit:repl: brainstorms and plans without the user, shows a plain summary and waits for a go, then carries exec, verify and debug to the end with no human input, deciding by decide's rules and stopping only for what the user alone can decide."
```

- [x] Step 2: Replace lines 11 to 35 (from `The user designs. You run the rest.` through the `5. Start the decision log` line) with:

````
You design, plan and build. The user reviews one thing: a plain summary of the plan, before any code is written.

You sit in the user's seat for every question the pipeline would ask, answer it by `decide`, and log the answer. The summary is the only point that waits for the user, unless `decide` pauses.

## 1. Start

1. Invoke `decide`. It stays on for the rest of the run.
2. Add `.vibe-worktrees/` to `.git/info/exclude` if it is not there. Never edit `.gitignore`.
3. Start the decision log at `.vibe-worktrees/<topic>.decisions.tsv`, the topic taken from the intent, with the header row `ts	phase	decision	why	evidence	result`.

## 2. Brainstorm without the user

Invoke `brainstorm` with the intent. It runs unchanged, except that wherever it would wait for the user (each clarifying question, the pushback, the choice of approach, each design section, the spec review), you answer through `decide` and carry on. Brainstorm never waits for the user.

If the request or the repo settles the question, follow it. Otherwise take the recommendation: `brainstorm` gives one for the pushback and the approaches, and you form one for a clarifying question. Print each answer as one line and log it:

`Asked: <question>. Picked: <answer>, because <reason>.`

Then approve the spec yourself: set `status: approved` and write `Run limits: at most 3 verify rounds, at most $0 on paid runs` under the spec's `## Constraints`.

A goal whose only criterion is a paid run, with no budget left for it, cannot be measured. The run pauses on it rather than spending.

## 3. Set up

1. Create branch `repl-run/<topic>` in a worktree at `.vibe-worktrees/<topic>`, off the current branch. `exec` refuses to run without one.
2. Commit the approved spec on the run branch. If its path is gitignored, force-add it there: the branch is local, so this is a two-way door.

## 4. Plan and the summary

Run `plan`. Its self-review stands in for the user's review of the plan. Then print the summary and wait for the user's reply before `exec`:

```
Summary
Build <the feature, in one plain sentence>. These are the choices we made:

1. <a decision from brainstorm, in plain words>
2. <the next one>

How we'll know it works: <the spec's goals, in one plain sentence>
Limits: up to N review rounds, $M on paid checks.

Reply "go" to start building, or tell me what to change.
```

List only decisions that change what gets built: the approach, the pushback outcome, and answers that shaped the design. Use plain words a 12-year-old would follow, with no file paths, function names or jargon unless the user used them.

A go accepts the plan and the limits. Log it, and from `exec` on nothing waits for the user until the run ends.

A correction is a settled answer. New run limits in it go into the spec first. Amend the spec in its own commit, `spec: amend <topic>: <one line>`, have `plan` rewrite the plan, and print the summary again.
````

- [x] Step 3: Renumber the remaining headings: `## 4. The pipeline` to `## 5. The pipeline`, `## 5. Rounds` to `## 6. Rounds`, `## 6. Amending the spec` to `## 7. Amending the spec`, `## 7. The decision log` to `## 8. The decision log`, `## 8. Endings` to `## 9. Endings`. Change no other text in them.
- [x] Step 4: Run `npm run generate`
- [x] Step 5: Run `npm run check`
- [x] Step 6: Run `npm test`
- [x] Step 7: Commit `skills/repl/SKILL.md` and every file `npm run generate` changed, message `feat(repl): brainstorm and plan without the user, summary before build`

### Task 2: decide never pauses a brainstorm question → verify: `npm test` exits 0, and `grep -c 'does not apply to brainstorm questions\|In a brainstorm, every question is a two-way door' skills/decide/SKILL.md` prints at least 2

**Files:**
- Modify: `skills/decide/SKILL.md:38`
- Modify: `skills/decide/SKILL.md:55`

- [ ] Step 1: Replace line 38 with:

```
- Choosing correct behaviour where no settled reference exists and extending the spec would pick a product direction. This does not apply to brainstorm questions, which section 4 covers.
```

- [ ] Step 2: After line 55 (`Pick one and continue. Do not stall and do not ask: ...`), add a blank line and then:

```
In a brainstorm, every question is a two-way door. Take the recommendation `brainstorm` gives, or the one formed for it. The summary before `exec` is the user's review of these answers.
```

- [ ] Step 3: Run `npm run generate`
- [ ] Step 4: Run `npm test`
- [ ] Step 5: Commit `skills/decide/SKILL.md` and every file `npm run generate` changed, message `feat(decide): brainstorm questions are two-way doors`

### Task 3: evals for the summary stop → verify: `node -e` script in Step 3 exits 0, and `npm test` exits 0

**Files:**
- Modify: `evals/scenarios.json` (the `repl-runs-unattended` entry, and a new entry after it)

- [ ] Step 1: In the `repl-runs-unattended` entry, append ` Treat this message as my go when you print the plan summary.` to the end of its `prompt` string, inside the closing quote.
- [ ] Step 2: Insert this entry directly after the `repl-runs-unattended` entry:

```json
  {
    "id": "repl-stops-at-summary",
    "prompt": "Use the vibekit:repl skill to add a formatBytes helper to src/format.js that turns a byte count into a human-readable string.",
    "files": {
      "src/format.js": "export {}\n"
    },
    "expect": {
      "skill": "vibekit:plan",
      "after": ["vibekit:repl", "vibekit:brainstorm"],
      "skillAbsent": "vibekit:exec",
      "finalTextMatches": "How we'll know it works"
    },
    "repo": true,
    "n": 5,
    "model": "sonnet"
  },
```

- [ ] Step 3: Run `node -e "const s=JSON.parse(require('fs').readFileSync('evals/scenarios.json','utf8'));const a=s.find(x=>x.id==='repl-stops-at-summary');const b=s.find(x=>x.id==='repl-runs-unattended');if(!a||a.n!==5||a.expect.skillAbsent!=='vibekit:exec'||!a.repo)process.exit(1);if(!b.prompt.endsWith('Treat this message as my go when you print the plan summary.'))process.exit(1)"`
- [ ] Step 4: Run `npm test`
- [ ] Step 5: Commit `evals/scenarios.json`, message `evals: repl stops at the plan summary`

The paid eval runs for `repl-stops-at-summary`, `repl-runs-unattended` and `repl-fires` (spec Goal 8) are a manual gate. They are not part of any task, and `verify` reports them as unobserved if they did not run.
