---
name: report-filter
description: Use immediately after receiving output from any subagent, tool chain, or dispatched task. Parses the raw return, enforces the schema declared in the brief, strips pleasantries and restatements, and surfaces only the signal. Rejects non-conforming output.
---

# report-filter

## When to invoke

Immediately after **any** subagent or tool chain returns output. Applies to:
- Return value of `Task` / `Agent` calls
- Pipeline stage outputs
- Long tool outputs (test runner, build log) where only signal matters
- Chained skill handoffs where stage N+1 parses stage N

Every dispatch that went out through an RTCO brief must come back through this filter.

## Why

Unfiltered agent output contains:
- Pleasantries ("I found that...", "Hope this helps!", "Let me know if...")
- Restatement of the original task ("You asked me to find X. I looked for X.")
- Meta-narration ("I'll now explain my process in detail...")
- Hedging and self-assessment ("I believe this might be...")

None of this is signal. It costs tokens on the return trip and dilutes the signal when the caller reads or feeds the output into the next stage.

This skill extracts the signal, validates against the brief's declared OUTPUT schema, and either emits clean structured output or **rejects** the report back to the subagent with a fix request.

## Rules

### Drop (zero preservation)
- Pleasantries, greetings, sign-offs.
- Restatement of the task.
- Process narration ("First I did X, then Y"). Exception: keep only if the brief's OUTPUT schema explicitly requested a process log.
- Hedging phrases with no added information ("I think", "it seems", "possibly"). Keep hedging **only** when it encodes genuine uncertainty about a technical claim.
- Apologies.

### Keep verbatim (no paraphrase, no compression)
- File paths + line numbers.
- Code snippets quoted from the repo.
- Error messages, stack traces, test output.
- Command invocations that were run.
- Commit SHAs and subjects.
- Numeric results, counts, durations.
- Evidence blocks for hypotheses (in debug reports).
- User-facing strings that will be used verbatim downstream (commit messages, PR text).

### Compress (only if necessary)
- Summary lines *not* covered by the OUTPUT schema — usually these should be dropped entirely, not compressed.
- Agent's own framing around findings — drop.

**Default stance: drop, don't compress.** Reports should be mostly schema-conformant structured data plus verbatim evidence. There is little middle ground worth compressing.

## Schema validation

Every brief declares an OUTPUT schema. On return:

