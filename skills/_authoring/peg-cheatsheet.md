# PEG Cheatsheet — Vibekit Skill Authoring Standard

**Purpose.** This is the authoring standard every vibekit skill and agent brief must follow. It distills the techniques in `external/Prompt-Engineering-Guide/` (PEG) into a one-stop reference mapped to vibekit's pipeline.

**Core rule.** Every token in a skill prompt must justify itself. If a line is not performing one of the five functions below, cut it:

1. **Role** — who the model is acting as
2. **Task** — what to do
3. **Constraint** — rules, limits, guardrails
4. **Example/structure** — few-shot exemplar or meta-structural template
5. **Output format** — exact shape the response must take

Caveman compresses *style*. PEG structures *substance*. Karpathy (`./karpathy-principles.md`) governs *behavior*. Three orthogonal axes; all three apply to every code-mutating skill. None substitutes for another.

---

## Quick technique → vibekit skill map

| Vibekit skill              | Primary PEG technique                    | PEG source                        |
|----------------------------|------------------------------------------|-----------------------------------|
| brainstorm-lean            | Socratic / Self-Ask + Prompt Chaining    | `prompt_chaining.en.mdx`          |
| plan-write                 | Meta Prompting + Plan-and-Solve          | `meta-prompting.en.mdx`           |
| brief-compiler             | RTCO (Role+Task+Constraint+Output)       | composite (see §3)                |
| report-filter              | Structured output + delimiters           | `fewshot.en.mdx` (§format tips)   |
| exec-dispatch (subagent)   | ReAct                                    | `react.en.mdx`                    |
| tdd-gate                   | Chain-of-Thought (surgical)              | `cot.en.mdx`                      |
| verify-gate                | Self-Consistency                         | `consistency.en.mdx`              |
| debug-trace-lean           | Tree-of-Thought (competing hypotheses)   | `tot.en.mdx`                      |
| review-pack                | Reflexion                                | `reflexion.en.mdx`                |
| wiki-dual / memory-dual    | Meta Prompting + caveman compression     | `meta-prompting.en.mdx`           |
| vibe (orchestrator)        | Prompt Chaining                          | `prompt_chaining.en.mdx`          |

---

## 1. Zero-shot vs. Few-shot — baseline choice

**Source:** `external/Prompt-Engineering-Guide/pages/techniques/zeroshot.en.mdx`, `fewshot.en.mdx`.

**Use zero-shot when:** task is common, instruction alone is unambiguous, no reasoning chain needed.

**Use few-shot when:** task needs a specific *output format* or the model's default behavior diverges from what you need. Per Min et al. (2022), the *label space* and *format* matter more than whether individual labels are correct.

**Template (few-shot):**
```
<instruction one sentence>
<delimiter> INPUT <delimiter> OUTPUT
<delimiter> INPUT <delimiter> OUTPUT
<delimiter> INPUT <delimiter>
```

**Anti-pattern:** padding with 10 nearly-identical examples. 1–3 diverse examples beat 10 uniform ones. Tokens spent on redundant shots = tokens stolen from the real task.

**Vibekit:** use zero-shot for simple routing. Use few-shot for `report-filter` output schema and `commit-caveman` subject-line format.

---

## 2. Chain-of-Thought (CoT) — surgical reasoning

**Source:** `cot.en.mdx`. Wei et al. 2022, Kojima et al. 2022 (zero-shot CoT).

**When to use.** Tasks requiring *multi-step reasoning*: arithmetic, symbolic manipulation, causal chains, debugging logic, TDD test derivation.

**When NOT to use.** Mechanical lookups, single-fact questions, formatting tasks. CoT wastes tokens when reasoning isn't required.

**Template (zero-shot CoT):** append `Let's think step by step.` when the task is new to the model.

**Template (few-shot CoT):** provide 1–3 examples where the answer includes intermediate steps, not just the final answer.

**Anti-pattern:**
- Forcing CoT on mechanical tasks (explosion of tokens with no accuracy gain).
- Leaving the reasoning trace in the final output when the user only needs the answer — strip reasoning at the formatting step.

**Vibekit:** `tdd-gate` uses CoT for *why this test covers this behavior*. `debug-trace-lean` uses CoT inside each hypothesis node. Narration around these steps is still caveman-compressed — the CoT itself is verbatim.

---

## 3. RTCO — the brief template (composite)

Not a single PEG technique; a composite grounded in structured-output guidance + Meta Prompting + few-shot format discipline.

