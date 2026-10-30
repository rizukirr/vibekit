# pushback recommends: Implementation Plan

**Spec:** docs/specs/2026-10-31-pushback-recommends-design.md
**Goal:** `brainstorm`'s pushback template carries the agent's recommendation, and an eval measures that it does.
**Architecture:** One template line in `skills/brainstorm/SKILL.md` and one scenario in `evals/scenarios.json`. The skill's body is embedded in no generated file.

## Global constraints
- Every edited string obeys `plain`'s rules, which `npm test` checks.
- Generated files are regenerated with `npm run generate`, never hand-edited.

### Task 1: the pushback template recommends a side → verify: `npm run check && npm test && grep -q '^> \*\*Pushback:\*\* Before I sketch approaches.*I recommend .*because .*Is the smaller version' skills/brainstorm/SKILL.md && grep -q '^> \*\*Pushback:\*\* No simpler framing: the requirement is already minimal\. Proceeding to approaches\.$' skills/brainstorm/SKILL.md && node -e "const s=require('./evals/scenarios.json').find(x=>x.id==='brainstorm-pushback-recommends');if(!s||s.n!==10||s.expect.skill!=='vibekit:brainstorm'||s.expect.finalTextMatches!=='I recommend')process.exit(1)"`

**Files:**
- Modify: `skills/brainstorm/SKILL.md:61`
- Modify: `evals/scenarios.json:29`

- [x] Step 1: In `skills/brainstorm/SKILL.md`, replace the line starting `> **Pushback:** Before I sketch approaches` with exactly:

```
> **Pushback:** Before I sketch approaches, one challenge. `<one-sentence simpler framing or hidden assumption>`. I recommend `<smaller | larger>`, because `<one-sentence reason>`. Is the smaller version what you want, or do you need the larger framing? (If the larger framing is correct, say so and I'll proceed.)
```

- [x] Step 2: In `evals/scenarios.json`, directly after the object whose `id` is `brainstorm-precedes-code`, insert this object, followed by a comma:

```json
  {
    "id": "brainstorm-pushback-recommends",
    "prompt": "Use the vibekit:brainstorm skill. I want a full plugin-based theme engine, with a registry and theme packages, so that my one static HTML page can have a dark mode toggle. The directory is empty because the page lives elsewhere, so skip exploring. You have already asked your clarifying questions and I answered: one page, one CSS file, two themes, no plans for more. Take your pushback turn now.",
    "expect": { "skill": "vibekit:brainstorm", "finalTextMatches": "I recommend" },
    "n": 10,
    "model": "sonnet"
  },
```

- [x] Step 3: Run `npm run generate`
- [x] Step 4: Run `npm run check && npm test`
- [x] Step 5: Commit `skills/brainstorm/SKILL.md` and `evals/scenarios.json` with the message `feat(brainstorm): the pushback turn recommends a side`
