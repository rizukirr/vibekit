---
title: runtime coverage
date: 2026-08-11
status: draft
---

# runtime coverage — Design

## Problem

v2 cannot be installed on any runtime but Claude Code, and the runtimes v1
claimed to support were never exercised against the tools they name.

`vibekit.config.json` lists `runtimes: ["claude-code", "codex"]`, so v2 dropped
the Gemini, opencode and Pi emitters `main` still ships. The Codex emitter it
kept is incomplete. Probed on 2026-08-11 against `codex-cli` 0.147.0:

- `codex plugin list` resolves a marketplace through
  `.agents/plugins/marketplace.json`. `main` carries that file; `v2` does not,
  and `runtimes/codex.mjs:24-46` emits only `.codex-plugin/plugin.json` and one
  command TOML per commanded skill.
- Copying the `v2` tree to a scratch directory, hand-writing that one file, and
  running `codex plugin marketplace add <path>` then `codex plugin add` installed
  the plugin: `vibekit@vibekit-v2-probe  installed, enabled  2.0.0`, with all ten
  skill directories present in the plugin root. One file was the entire gap.

`main` is an ancestor of `v2` (0 behind, 279 ahead, merge-base `16133c64` —
which is the revision Codex has pinned today), so promoting `v2` is a
fast-forward. That fast-forward **deletes** `.agents/plugins/marketplace.json`,
breaking the existing Codex install on its next marketplace upgrade. The manifest
must exist on `v2` before `v2` reaches `main`.

Reading v1's other runtime artefacts against a reference project under
`external/` found two more that cannot have worked:

- **Pi.** v1 ships `.pi-plugin/`. Pi reads a `"pi"` block in `package.json`
  naming `extensions` and `skills`, and an extension under `.pi/`. Nothing reads
  `.pi-plugin/`.
- **opencode.** v1 ships `.opencode/plugins/vibekit.js`, but `package.json` has
  no `main` pointing at it, and opencode resolves a git-installed plugin through
  that key. The plugin file is present and unreachable.

Both were shipped, neither was run. With the Codex manifest that is four
integration defects found in one day, against zero defects in the skills
themselves — the same ratio this project keeps measuring, now outside the eval
harness.

The asymmetry that shapes this design: `codex-cli` 0.147.0 and `opencode`
1.18.16 are installed on this machine and can be probed. Gemini CLI and Pi are
not installed and cannot.

## Goals

- Codex installs v2 from the repository. Observable: `codex plugin add` against a
  marketplace pointing at the working tree reports the plugin installed, and
  `codex plugin list` shows it at version `2.0.0`.
- opencode loads vibekit's skills. Observable: `opencode debug skill` run in a
  project configured with the plugin lists `brainstorm`.
- Gemini and Pi receive the artefacts their documented install paths require.
  Observable: `npm run generate` produces `gemini-extension.json` whose
  `contextFileName` is `GEMINI.md`, a `GEMINI.md` carrying the generated trigger
  table, and a `package.json` containing a `pi.skills` array.
- Every emitted artefact reaches the published package. Observable: `npm pack
  --dry-run` lists a path under each of `.agents/`, `.opencode/`, and both
  `gemini-extension.json` and `GEMINI.md`.
- A runtime can be added without editing `runtimes/core.mjs`. Observable: `npm
  test` passes a test asserting that an emitter exporting `pkg()` contributes its
  keys to `package.json`, and a second asserting that two emitters claiming one
  `pkg()` key throws.
- Support status is stated per runtime. Observable: `README.md` contains a row
  for each of the five runtimes naming whether it was verified against an
  installed tool.

## Non-goals

- Promoting `v2` to `main`. It is the reason the Codex manifest is urgent, and it
  is a separate decision made after this lands.
- Pi session-start priming. v1's `.pi-plugin/extensions/vibekit-prime.ts`
  injected the bootstrap skill at session start. It is TypeScript for a runtime
  that cannot be executed here, and Pi's native skill support makes it optional
  rather than load-bearing. See Open questions.
- Verifying Gemini or Pi. Neither tool is installed. Claiming otherwise is the
  defect this spec exists to stop repeating.
- Restoring v1's `.opencode/plugins/vibekit.js` verbatim. It hand-parses skill
  frontmatter, which `@opencode-ai/plugin` 1.18.7 now does natively through its
  skill hook. Prior art, not a target.
- Any change to a skill's text. No file under `skills/` is touched.
- Reviving opencode's or Pi's command files. Commands are per-runtime sugar; the
  skills are the product.

## Constraints

- Dependency free. Bare Node, plus whichever runtime CLI a probe uses.
- No shipped file under `skills/`, and none of the generated context files, may
  name a project vibekit borrows from. `tests/no-external-references.test.mjs`
  enforces it.
- Generated files are never hand-edited. Every artefact this spec adds is
  produced by an emitter and checked by `npm run check`.
- Two emitters claiming one path is an error, not last-write-wins
  (`lib/build.mjs:15-22`). The same rule extends to the new merge points.
- `evals/` never ships.
- No paid eval run. This cycle changes no skill text, so no rate can move.

## Approach

