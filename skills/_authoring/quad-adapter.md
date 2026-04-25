# Quad-Adapter — Vibekit Cross-Runtime Authoring Contract

**Purpose.** Authoring-only contract. Every vibekit skill that depends on a runtime primitive (parallel subagent dispatch, native loops, per-subagent tool allowlists, vision, etc.) must follow this contract. Sibling to `peg-cheatsheet.md` (substance) and `karpathy-principles.md` (behavior). Quad-adapter governs **portability**.

This file is **never loaded at runtime**. It is read by the human or agent authoring a runtime-coupled skill. Enforcement lives inside the skill's own capability-gate block (template below).

For skills that do nothing but file I/O (`memory-dual`, `vibekit-doctor`), this contract is unnecessary — pure file ops are universally portable. Quad-adapter applies only when a skill needs a primitive that may be absent on one of the four runtimes.

---

## The four runtimes

vibekit supports four hosts. Skills must work — or honestly degrade — on each.

| Runtime | Entry doc | Manifest / shim | Auto-discovers `skills/`? |
|---|---|---|---|
| Claude Code | `CLAUDE.md` (project) + global | `.claude-plugin/plugin.json` | yes (directory glob) |
| Codex | `AGENTS.md` | `.codex-plugin/plugin.json` | yes (directory glob) |
| Gemini CLI | `GEMINI.md` (uses `@./skills/<name>/SKILL.md` includes) | `gemini-extension.json` | no (explicit per-skill includes) |
| opencode | n/a — JS shim | `.opencode/plugins/vibekit.js` | yes (skills directory scan) |

Three of four auto-discover skills from `skills/`. Gemini requires an explicit `@./skills/<name>/SKILL.md` line per skill in `GEMINI.md`. **Every new skill must add that line.**

---

## Capability matrix

Each runtime exposes different primitives. Skills that depend on these must know what is missing.

| Capability | Claude Code | Codex | Gemini CLI | opencode |
|---|---|---|---|---|
| Parallel subagent dispatch | yes (`Task` tool, fan-out) | yes (`codex exec` + tmux panes per OMC pattern) | **no** | provider-dependent |
| Native loop primitive | yes (`/loop` skill) | yes (`ralph` skill via OMC-codex) | **no** | **no** |
| Per-subagent tool allowlist | yes | partial | no | yes |
| Vision input | yes | yes | yes | provider-dependent |
| Background tasks | yes (`run_in_background`) | yes | no | yes |
| Cross-CLI handoff | via `oh-my-claudecode:ask-codex` etc. | same | possible | possible |

Cells marked **no** are the portability hazards. A runtime-coupled skill that ignores them silently breaks on those hosts.

---

## Detection signals

When a skill genuinely needs to detect its host runtime (most do not — they declare per-runtime behavior in prose), use these signals in order:

1. **Env vars** (most reliable):
   - `CLAUDE_CONFIG_DIR` set → Claude Code
   - `CODEX_HOME` set → Codex
   - Gemini CLI exposes no canonical env var; fall back to file markers
2. **File markers in CWD**:
   - `.claude-plugin/` present → Claude Code is plausible
   - `.codex-plugin/` present → Codex is plausible
   - `GEMINI.md` present and is the entry doc → Gemini
   - `.opencode/` present → opencode is plausible
3. **Tool availability** (last resort): if a tool name is callable, that's the host.

Detection is heuristic. Always allow a `--runtime` override flag so the user can correct a misdetection without arguing with the skill.

---

## Degradation contract

When a runtime lacks a capability the skill needs, the skill MUST:

1. **Surface a verbatim user-visible warning** before doing the degraded work. The warning names the missing capability, the runtime detected, and the fallback chosen. Never compress this warning. It joins the never-compress list.
2. **Continue with the documented fallback.** Every runtime-coupled skill ships a fallback per missing capability. Sequential dispatch is the canonical fallback for parallelism; manual re-invoke prompts are the canonical fallback for native loops.
3. **Never silently skip work.** A skill that pretends a capability exists, or quietly omits steps, is broken — it lies to the user about what got done.

A skill that cannot reasonably fall back must REJECT cleanly: print the reason and stop. Example: a vision-only skill on a runtime without vision should refuse, not pretend.

