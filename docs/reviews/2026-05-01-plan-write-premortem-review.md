# Review — plan-write premortem step

**Date:** 2026-05-01
**Spec:** `docs/specs/2026-05-01-plan-write-premortem-design.md`
**Plan:** `docs/plans/2026-05-01-plan-write-premortem.md`
**Verify report:** `docs/verifications/2026-05-01-plan-write-premortem-verify.md` (verdict: ready, single-pass)
**Commits under review:** `d1e3a3a~1..HEAD` on `main` (no isolation worktree was used; user opted to work on `main`)

## Diff summary

- Files changed: 8
- Lines added: 312
- Lines removed: 16
- Commits: 5 (plus the plan-fix commit `a2d1fe4` immediately before, which corrected Task 1's verify-clause prediction during dispatch — user-authorized)

```
0abca31 verify: plan-write premortem step — ready
b755d9f chore: complete Task 2 — Bump plugin manifest versions 0.3.0 to 0.3.1
085d17b release: bump all manifests to v0.3.1 (plan-write premortem step)
1c694be chore: complete Task 1 — Add ## Premortem section, header-template stub, and self-review closing line
d1e3a3a feat(plan-write): add premortem step with four-category adversarial sweep
```

## Findings

### Block

(none)

### Warn

(none)

### Nit

- **Output-format example appears twice in `skills/plan-write/SKILL.md`.** The header-template stub at lines 99-115 shows the rendered `## Premortem` shape; the new section's `### Output format` block at lines 270-288 shows essentially the same structure with placeholder strings. A senior reader could remove the second example and rely on the header-template stub. Kept intentionally for discoverability — an author reading the Premortem section in isolation sees the format without scrolling up. Low-cost duplication; not worth blocking.

## Self-critique (three risks)

1. **Authors may write `none — N/A` for every category, defeating the sweep.** Mitigation evidence: anti-pattern bullet 1 at `skills/plan-write/SKILL.md:298` calls this out explicitly by name with a positive example of a specific `none` reason. The skill cannot enforce content quality, only document the failure mode. Follow-up: a live-eval pair (deferred per spec §Testing item 2) would calibrate whether real authors fall into this trap.

2. **`BLOCKING RISK:` label is human-only — no downstream skill formally gates on it.** A worker reading a plan with a `**BLOCKING RISK:**` bullet could ignore it because `exec-dispatch` doesn't check for the label. Mitigation evidence: spec §Approach §"exec-dispatch / verify-gate / review-pack consumption" explicitly notes this is informational ("may read the premortem as additional context … is not required to"). The user reads the labeled bullet at the existing user-review gate; that gate is the enforcement. Follow-up: spec §Open Questions defers formal gating to a future change.

3. **Premortem may degrade to ritual on simple plans (four `none` lines).** This is exactly the failure the categorical-sweep design tries to prevent (vs. an open-ended risk-discovery prompt). Mitigation evidence: anti-pattern bullet 1 at line 298 plus the requirement that `none` reasons be specific (`none — only touches new files in src/components/ThemeToggle/`, not `none — N/A`). Follow-up test: spec §Testing item 3 (self-consistency check on a real recent plan) — confirm at least one category produces a substantive bullet on a real plan.

All three risks have documented mitigations; none escalate to `block` or `warn`.

## Diff

Run `git diff d1e3a3a~1..HEAD` to see the full diff. Summary by file:

```
.claude-plugin/plugin.json                    |  2 +-
.codex-plugin/plugin.json                     |  2 +-
.opencode/plugin.json                         |  2 +-
.pi-plugin/plugin.json                        |  2 +-
gemini-extension.json                         |  2 +-
docs/plans/2026-05-01-plan-write-premortem.md | 22 ++++----
docs/verifications/2026-05-01-plan-write-premortem-verify.md | 217 +++++ (new)
skills/plan-write/SKILL.md                    | 79 +++++
```

The substantive change is the 79-line addition to `skills/plan-write/SKILL.md`. The five manifest bumps are 1-line each. The plan file accumulated checkbox-completion markers and one user-authorized verify-clause correction. The verification report is a new artifact.

## Sign-off

- [ ] User reviewed findings.
- [ ] User reviewed diff.
- [ ] User approves proceeding to finish-branch.