**Structure (every agent brief in vibekit must use this):**
```
ROLE: <one line, specific — "Go test author for this package", not "helpful assistant">
TASK: <imperative, one sentence>
CONSTRAINTS:
  - <rule>
  - <rule>
CONTEXT:
  <file paths, line numbers, relevant snippets — only what's needed>
OUTPUT FORMAT:
  <exact schema: JSON keys, markdown sections, or fenced blocks>
```

**Why this works.** Subagents with unbounded briefs drift. RTCO forces the caller to decide *what good looks like* before dispatch — and the output format lets `report-filter` parse results without prose.

**Anti-pattern:** briefs that start with "Please help me..." or end with "let me know if you need anything". Every pleasantry is a token leak across every dispatch.

**Vibekit:** `brief-compiler` enforces RTCO. Reject any brief missing a field.

---

## 4. ReAct — subagent tool use

**Source:** `react.en.mdx`. Yao et al. 2022.

**Pattern:** interleave `Thought` → `Action` → `Observation`. Thoughts plan and adjust; Actions call tools; Observations feed back.

**Template:**
```
Thought 1: <plan what to look up>
Action 1: <tool call>
Observation 1: <tool result>
Thought 2: <what the result tells us, next step>
Action 2: ...
```

**When to use.** Any subagent that uses tools (Read, Grep, Bash, MCP). Pairs with CoT when reasoning dominates; with Act-only when decision-making dominates.

**Anti-pattern:**
- Skipping Thought between Actions — agent loses plan, redoes work.
- Letting Thought drift into narration ("Now I will very carefully look at..."). Keep thoughts one line, goal-directed.
- Over-relying on ReAct for tasks that need no tools — pure CoT is cheaper.

**Vibekit:** `exec-dispatch` subagents operate in ReAct. `report-filter` strips Thoughts/Observations from the returned report, keeping only Actions taken + final deliverable. The full trace stays in the subagent's transcript for audit.

---

## 5. Self-Consistency — verification

**Source:** `consistency.en.mdx`. Wang et al. 2022.

**Idea.** For reasoning tasks with one correct answer, sample multiple reasoning paths and take the majority answer.

**When to use.** Critical verification steps where a single CoT pass might silently go wrong: "does this test actually test the stated behavior?", "does this diff implement the plan item?".

**When NOT to use.** Everywhere. Self-consistency multiplies token cost by N. Reserve for the verify-gate on high-impact claims.

**Template:** run the same CoT prompt N times (typically 3), compare final answers, take majority. Disagreement → escalate to user, never silently pick.

**Anti-pattern:** using self-consistency on open-ended generation (code writing). The outputs diverge by design; there is no "majority". Use for *judgment* tasks only.

**Vibekit:** `verify-gate` uses 3-sample self-consistency on the question *"does this change satisfy plan item X?"* — not on the code itself.

---

## 6. Tree-of-Thought (ToT) — exploration and debugging

**Source:** `tot.en.mdx`. Yao et al. 2023, Long 2023, Hulbert's prompt-form adaptation.

**Idea.** Branch the reasoning into multiple candidate thoughts at each step, self-evaluate each as `sure / maybe / impossible`, prune, continue.

**When to use.** Problems that need *lookahead* or *backtracking*: debugging with competing root-cause hypotheses, choosing between plan alternatives, complex refactor strategies.

**Prompt-form template (Hulbert):**
```
Imagine three experts answering this. Each writes one step, shares it.
Then each writes the next step. If any expert realizes they are wrong, they drop out.
Question: <...>
```

**Anti-pattern:** ToT on simple tasks — three experts debating a one-line fix is theater, not engineering.

**Vibekit:** `debug-trace-lean` uses ToT as evidence-table: hypotheses as rows, evidence for/against as columns, verdict `confirmed/refuted/pending`. Output is a compact table, not a transcript. The OMC tracer skill already aligns with this shape.

---

## 7. Reflexion — critique and iterate

**Source:** `reflexion.en.mdx`. Shinn et al. 2023.

**Loop.** Actor generates → Evaluator scores → Self-Reflection produces verbal feedback → next attempt incorporates feedback.

**When to use.** Code review, plan review, output that must meet stated criteria. Single-pass generation + one critique pass is the cheap form; multi-iteration is the full form.

**Template (cheap form, one-shot self-critique):**
```
Produce <artifact>.
Then: list three things wrong with what you just produced, by stated criteria <...>.
Then: produce a revised version addressing those three things.
```

