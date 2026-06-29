// Assert every published manifest shares one version. Drift here is the exact
// "works on Pi but not Claude Code" failure mode the portability layer exists
// to prevent (see CLAUDE.md). The list is explicit on purpose — it names only
// the canonical manifests and skips the stale plugins/vibekit/ duplicate tree.
import { readJson, report } from "./_util.mjs";

// Each entry resolves the version field for one manifest.
const sources = [
  ["package.json", (j) => j.version],
  [".claude-plugin/plugin.json", (j) => j.version],
  [".claude-plugin/marketplace.json", (j) => j.plugins[0].version],
  [".codex-plugin/plugin.json", (j) => j.version],
  [".opencode/plugin.json", (j) => j.version],
  [".pi-plugin/plugin.json", (j) => j.version],
  ["gemini-extension.json", (j) => j.version],
];

const found = sources.map(([path, pick]) => [path, pick(readJson(path))]);
const expected = found[0][1];

const errors = found
  .filter(([, v]) => v !== expected)
  .map(([path, v]) => `${path} is ${v}, expected ${expected} (from ${found[0][0]})`);

report(`Version sync (all = ${expected})`, errors);
