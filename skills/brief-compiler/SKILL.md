---
name: brief-compiler
description: Use before dispatching any subagent or task. Compiles a verbose intent into a tight RTCO (Role, Task, Constraints, Context, Output) brief that minimizes tokens while preserving every guardrail. Mandatory before any Task/Agent dispatch.
---

# brief-compiler

## When to invoke

Before **any** subagent dispatch or delegated task. If you are about to write `Task(...)`, `Agent(...)`, or a pipeline step, this skill runs first to produce the brief.

Also invoke when: writing instructions for a parallel fan-out, authoring a scheduled job, preparing a handoff to another CLI.

## Why

Subagents with unbounded briefs drift. Verbose briefs burn tokens twice — once on the way in, again on the way back when the agent mirrors the verbosity. The RTCO template forces the caller to decide *what good looks like* before dispatch, and a machine-parseable output schema lets the return-side filter do its job.

## The RTCO template (mandatory)

Every compiled brief must have exactly these five sections, in this order:

```
ROLE: <one line. Specific identity. "Go test author for package X", not "helpful assistant">
TASK: <one imperative sentence. What must be true when done>
CONSTRAINTS:
  - <rule, one per line>
  - <rule>
CONTEXT:
  <only what the agent cannot derive. File paths with line numbers, exact snippets,
   relevant facts the agent does not have. Nothing else>
OUTPUT:
  <exact machine-parseable schema. JSON keys named. Or a fenced markdown structure
   with every heading the agent must produce>
```

Missing field = invalid brief. Do not dispatch.

## Compression rules

### Compress to the minimum (drop filler words, articles, pleasantries)
- ROLE line
- TASK sentence
- Any prose framing around the brief

### Keep verbatim (no compression, no paraphrase)
- Every CONSTRAINT bullet
- Every CONTEXT file path, line number, code snippet, error string
- The entire OUTPUT schema, including exact key names, types, and examples
- Any destructive-operation warning
- Any quote from the user's request

**Rule of thumb:** if the agent would get a worse result from the compressed form, don't compress that part.

## Worked examples

### Example A — research subagent

Before (verbose, ~180 tokens):
```
Hey, could you please go and take a look at how authentication is currently
handled in this codebase? I'd really love to understand the flow end to end.
Specifically, I'm curious about the middleware layer. When you're done, could
you write up a summary of what you found? Thanks so much!
```

After RTCO (~68 tokens):
```
ROLE: Auth-flow researcher, read-only.
TASK: Map auth middleware end-to-end in this repo.
CONSTRAINTS:
  - Read-only. No edits.
  - Cite file:line for every claim.
CONTEXT:
  Entry points suspected in cmd/server/*.go.
OUTPUT:
  ```json
  {
    "entry_points": [{"file": "...", "line": 0}],
    "middleware_chain": ["..."],
    "token_validation": {"file": "...", "line": 0, "approach": "..."},
    "gaps": ["..."]
  }
  ```
```

Token cost down ~60%. Output is parseable. Agent cannot drift into prose.

### Example B — implementation subagent (guardrails critical)

Before:
```
Please implement the dark mode toggle we discussed, making sure to follow TDD.
Don't forget to run the tests. Thanks!
```

After RTCO:
```
ROLE: Frontend implementer, component-scope.
TASK: Add dark-mode toggle matching plan.md section 3.
CONSTRAINTS:
  - TDD: write failing test first, commit before implementation.
  - Do not edit files outside src/components/ThemeToggle/ and its test.
  - Run `npm test -- ThemeToggle` after each change; all must pass at end.
  - Do not modify package.json or global CSS.
CONTEXT:
  Plan: ./plan.md §3 (dark-mode toggle).
  Design tokens: src/theme/tokens.ts:12-48.
  Existing toggle pattern: src/components/Switch/Switch.tsx:1-80.
OUTPUT:
  ```json
  {
    "tests_added": ["path:line"],
    "files_changed": ["path"],
    "test_command": "string",
    "test_output_tail": "string (last 20 lines of test runner output)",
    "commits": ["sha — subject"]
  }
  ```
```

Every CONSTRAINT bullet is verbatim. Test-first discipline preserved. No compression in the constraint block.

## Anti-patterns (reject the brief if you see these)

- "Please / thanks / could you" in ROLE or TASK — delete.
- CONSTRAINTS written as prose paragraphs — break into bullets.
- CONTEXT containing information the agent can derive ("this is a TypeScript project") — delete.
- OUTPUT specified as "a summary" or "let me know what you find" — replace with schema.
- Multiple tasks in one brief — split into multiple briefs, dispatch in parallel.
- Hidden state: "remember what we discussed earlier" — if the agent needs it, put it in CONTEXT.

## Algorithm

1. **Extract intent.** From the caller's verbose request, pull the single imperative.
2. **Assign role.** Narrow identity matching the task. Read-only vs mutate matters.
3. **List constraints.** What must be true during execution? What must not happen? Include test-first and verification gates if code changes.
4. **Gather context.** Only what the agent cannot see on its own. Prefer `path:line` references over pasted code.
5. **Specify output.** Pick JSON schema if downstream parses; structured markdown with fixed headings if human-read.
6. **Compress.** Trim ROLE + TASK to the minimum. Verify constraints, context refs, and output schema are byte-identical to your intent.
7. **Validate.** Run the checklist below. If any box fails, fix before dispatch.

## Pre-dispatch checklist

- [ ] ROLE is specific (names the thing, not "assistant").
- [ ] TASK is a single imperative sentence.
- [ ] CONSTRAINTS are bullets, each independently verifiable.
- [ ] CONTEXT contains only non-derivable info, with file:line refs where possible.
- [ ] OUTPUT is machine-parseable or has fixed headings.
- [ ] No pleasantries, no hedging, no "let me know".
- [ ] Every guardrail-critical line (test-first step, destructive warning, test command) is verbatim.
- [ ] If dispatching N agents, briefs are independent (no shared mutable state).

If any fails, fix the brief. Do not dispatch a leaky brief to save time.

## Output of this skill

A single RTCO block, ready to be passed directly as the `prompt` argument to `Task` / `Agent` / pipeline dispatcher. Nothing else. No meta-commentary.