Five runtimes, two verification tiers, one new extension point.

### The emitter contract

`runtimes/core.mjs:38` owns `package.json`, and two runtimes need keys inside it:
opencode needs `main`, Pi needs a `pi` block. `core.mjs:10-20`'s `FILES` const is
the npm allowlist and must grow by every new artefact directory, or the published
package omits them.

An emitter may export two further optional functions:

- `pkg(model)` — an object of keys merged into `package.json`.
- `ships(model)` — an array of paths appended to the npm `files[]` allowlist.

`core.mjs` performs both merges. A key claimed by two emitters throws, mirroring
the existing path-collision rule; `ships()` entries are sorted and de-duplicated,
since an allowlist is a set.

The rejected alternative is hardcoding all five runtimes' contributions into
`core.mjs`. It is a smaller diff and it makes the registry in
`vibekit.config.json` decorative: adding a runtime would mean editing core, which
is exactly what the one-file-per-runtime contract exists to prevent.

### Demonstrated runtimes

**Claude Code** — unchanged.

**Codex** — `runtimes/codex.mjs` also emits `.agents/plugins/marketplace.json`,
naming the plugin `vibekit` with `source: { source: "local", path: "./" }`, the
shape the probe confirmed. `ships()` returns `.agents/`.

**opencode** — new `runtimes/opencode.mjs` emitting `.opencode/plugins/vibekit.js`
and `.opencode/INSTALL.md`, with `pkg()` contributing `main` and `ships()`
returning `.opencode/`. The plugin registers `skills/` through
`@opencode-ai/plugin` 1.18.7's skill hook rather than parsing frontmatter itself.
The hook's exact signature is read from the installed SDK's type declarations
during implementation — `~/.config/opencode/node_modules/@opencode-ai/plugin/dist/`
carries them — and never inferred from v1's file. If the types do not support
registering a skills directory, the task stops and says so rather than shipping a
plugin that loads nothing.

### Documented runtimes

**Gemini** — new `runtimes/gemini.mjs` emitting `gemini-extension.json` with
`name`, `description`, `version` and `contextFileName: "GEMINI.md"`, and a
`regions()` entry putting the generated trigger table into `GEMINI.md`, exactly
as `claude-code.mjs` and `codex.mjs` already do for their context files.
`ships()` returns both paths.

**Pi** — new `runtimes/pi.mjs` whose only output is `pkg()` contributing
`"pi": { "skills": ["./skills"] }`. Pi has native skills, so that block is what
makes them load. It emits no files.

### Support table

`README.md`'s existing runtime table becomes five rows, each naming the tool
version a probe ran against, or saying plainly that no probe ran.

## Alternatives considered

- **Port v1's four shapes into emitters.** Rejected: three of the four are now
  known wrong or unreachable, and "it shipped before" is not evidence — the
  Codex manifest shipped for a year while being one file short of functioning.
- **All five as full emitters with no probing.** Rejected: it is what produced
  every defect this spec repairs.
- **Decompose into three cycles — Codex, then opencode, then the rest.** The
  recommended shape, and the user chose all runtimes in one cycle instead. The
  build order survives inside the plan as task order.
- **Hardcode runtime contributions in `core.mjs`.** Rejected above.
- **Ship Pi's session-start extension unverified.** Rejected: TypeScript for a
  runtime nobody here can run, replacing a native feature.

## Testing

Unit, in `tests/`, each assertion observed failing before the code is written:

- An emitter exporting `pkg()` contributes its keys to `package.json`.
- Two emitters claiming one `pkg()` key throws, naming both emitter ids.
- An emitter exporting `ships()` adds its paths to the npm `files[]` allowlist,
  sorted and de-duplicated.
- `runtimes/codex.mjs` emits `.agents/plugins/marketplace.json`, and the plugin
  name inside it equals the config's plugin name.
- `runtimes/gemini.mjs` emits an extension manifest whose `contextFileName` is
  `GEMINI.md`.
- `runtimes/pi.mjs` contributes a `pi.skills` array and emits no files.
- `npm run check` reports the tree up to date after `npm run generate`.

Integration, free, against installed tools:

1. Codex — add a marketplace pointing at the working tree, install, read
   `codex plugin list`, then remove both so the machine's configuration is left
   as it was found.
2. opencode — configure the plugin in a scratch project, run
   `opencode debug skill`, confirm the vibekit skills are listed, then remove the
   scratch project.

No probe runs against Gemini or Pi, and no goal claims one did.

## Open questions

- Pi's session-start priming is dropped. Without it `using-vibekit` does not
  auto-fire there, so Pi gets skills without the bootstrap discipline. Restoring
  it needs a Pi install to verify against.
- Whether Gemini's extension install accepts this repository at all is unproven.
  The manifest matches a working example, which is weaker than a probe.
- The Claude Code and Codex marketplace manifests use different plugin-source
  shapes (`source: "./"` versus `{ source: "local", path: "./" }`). Both are
  confirmed against their own tool; no attempt is made to unify them.
- Promoting `v2` to `main` also retires nothing else — with this cycle, `main`
  would carry the same five runtimes it does today, three of them repaired.
