# Cross-skill consistency audit — NEEDS_INPUT

**Date:** 2026-05-02
**Spec:** `docs/specs/2026-05-02-needs-input-design.md`
**Plan:** `docs/plans/2026-05-02-needs-input.md`
**Files audited:** `skills/brief-compiler/SKILL.md`, `skills/report-filter/SKILL.md`, `skills/exec-dispatch/SKILL.md`

## Checklist results

- [x] **Field-name parity** — all eight fields (`status`, `blocking_step`, `ambiguity_type`, `question`, `tried`, `options`, `recommendation`, `rolled_back`) appear byte-identical across at least two of the three files. PASS — evidence: grep loop in plan Task 5 Step 2.
- [x] **CONSTRAINTS-vs-protocol consistency** — budget value (2/TWO/third), rollback contract (`git restore .` + `git reset --hard`), eligibility (spec-ambiguity OR missing-context) all agree across `brief-compiler` and `exec-dispatch`. PASS.
- [x] **REJECT-message field-name parity** — no phantom field names in `report-filter` REJECT messages. PASS.
- [x] **Wrapper-template field-set** — `exec-dispatch` wrapper references only variant B schema fields. PASS.
- [x] **Budget-cap-value parity** — value 2/TWO present identically in all three required locations. PASS.

## Verdict

**clean** — no cross-skill drift detected. The discriminated-union schema, four CONSTRAINTS bullets, REJECT messages, wrapper template, and budget cap value are byte-identically aligned across the three skills.
