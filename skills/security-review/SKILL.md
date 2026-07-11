---
name: security-review
description: Use after verify-gate returns `ready`, as an optional security pass over a vibe run's diff before finish-branch. Runs a tiered threat-model review — universal code-security checks on every diff, plus AI-artifact checks when the diff builds a skill, agent, prompt, or MCP server — quotes verbatim file:line evidence, scores findings, and hard-gates the handoff on CRITICAL/HIGH with a written-waiver escape. Peer to review-pack; both optional, either may run before finish-branch.
---

# security-review

## Overview

An optional, user-invoked security gate over the code a vibe run produced. The skill:

1. Reads the diff from the isolation base to `HEAD` on the vibe branch.
2. Skips fast when the diff has no security surface (docs/tests only).
3. Classifies the changed artifact to decide which threat tiers apply.
4. Walks the active threat categories as a checklist, each finding backed by verbatim `file:line` evidence.
5. Scores the findings and returns a verdict: `clear` or `blocked`.
6. When `blocked`, halts the handoff to `finish-branch` until the user fixes or waives.

It is a peer to `review-pack`, not a replacement: `review-pack` critiques the work against *the spec*; `security-review` critiques it against a *threat model*. Both are optional gates offered after `verify-gate` returns `ready`; a user may run either, both, or neither before `finish-branch`. This skill never executes the code it reviews — it reasons over diff text only.

## When to invoke

- After `verify-gate` returns verdict `ready`, when the user chooses the security-review option in `vibe`'s final message.
- Standalone, when the user asks for a security pass on the current diff.

Do not invoke:
- If `verify-gate` returned `not ready`. This gate is not a bypass.
- If there are no commits on the vibe branch beyond the isolation base — there is nothing to review.

## Prerequisites

- A diff exists between the isolation base and `HEAD` (or the working diff, in standalone mode).
- Spec and plan paths are known for context (optional in standalone mode).

If no diff exists, stop and surface that there is nothing to review.

## Procedure

Run these stages in order. Every finding requires a verbatim `file:line` quote from the diff, or it does not count.

### Stage 1 — auto-skip check

If every changed file is documentation (`*.md` that is **not** a `SKILL.md` or a prompt file), a test, or non-executable config, emit `no security surface — skipped`, set verdict `clear`, write the output doc, and stop. No gate.

### Stage 2 — artifact classification

Inspect the changed files. **Tier 2 activates** when the diff adds or modifies any of:
- a `SKILL.md`, a prompt file, or an agent definition;
- an MCP server (a `registerTool` call, an `@modelcontextprotocol` import, or an `mcp` entrypoint);
- any file under `skills/`, `prompts/`, or `agents/`.

Otherwise only **Tier 1** applies. A mixed diff runs both tiers. Record the classification in the output doc.

### Stage 3 — grep-first recall sweep

Scan the diff for these high-signal tokens; each hit is a candidate the reasoning pass must adjudicate (confirm as a finding with evidence, or dismiss with a one-line reason). The sweep boosts recall; it does not by itself create findings.

`eval(` · `exec(` · `subprocess` · `os.system` · `curl | bash` · `os.environ` · `base64.b64decode` · `requests.post` · `getattr(os,` · `getattr(builtins,` · hardcoded-credential patterns (`api_key =`, `token =`, `password =`, `-----BEGIN * PRIVATE KEY-----`, `AKIA[0-9A-Z]{16}`, `sk-`).

### Stage 4 — walk active categories

For each category in the active tier(s), state the heuristic, then either quote verbatim `file:line` evidence and record a finding with a severity, or record "no evidence in diff".

**Tier 1 — universal (every diff):**

| Category | Heuristics | Typical severity |
|---|---|---|
| Dangerous code | `exec`/`eval`/`compile`, `subprocess`, `os.system`, dynamic `__import__`, reflective `getattr(os,'system')` | CRITICAL / HIGH |
| Taint source→sink | external or user input → exec/eval/subprocess; credentials or file contents → network sink | CRITICAL / HIGH |
| Data exfiltration | env-var harvesting, transmission to external URLs, conversation-context leakage | HIGH / MEDIUM |
| Privilege escalation | credential / SSH-key / token access, sudo/root invocation, permissions beyond stated function | HIGH / MEDIUM / LOW |
| Supply chain | `curl \| bash`, base64/hex-obfuscated execution, unpinned deps, typosquatting, known-vulnerable deps | HIGH / MEDIUM / LOW |
| Tool misuse | `shell=True`, `--force`, disabled TLS, no-auth or otherwise unsafe defaults | HIGH / MEDIUM |
| Output handling | unvalidated model-output injection, output crossing a trust boundary without validation | HIGH / MEDIUM |
| Hardcoded secrets | API keys, tokens, passwords, private keys committed in the diff | HIGH |