---

## Authoring template — capability-gate block

Every runtime-coupled skill includes one block matching this shape:

```markdown
## Runtime capability gate

This skill needs: <capability A>, <capability B>.

| Runtime | <cap A> | <cap B> | Fallback |
|---|---|---|---|
| Claude Code | yes | yes | n/a |
| Codex       | yes | yes | n/a |
| Gemini CLI  | no  | yes | <documented fallback for cap A on Gemini> |
| opencode    | yes | n/a | <documented fallback for cap B on opencode> |

On a runtime where any required capability is missing, the skill prints this warning verbatim before degrading:

> **Capability degraded.** Running on `<detected runtime>` which lacks `<capability>`. Falling back to `<fallback>`. Output may differ from a fully-supported run; explicit re-invoke required for `<step>`.

The skill then continues with the documented fallback, never silently skipping.
```

Copy this block into the SKILL.md, fill in the capabilities and fallbacks, and keep it near the top — readers must see the runtime contract before they read the operations.

---

## Karpathy alignment

- **Surgical Changes.** A runtime-coupled skill changes its behavior only along the documented capability axis. Detection logic is one block; fallbacks are one block per missing capability.
- **Simplicity First.** Detection uses env vars + file markers, not runtime APIs. No introspection beyond what every runtime trivially exposes.
- **Goal-Driven.** Each fallback has a checkable success criterion: "sequential dispatch produced N reports, one per task" is verifiable; "tried our best" is not.
- **Think Before Coding.** The capability matrix is filled in *before* the skill is written, not after a Gemini user reports it broken.

---

## Compression policy

| Region | Policy |
|---|---|
| Capability matrix | Verbatim — table is the contract |
| Degradation warning text | Verbatim — joins never-compress list |
| Detection logic in skill prose | Compress narration around the rules; rules verbatim |
| Fallback procedure | Verbatim |
| Anti-patterns / opt-outs | Verbatim |

---

## Skills affected by this contract (current + planned)

| Skill | Status | Required capabilities | Fallback story |
|---|---|---|---|
| `memory-dual` | shipped | none beyond file I/O | n/a — pure portable |
| `vibekit-doctor` | shipped | git shell-out | n/a — git is universal |
| `exec-dispatch` (parallel mode) | shipped | parallel subagent dispatch | sequential dispatch on Gemini + opencode (when provider lacks parallel agents), with verbatim degradation warning |
| `ralph-loop` | shipped | native loop primitive + background tasks | degraded checkpoint mode on Gemini + opencode — manual `--resume` between iterations, state preserved, verbatim warning |
| `ralph-loop` (planned) | not yet shipped | native loop primitive | manual re-invoke prompt on Gemini + opencode |
| `hud` (planned) | not yet shipped | runtime UI surface (varies) | log-only mode where UI absent |
| `visual-verdict` (planned) | not yet shipped | vision input | refuse (not silently skip) where absent |

When a planned skill ships, update this row and confirm the capability-gate block is in its SKILL.md.

---

## Anti-patterns

- Detecting the runtime by trying a tool call and catching the error. That works once, then bloats the skill with retry logic.
- Pretending the fallback is "just as good" in the warning. Users pick a runtime knowing tradeoffs; respect that by stating the cost of the fallback honestly.
- Adding new runtimes (e.g., Cursor, Aider) by patching every existing skill. New runtimes get added to the capability matrix here first; skills inherit by re-reading this contract.
- Compressing the degradation warning to save tokens. The warning is guardrail-class; tokens spent are tokens earned.
- Omitting the capability-gate block from a skill that "probably works everywhere." If the skill needs anything beyond file I/O, the block is mandatory.

---

## When authoring or editing a runtime-coupled skill

1. Read this file, `peg-cheatsheet.md`, and `karpathy-principles.md`.
2. Fill the capability matrix for the specific primitives the skill needs.
3. Write the fallback for every "no" cell — name it, document the cost, name the user-visible warning.
4. Paste the capability-gate block near the top of the skill.
5. Cite all three contracts in the skill header: `Follows: PEG (<technique>) + Karpathy (<principles>) + Quad-Adapter (capabilities: <list>)`.
6. Update the "Skills affected by this contract" table above when the skill ships.
