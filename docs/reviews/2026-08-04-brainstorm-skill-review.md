# Review — brainstorm skill

**Date:** 2026-08-04
**Spec:** docs/specs/2026-08-04-brainstorm-skill-design.md
**Plan:** docs/plans/2026-08-04-brainstorm-skill.md
**Verify report:** docs/verifications/2026-08-04-brainstorm-skill-verify.md (verdict `ready`)
**Commits under review:** 6a09641..0b6415a on `brainstorm-skill`

## Diff summary

- Files changed: 12
- Lines added: 683, removed: 39
- Commits: 15 (7 work commits + 7 plan-checkbox commits + 1 verification report)
- Skill content: 303 lines across three skills (`brainstorm` 163, `terse` 81, `lazy` 59)

## Findings

### Block

None.

### Warn

**W1. `skills/brainstorm/SKILL.md:26-32` and `skills/lazy/SKILL.md:16-22` — the extraction left a duplicated paragraph behind.**

`brainstorm`:

> Trace the whole thing first — every file the change touches, the actual flow —
> before proposing anything. The ladder in `lazy` shortens the solution, never the
> reading. Laziness that skips comprehension ships a confident wrong fix; it dresses
> up as efficiency and is the dangerous kind.

`lazy`:

> The ladder shortens the solution, never the reading. Trace the whole thing first —
> every file the change touches, the actual flow — then climb. Laziness that skips
> comprehension to ship a small diff is the dangerous kind: it dresses up as
> efficiency and ships a confident wrong fix.

Same four claims, reworded, in two skills. This is precisely the duplication the
extraction existed to remove — the spec's §Approach says the two blocks move out
"so it is stated once, referenced everywhere" — and this one did not move. It was
authored into both files independently in Tasks 1 and 2 and survived Task 4
because Task 4's scope was the *ladder* and the *compression policy*, not this
paragraph.

Not a block: nothing is wrong or contradictory, and both copies say the same
thing. But it means the measured saving understates what full extraction would
give, and it is the exact rot the architecture is meant to prevent.

**W2. `skills/using-vibekit/SKILL.md` — the bootstrap is stale and now under-describes reality.**

It still reads:

> Stub. The v2 pipeline is designed in a separate spec; this file exists so the
> SessionStart hook has a bootstrap document to inject and so the generator has a
> skill to discover.

Three real skills now exist, and this is the document the SessionStart hook injects
into **every** session. The delivery mechanism vibekit inherits treats the
bootstrap as the thing that makes skills fire at the right moment; a bootstrap that
describes the plugin as empty is no longer accurate.

Weighed against that: the A/B measured `rate=1.00` **with this stale bootstrap in
place**, on both arms. So discovery is demonstrably working through the skill
descriptions alone. That is itself an interesting datum — it suggests the bootstrap
may be carrying less weight than assumed — but it does not make a stale document
correct. The spec did not scope bootstrap updates, so this is out of scope rather
than missed; it should be in scope for the next skill.

**W3. The A/B has n=5 per arm, which cannot distinguish 1.00 from roughly 0.85.**

Both arms scored 5/5. If the true firing rate were 0.85, the probability of
observing 5/5 is 0.85⁵ ≈ 0.44 — so a 5-run sample would show a perfect score
almost half the time even with a materially worse skill. The conclusion
"extraction is free" is directionally supported but not tightly bounded.

The spec chose `n: 5`, and at ~$0.10–0.45 per sonnet session the cost of tightening
is real. Recording it so the result is not over-read: the honest claim is "no
detectable regression at n=5", not "provably identical".

**W4. The experiment validates that extraction does not hurt *firing*. It does not validate that the delegated content still influences *behaviour*.**

The scenario asserts that `brainstorm` is invoked before any file write. That
event happens at the *start* of a session — before the laziness ladder or the
compression policy would ever come into play. So a run in which the agent invoked
`brainstorm`, ignored the delegation line entirely, and never loaded `lazy` or
`terse` would score exactly 1.00.

