# Review — NEEDS_INPUT halt-and-resume

**Date:** 2026-05-02
**Spec:** `docs/specs/2026-05-02-needs-input-design.md`
**Plan:** `docs/plans/2026-05-02-needs-input.md`
**Verify report:** `docs/verifications/2026-05-02-needs-input-verify.md` (verdict: ready, single-pass, surgical-diff clean)
**Commits under review:** `def79bd~1..HEAD` on `main` (no isolation worktree; user opted to work on `main`)

## Diff summary

- Files changed: 11
- Lines added: 376
- Lines removed: 49
- Commits: 11 (5 feat/release/audit + 5 chore-complete + 1 plan)

```
9d33046 chore: complete Task 5 — cross-skill consistency audit (5/5 PASS)
ca64256 audit: cross-skill consistency check passes for NEEDS_INPUT (5/5)
426beab chore: complete Task 4 — bump 5 manifests to v0.3.2
dfdde7c release: bump all manifests to v0.3.2 (NEEDS_INPUT halt-and-resume)
9acf209 chore: complete Task 3 — exec-dispatch NEEDS_INPUT halt-and-resume protocol
2be7762 feat(exec-dispatch): add NEEDS_INPUT halt-and-resume protocol with budget cap
3935fe8 chore: complete Task 2 — report-filter discriminated-union routing
0c7e880 feat(report-filter): add discriminated-union routing and NEEDS_INPUT validation
265d774 chore: complete Task 1 — brief-compiler NEEDS_INPUT schema and CONSTRAINTS
def79bd feat(brief-compiler): declare NEEDS_INPUT discriminated-union schema and CONSTRAINTS contract
ed66903 plan: NEEDS_INPUT halt-and-resume implementation plan
```

## Findings

### Block

(none)

### Warn

- **Backwards-compatibility fallback is unbounded in time.** `skills/report-filter/SKILL.md` (commit `0c7e880`) says: `for backwards compatibility during one minor version, treat as status: "complete" ... Drop this fallback at the next major.` The current minor is 0.3.x; "next major" is 1.0.0 which is not on any roadmap. Without a pinned version, the fallback may live indefinitely, which contradicts spec §Constraints C4's "for one minor version" intent. Suggested fix (deferrable): the spec already flags this as an open question; on next manifest bump the rule should be re-tightened to "drop at 0.4.0" or similar concrete pin.

### Nit

- **`### NEEDS_INPUT inside a parallel-group` subsection placement.** `skills/exec-dispatch/SKILL.md` Task 3 Step 6 inserted the new subsection after `### Anti-patterns specific to parallel-group`, making it a structural peer of the anti-patterns rather than a sibling of the procedure subsections (`### Parallel dispatch procedure`, `### Sequential fallback procedure`). Cleaner placement would have been before the anti-patterns block. Low-cost; not worth a fix commit.

- **Wrapper-template field-set parity check is implicit, not greppable.** Cross-skill audit Task 5 Step 5 confirms by reading that the wrapper template references only variant-B schema fields, but no automated grep was specified for that step (unlike steps 2, 4, 6). If the wrapper template gains a field in a future edit that isn't added to the schema, the manual checklist must catch it. The spec already defers automation to the C14 vibekit-doctor open question.

## Self-critique (three risks)

1. **NEEDS_INPUT becomes a synonym for "I gave up" via soft bypass of `tried` validation.** `report-filter` rejects `tried` matching `/^(n\/a|nothing|none|tbd)$/i` after trim, but a subagent can pass with `tried: "I read the brief and didn't find anything obvious"` — syntactically valid, low signal. Mitigation evidence: question-quality contract requires *non-empty* `tried` AND 2+ concrete `options` AND a `recommendation` — a real bypass would need the subagent to fabricate two plausible-sounding options too, which is harder than just typing "n/a". Combined with budget cap = 2, the failure mode is bounded. Follow-up: spec §Testing item 3 (live-eval pair) is the right calibration tool — defer until first real run.

2. **Cross-skill prose drift on future edits.** The discriminated-union schema is byte-replicated across three skills; an edit to one without the others creates silent runtime breakage. Mitigation evidence: cross-skill audit doc `docs/verifications/2026-05-02-needs-input-cross-skill-audit.md` (commit `ca64256`) is the contract; spec §Open Questions defers a `vibekit-doctor` C14 check to a future change. The audit is manual, run at review-pack time. Follow-up: when the C14 check lands (open question), retroactively rerun on every prior NEEDS_INPUT-touching commit to backfill machine evidence.

3. **Implicit-complete fallback creates false-positive completes.** `report-filter` treats absent `status` as `status: "complete"` for backwards compat. A buggy subagent that silently drops `status` is now indistinguishable from a legitimate complete return. Mitigation evidence: existing schema validation still requires `tests_added`, `files_changed`, `commits` etc. — a real broken return would fail those checks. The fallback only applies to clean variant-A shapes. Follow-up: when the fallback drops (warn-finding above), failures get sharper (REJECT instead of accept-as-complete).

All three risks have documented mitigations; none escalate to `block`.

## Diff

Run `git diff def79bd~1..HEAD` to see the full diff. Summary by file:

```
.claude-plugin/plugin.json                                      |   2 +-
.codex-plugin/plugin.json                                       |   2 +-
.opencode/plugin.json                                           |   2 +-
.pi-plugin/plugin.json                                          |   2 +-
gemini-extension.json                                           |   2 +-
docs/plans/2026-05-02-needs-input.md                            | 531 ++++++++++++++++++++++++++++ (new)
docs/verifications/2026-05-02-needs-input-cross-skill-audit.md  |  21 ++ (new)
docs/verifications/2026-05-02-needs-input-verify.md             | 178 ++ (new — committed after this review writes)
skills/brief-compiler/SKILL.md                                  |  29 ++
skills/exec-dispatch/SKILL.md                                   |  84 ++
skills/report-filter/SKILL.md                                   |  22 ++
```

The substantive changes are 133 lines across three SKILL.md files. Five manifest bumps are 1-line each. The plan and verify report are new artifacts; the audit doc is the cross-skill consistency contract.

## Sign-off

- [ ] User reviewed findings.
- [ ] User reviewed diff.
- [ ] User approves proceeding to finish-branch.