**Tier 2 — AI-artifact-specific (only when Stage 2 activated it):**

| Category | Heuristics | Typical severity |
|---|---|---|
| Prompt injection | instruction override, hidden/invisible instructions, exfiltration directives, harmful-content instructions | CRITICAL / HIGH |
| Anti-refusal | refusal or disclaimer suppression, jailbreak "no restrictions" framing | HIGH |
| System-prompt leakage | direct leakage, indirect extraction, tool-based exfiltration of internal rules | HIGH / MEDIUM |
| Memory poisoning | persistent context injection, context-window stuffing, memory/state tampering | HIGH / MEDIUM |
| Rogue agent | runtime self-modification, unauthorized persistence (cron / startup scripts) | CRITICAL / HIGH |
| Trigger abuse | overly broad trigger, shadowing a built-in or another skill, keyword-baiting | HIGH / MEDIUM |
| MCP least-privilege | capability used but not declared, wildcard permission, missing or over-declared permissions | HIGH / MEDIUM / LOW |
| MCP tool-poisoning | hidden instructions in metadata, unicode deception, parameter-description injection, description↔behavior mismatch | HIGH / MEDIUM |

### Stage 5 — score

Per finding: CRITICAL +50, HIGH +25, MEDIUM +10, LOW +5. Multiply the total by 1.3 if the diff adds or modifies an executable script. Clamp to 0–100. Map to a band: 0–20 `SAFE`, 21–50 `CAUTION`, 51–100 `DO_NOT_INSTALL`. The band is informational; the operative gate is the severity rule in Stage 6, not the band.

### Stage 6 — gate

- Any **CRITICAL or HIGH** finding ⇒ verdict `blocked`, regardless of the aggregate score.
- Zero CRITICAL/HIGH ⇒ verdict `clear` (MEDIUM/LOW are advisory).

On `blocked`, the only paths forward are `fix` (a targeted update, then re-run this skill) or `waive <written reason>` (the reason is recorded verbatim in the output doc; the waiver is an explicit user override, never automatic). `finish-branch` is unavailable until the block is fixed or waived.

## Output document

Write to `docs/security/YYYY-MM-DD-<feature>-security.md`:

```markdown
# Security Review — <feature>

**Date:** YYYY-MM-DD
**Spec:** <path>   **Plan:** <path>   **Verify report:** <path>
**Commits under review:** <base sha>..<head sha> on <branch>

## Classification
- Artifact type: <ordinary code | skill/agent/prompt/MCP | mixed>
- Active tiers: <Tier 1 | Tier 1 + Tier 2>
- Auto-skip: <no | yes — reason>

## Findings
### Critical
- <category> — <file:line> — <verbatim evidence> — <why>
### High
- ...
### Medium
- ...
### Low
- ...

## Score
- Raw: <n>  ·  Executable multiplier: <applied? ×1.3>  ·  Final: <0–100>
- Band: <SAFE | CAUTION | DO_NOT_INSTALL>

## Verdict
<clear | blocked>

## Waiver
<none | user reason, verbatim>
```

## Gate message

After writing the doc, present to the user:

```
Security review: <path>.
Critical: <n>  High: <n>  Medium: <n>  Low: <n>
Score: <final>/100 (<band>).
Verdict: <clear | blocked>.

<if clear>   No CRITICAL/HIGH findings. Proceed to review-pack / finish-branch? (yes / stop)
<if blocked> CRITICAL/HIGH findings block finish-branch. Choose: fix / waive <reason>
```

Wait for the user's response. Never auto-proceed past a `blocked` verdict.

## Compression policy

- Findings: terse bullets; category + `file:line` + the specific defect. No pleasantries.
- **Never compress:** `file:line` evidence quotes, code blocks, the gate message, the waiver text, or any destructive-operation warning.
- Classification and score lines: terse.

## Anti-patterns

- Recording a finding without a verbatim `file:line` quote. Every finding cites a location in the diff.
- Running Tier 2 categories on ordinary application code. Tier 2 activates only per Stage 2.
- Treating the band (`SAFE`/`CAUTION`/`DO_NOT_INSTALL`) as the gate. The gate is the CRITICAL/HIGH severity rule.
- Auto-proceeding past a `blocked` verdict, or accepting a waiver that has no written reason.
- Executing, importing, or running any code from the diff. This skill is static reasoning only.
- Scanning an arbitrary third-party target (Git URL, zip, marketplace skill). This skill reviews the current run's diff, not external artifacts.

## Output of this skill

- A security-review document at `docs/security/YYYY-MM-DD-<feature>-security.md`.
- An explicit verdict: `clear` (finish-branch available) or `blocked` (only `fix` or `waive` available).

Terminal states: `clear` leaves `finish-branch` available. `blocked` halts the handoff until the user fixes the findings (re-run this skill) or waives with a written reason.