1. **Parse.** If the schema is JSON: parse the output as JSON. If markdown with fixed headings: check all required headings exist.
2. **Validate keys.** Every declared key is present. Types match (string, list, object).
3. **Validate content (syntactic only).** Required file:line references are syntactically valid (`path:line` form). Commit SHAs match `/^[0-9a-f]{7,40}$/`. Numeric fields parse as numbers. Non-null where required.

   This skill performs **syntactic** validation only — it is a prompt and has no git or filesystem access. Repo-level checks (does the file actually exist on disk, does the SHA resolve to a commit, does the SHA's subject match) belong to the caller (for example, `exec-dispatch`), which has tool access. Never assert a semantic claim this skill cannot verify.
4. **Reject on failure.** If validation fails, do NOT silently accept. Return a rejection to the subagent:

```
REJECT: report did not conform to declared OUTPUT schema.
Missing/invalid: <list>
Redispatch with corrected output. Do not re-run the work; only re-format.
```

Three rejections in a row on the same dispatch → escalate to user. Do not enter an infinite loop.

## Discriminated-union schemas

Some briefs (notably implementation briefs from `exec-dispatch`) declare two valid return shapes distinguished by a top-level `status` field. The filter routes before validating:

1. **Read the discriminator first.** Parse the top-level `status` field.
   - **Absent** → for backwards compatibility during one minor version, treat as `status: "complete"` and route to the existing single-schema validation. Drop this fallback at the next major.
   - **`status: "complete"`** → existing variant A validation rules (unchanged).
   - **`status: "needs_input"`** → variant B validation rules (below).
   - **Any other value** → REJECT with `status discriminator missing or invalid: declare 'complete' or 'needs_input'`.

2. **Variant B (`needs_input`) validation rules.** In addition to the standard key/type checks:
   - `blocking_step` non-empty and not whitespace. Empty → REJECT (`blocking_step required: quote the verbatim plan step you halted at`).
   - `ambiguity_type` is exactly `spec-ambiguity` or `missing-context`. Anything else → REJECT.
   - `tried` non-empty AND not a placeholder. Strings matching `/^(n\/a|nothing|none|tbd)$/i` after trim → REJECT (`tried required: state what you attempted to resolve from the brief alone — 'n/a' is not a valid answer`).
   - `question` non-empty AND ends with `?`. A NEEDS_INPUT halt without a question is malformed.
   - `options` array length ≥ 2. Each entry has non-empty `label` and `summary`. Single-option "questions" → REJECT.
   - `recommendation` non-empty. Either references one of the option labels OR is exactly the string `none — no clear preference`. Other "no recommendation" wording → REJECT.
   - `rolled_back` is bool, no string coercion.

3. **Caveat.** Syntactic validation only. The filter cannot judge whether a NEEDS_INPUT question is *substantively* genuine — that judgment belongs to the orchestrator (`exec-dispatch`), which decides whether a syntactically-valid halt is worth surfacing to the user.

## Worked examples

### Example A — research subagent return

Raw return (~220 tokens):
```
Hi! I looked into the auth middleware as you asked. It was a really interesting
exploration! Here's what I found:

The main entry point is in cmd/server/main.go around line 42 where the HTTP
server gets set up. I think the middleware chain is registered there. Then I
followed through to internal/middleware/auth.go where the actual token
validation happens at line 67 — it uses JWT with RS256, which seems reasonable.
I also noticed there's no rate limiting, which might be a gap.

Let me know if you want me to dig deeper into any of these!
```

Filtered (schema-conformant, ~95 tokens):
```json
{
  "entry_points": [{"file": "cmd/server/main.go", "line": 42}],
  "middleware_chain": ["auth", "logging"],
  "token_validation": {
    "file": "internal/middleware/auth.go",
    "line": 67,
    "approach": "JWT RS256"
  },
  "gaps": ["No rate limiting observed"]
}
```

All evidence (file:line) verbatim. All pleasantries dropped. Output is directly consumable by the next chain stage.

### Example B — implementation return (guardrails preserved)

Raw return excerpt:
```
I've completed the dark mode toggle! Here's what I did: first I wrote a failing
test, which was great because it forced me to think about the interface. The
test file is at src/components/ThemeToggle/ThemeToggle.test.tsx. I committed
with sha abc1234 ("test: add failing ThemeToggle test"). Then I implemented...

Test output:
```
 PASS  src/components/ThemeToggle/ThemeToggle.test.tsx
  ThemeToggle
    ✓ renders with light theme by default (12 ms)
    ✓ toggles to dark theme on click (8 ms)
    ✓ persists theme to localStorage (15 ms)

Tests: 3 passed, 3 total
```

Let me know if you'd like me to add more edge cases!
```

Filtered:
```json
{
  "tests_added": ["src/components/ThemeToggle/ThemeToggle.test.tsx:1"],
  "files_changed": [
    "src/components/ThemeToggle/ThemeToggle.tsx",
    "src/components/ThemeToggle/ThemeToggle.test.tsx",
    "src/components/ThemeToggle/index.ts"
  ],
  "test_command": "npm test -- ThemeToggle",
  "test_output_tail": " PASS  src/components/ThemeToggle/ThemeToggle.test.tsx\n  ThemeToggle\n    ✓ renders with light theme by default (12 ms)\n    ✓ toggles to dark theme on click (8 ms)\n    ✓ persists theme to localStorage (15 ms)\n\nTests: 3 passed, 3 total",
  "commits": ["abc1234 — test: add failing ThemeToggle test", "def5678 — feat: implement ThemeToggle"]
}
```

Test output kept **byte-for-byte** — verification evidence must be exact. SHAs and subjects preserved. Pleasantries dropped.

### Example C — rejection

Raw return:
```
I did the task. It went well. Files got changed.
```

Filtered output:
```
REJECT: report did not conform to declared OUTPUT schema.
Missing/invalid:
  - tests_added (required, array) — absent
  - files_changed (required, array of paths) — vague string, not a list
  - test_command (required, string) — absent
  - test_output_tail (required, string) — absent
  - commits (required, array) — absent
Redispatch with corrected output. Do not re-run the work; only re-format.
```

## Algorithm

1. **Read brief.** Identify the OUTPUT schema the dispatch declared.
2. **Locate structured block.** Find JSON/YAML/markdown-structured section in the return.
3. **Strip shell.** Discard everything outside the structured block unless it contains verbatim evidence referenced by the schema.
4. **Validate.** Schema + content checks (see §Schema validation).
5. **Reject or emit.** On success, emit clean structured output. On failure, emit REJECT with specific deltas.
6. **Preserve evidence.** For fields like `test_output_tail`, `error_message`, `code_snippet` — copy byte-for-byte, no edits.

## Anti-patterns

- Paraphrasing an error message to make it shorter. Errors are quoted exact, always.
- "Fixing" a malformed JSON return by inventing missing keys. Reject; do not fabricate.
- Keeping pleasantries because "the user might like the warm tone". The plugin is configured for signal, not warmth.
- Compressing test output or stack traces. These are evidence. Verbatim or drop, never rewrite.
- Accepting a report that *looks* right but violates the schema. Schema is the contract.
- Accepting a NEEDS_INPUT return with `tried: "n/a"` or a single-option `options` array because "the question seems reasonable." The filter's job is schema enforcement; reasonableness is the orchestrator's call after the schema passes. Reject and let the subagent re-format.

## Output of this skill

Either:
- A clean, schema-conformant structured block (JSON / YAML / structured markdown), evidence fields verbatim, nothing else.
- A REJECT block listing specific schema deltas.

Nothing else. No meta-commentary from this skill.