In other words, the A/B cannot distinguish "extraction is free" from "the extracted
content never mattered for this measurement". Both are consistent with the data.

The harness has the tool for this — `--judge` grades whether a skill was *followed*
rather than merely invoked — and it was not used. A judged run, or a scenario whose
expectation depends on ladder-shaped output, would close the gap.

### Nit

**N1. `skills/brainstorm/SKILL.md:88` uses "rung" without defining it.**

> **At least one approach must sit at the laziest rung that still meets the
> requirement**, so the user can choose it.

"Rung" is now defined only in `lazy`. A reader with `brainstorm` alone meets an
undefined term. Mitigated by the delegation line at :13, which names `lazy`
explicitly, so it is discoverable rather than dangling.

**N2. `tests/no-external-references.test.mjs:31-37` — a structurally tautological assertion.**

`assert.equal(covered.length, actual.length)` compares two values derived from the
same `readdirSync` and the same filter, so it can never fail. The non-vacuity
guarantee it was written to provide rests entirely on the adjacent
`assert.ok(actual.length > 0)`, which is present and holds. Carried forward from
the verification report; originates in the plan, not the implementation.

## Pass 4 — simplicity

- Skill content: **303 lines** across three files.
- Largest construct: `skills/brainstorm/SKILL.md`, 163 lines.
- Could a senior engineer halve it? **Not within this spec.** Squeezing the
  procedure prose is explicitly deferred to A/B run 2 so that run 1 isolates a
  single variable. Halving it now would be the very confound the design avoids.
- The one genuine cut available today is W1's duplicated paragraph.

`shrink:` `skills/brainstorm/SKILL.md:26-32` — the "Understand before you shorten"
section restates `lazy`'s "Understand first". Reduce to the one sentence that is
specific to designing, and let the delegation line carry the rest.

`net: -6 lines possible.`

## Pass 5 — surgical diff

Clean. An independent read-only auditor traced every changed hunk in
`6a09641..HEAD` to a plan task or spec requirement and returned `clean` with zero
orphans. All seven work-commit messages match the plan's specified wording
verbatim. The generated files (`CLAUDE.md`, `AGENTS.md`, `README.md`) changed only
inside their generated regions.

## Self-critique (three risks)

1. **The skill fires reliably but its *procedure* is wrong.** — unmitigated. The
   eval measures invocation and ordering, never whether following the skill
   produces good designs. A skill that fires 5/5 and then gives bad guidance scores
   identically to a good one. Follow-up: a `--judge` run against `evals/judge.md`,
   which grades whether a skill was followed rather than merely invoked. This is
   W4, and it is the most important gap in the measurement.
2. **The delegated content is never actually loaded.** — unmitigated. Nothing
   verifies that an agent reading "Apply `lazy` and `terse`" goes on to invoke
   them. If it does not, the extraction silently removed the ladder from
   `brainstorm`'s effective behaviour while the firing metric stayed flat.
   Follow-up: a scenario whose expectation is `{"skill": "vibekit:lazy"}` in a
   session that started with a design request, proving the delegation chain
   resolves.
3. **The result does not generalise to the other nine skills.** — partially
   mitigated. `brainstorm` is invoked at the very start of a session, where context
   is small and the trigger is unambiguous. A skill like `verify` or `reconcile`
   fires deep into a long session with far more competing context, so extraction
   might cost firing there even though it did not here. Mitigated only in that each
   remaining skill gets its own A/B; the honest reading is that run 1 validates the
   architecture for *entry-gate* skills and nothing more.

All three share a shape worth naming: **the measurement is strong on "did it fire"
and silent on "did it work".** That was a deliberate design choice — deterministic
metrics with no judge — and it bought a cheap, repeatable gate. The cost is now
visible, and `--judge` exists precisely to pay it when a result needs to mean more.

## Diff

Run: `git diff 6a09641..0b6415a`

Per-file summary is in §Diff summary.

## Sign-off

- [ ] User reviewed findings.
- [ ] User reviewed diff.
- [ ] User approves proceeding to finish-branch.
