# Review — pi-runtime-adapter

**Date:** 2026-04-29
**Spec:** docs/specs/2026-04-29-pi-runtime-adapter-design.md (status: approved)
**Plan:** docs/plans/2026-04-29-pi-runtime-adapter.md
**Verify report:** docs/verifications/2026-04-29-pi-runtime-adapter.md
**Commits under review:** 4e0fc69 (main, base) .. HEAD on `vibe/pi-runtime-adapter` — 20 commits

## Diff summary

- Files changed: 11 (9 substantive + plan checkpointing + verification report)
- Lines added: 406, removed: 50 (net +356)
- Substantive-only (excluding plan/verification meta-docs): +187 lines across 9 files
- Commits: 20 (10 implementer + 7 plan-checkpoint + 1 plan amendment + 1 CLAUDE.md follow-up + 1 .gitignore prep)

Substantive files:
- `.pi-plugin/extensions/vibekit-prime.ts` (+18, new)
- `.pi-plugin/plugin.json` (+5, new)
- `.pi-plugin/prompts/vibe.md` (+24, new)
- `docs/INSTALL.pi.md` (+88, new)
- `package.json` (+7, modified)
- `skills/vibekit-doctor/SKILL.md` (+26, modified — new C11/C12/C13 + C3 entry)
- `README.md` (+14, modified — runtime sentence + Pi subsection)
- `AGENTS.md` (+1, modified — Repository layout entry)
- `CLAUDE.md` (+4/-4, modified — Cross-runtime trigger list)

## Findings

### Block

None.

### Warn

- **Task 5 commit subject deviation.** Plan specified `pi: register vibekit as a pi package via package.json pi key`; implementer used `chore(pi): add pi key and pi-package keyword to package.json`. Cosmetic conventional-commits scope difference; content correct. Evidence: commit `a29af5b`. Already accepted during exec-dispatch Gate 2.
- **CLAUDE.md edit not listed in plan's File structure.** Plan's File structure named only `package.json`, `README.md`, `AGENTS.md`, `skills/vibekit-doctor/SKILL.md` as modified files. Task 9 ("update cross-runtime trigger list") originally targeted AGENTS.md, but the canonical "Cross-runtime changes" section lives in `CLAUDE.md`. The CLAUDE.md edit was added in-scope-by-spirit. Evidence: commit `260f656`. Could be flagged as a plan defect rather than an implementation defect — the plan's verify clause was based on a wrong assumption about which file holds the trigger list.
- **Plan verify-clause mid-run amendment for Task 6 / Task 10.** Original verify clauses said "no warn"; amended to accept C4 (`docs/reviews/`-only) and C7 (`external/` absent in worktree) as environmental. Acceptable, but the amendment was made by the orchestrator under user direction during a halt, not by re-routing through plan-write. Evidence: commit `fa99b2f`. Documented in plan; not a defect in the work, but a reminder that plan guesses about doctor strictness need to be load-bearing-tested.

### Nit

- **Frame-string duplication.** The `<EXTREMELY_IMPORTANT>\nYou have vibekit.\n\n…\n</EXTREMELY_IMPORTANT>` framing in `.pi-plugin/extensions/vibekit-prime.ts:14` mirrors the construction in `hooks/session-start` (the Claude Code SessionStart hook). Two source-of-truth-for-framing locations now exist; if the framing is reworded for one runtime it can drift on the other. Out of scope to extract a shared template in this run, but worth noting for a future cross-runtime parity sweep.
- **Plan's File structure didn't predict `docs/verifications/2026-04-29-pi-runtime-adapter.md` originally.** Already fixed inline during plan-write self-review; plan now lists it. Evidence: plan line 20.

## Self-critique (three risks the tests would not catch)

1. **Pi extension API contract drift.** The `before_agent_start` event signature, `event.systemPrompt` field, and `{ systemPrompt }` return shape are taken from `external/pi-mono/packages/coding-agent/docs/extensions.md` at the time of writing. If pi releases an API change, `vibekit-prime.ts` breaks silently — `vibekit-doctor` C12 catches missing literals (path-string-drift) but does not type-check against pi. **Follow-up:** add a CI step that runs `npx tsc --noEmit -p .pi-plugin/extensions/` after `npm install --save-dev @mariozechner/pi-coding-agent` to type-check against the real types. Or live-install evals on each pi minor.
2. **`import.meta.url` path resolution from `.pi-plugin/extensions/` to `skills/using-vibekit/SKILL.md` is brittle.** Hardcoded `..`/`..` traversal assumes pi installs the package tree intact. Pi's git-install model copies the tree, so this holds today; if pi adopts npm-style flattening or workspace hoisting, the resolution breaks at runtime with a `readFile` error visible only in the priming-handler's catch path. **Follow-up:** prefer `ctx.packageDir` if pi exposes it (current docs show no such API; revisit on each pi release). Otherwise add a defensive fallback that searches up the tree until it finds `skills/using-vibekit/SKILL.md`.
3. **No live install verification.** All verification is static — doctor C1–C13 + spec-coverage. The actual end-to-end (`pi install git:…` → `pi list` → `/vibe` autocompletes → priming reaches `ctx.getSystemPrompt()`) is documented as out-of-scope manual ship-readiness in the spec's `## Testing` section. **Follow-up:** the human reviewer must perform a live install in a throwaway repo under `tests/eval/` before merging or shipping. The Troubleshooting section in `docs/INSTALL.pi.md` predicts the most likely failure modes; if any of them fire on the live install, the diff goes back through `fix`, not forward to `finish-branch`.

## Diff

Run locally:
```bash
git -C /home/rizki/Projects/vibekit/.vibe-worktrees/2026-04-29-pi-runtime-adapter diff main..HEAD
```

Or per-file (substantive only, excluding plan/verification meta-docs):
```bash
git -C /home/rizki/Projects/vibekit/.vibe-worktrees/2026-04-29-pi-runtime-adapter diff main..HEAD -- \
  .pi-plugin/ AGENTS.md CLAUDE.md README.md package.json \
  skills/vibekit-doctor/SKILL.md docs/INSTALL.pi.md
```

## Sign-off

- [ ] User reviewed findings.
- [ ] User reviewed diff.
- [ ] User approves proceeding to finish-branch.