**Anti-pattern:**
- Asking for critique without stated criteria → model invents shallow nitpicks.
- Infinite loops. Cap iterations; require measurable improvement between passes.

**Vibekit:** `review-pack` uses cheap-form Reflexion for self-review before surfacing to user. `receiving-code-review` skill from superpowers already embodies the reflexion-response side.

---

## 8. Prompt Chaining — pipeline decomposition

**Source:** `prompt_chaining.en.mdx`.

**Idea.** Break a complex task into subtasks; output of step N becomes input of step N+1. Each link has a narrow, testable contract.

**When to use.** Always, for anything with more than two distinct operations. Prompt chains are more debuggable, more token-predictable, and easier to cache than monolithic prompts.

**Vibekit:** the entire `vibe` orchestrator is prompt chaining. Each stage (brainstorm → plan → exec → verify → review) has an explicit input contract and output contract. Handoffs are *files* (plan.md, state.json), not prose summaries — prose summaries rot.

**Anti-pattern:** hidden state. If step B needs something from step A, it must be in the file, not "the model remembers".

---

## 9. Meta Prompting — structure over content

**Source:** `meta-prompting.en.mdx`. Zhang et al. 2024.

**Idea.** Specify the *structure* of the expected output, not content examples. Token-efficient and example-independent.

**Template:**
```
Solve problems of the form <category> by producing output with this structure:
  1. <abstract slot>
  2. <abstract slot>
  3. <abstract slot>
Apply to: <concrete problem>
```

**When to use.** Recurring tasks where the *shape* of a good answer is stable but the *content* varies widely. Plan files, debug reports, review comments.

**Vibekit:** `plan-write`, `report-filter`, `debug-trace-lean` all use meta-prompting templates. This is the biggest single token-efficiency lever in the repo and maps directly to the PEG claim of "token efficiency" and "zero-shot efficacy".

---

## 10. Delimiters and structured output — always

Not a technique per se; a discipline present throughout PEG examples.

**Rules.**
- Delimit user-supplied or tool-supplied content with explicit markers (`####`, `<doc>`, `<quotes>`). Prevents prompt injection and prevents the model from mistaking data for instruction.
- When the next stage in a chain will *parse* the output, specify JSON/YAML schema + key names. Don't ask for "a summary and a list"; specify `{"summary": "...", "items": [...]}`.
- Put the instruction *at the end*, after context, for long prompts. Models weight recent tokens more heavily for current-task decisions.

**Vibekit:** `report-filter` refuses any agent output that isn't valid JSON matching the declared schema. Prose = bug.

---

## 11. Things PEG does NOT give us — and where to go instead

- **Adversarial robustness / prompt injection defense.** See `guides/prompts-adversarial.md` in PEG and our own `hooks/` for delimiter-enforcement.
- **Evaluation / measurement.** PEG mostly shows techniques; measuring skill quality is on us (see Phase 2 regression tests in `CLAUDE.md`).
- **Tool schema design.** Out of scope for PEG. Follow Anthropic tool-use docs and OMC conventions.

---

## Skill authoring checklist

Every new skill file must include, in its header:

```markdown
---
name: <skill-name>
description: <one-line trigger>
peg_techniques: [<technique-1>, <technique-2>]
compression_zone: <which parts are caveman-compressed, which are verbatim>
guardrails: <pointer to the superpowers or OMC skill whose discipline is preserved>
---
```

Before shipping a new skill, verify:

- [ ] Every section of the prompt performs one of: Role, Task, Constraint, Example, Output format.
- [ ] Named PEG technique(s) cited, consistent with the task (table in §Quick map).
- [ ] RTCO used for any embedded agent brief.
- [ ] Delimiters used around any user- or tool-supplied content.
- [ ] Output format is machine-parseable if the next stage is non-human.
- [ ] Compression zone is explicit; no guardrail content is inside the compressed zone.
- [ ] Anti-patterns from the relevant PEG technique have been checked against the prompt.

If any box is unchecked, the skill is not ready.

---

## References

- `external/Prompt-Engineering-Guide/pages/techniques/` — full technique library
- `external/Prompt-Engineering-Guide/guides/prompts-basic-usage.md` — delimiter and instruction-placement patterns
- `external/Prompt-Engineering-Guide/guides/prompts-advanced-usage.md` — advanced patterns and combinations
- `external/Prompt-Engineering-Guide/guides/prompts-adversarial.md` — injection defense
- `CLAUDE.md` (repo root) — vibekit-wide conventions and compression policy
