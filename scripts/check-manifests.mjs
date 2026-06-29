// Assert the runtime plugin identity is consistent across every adapter.
// The plugin *name* is "vibekit" in all runtime manifests (it is the plugin
// id, NOT the npm package name, which is scoped to @rizukirr/vibekit in
// package.json). Each manifest must also carry a non-empty description.
import { readJson, report } from "./_util.mjs";

const PLUGIN_NAME = "vibekit";
const errors = [];

// path -> the names that must equal PLUGIN_NAME within that manifest.
const nameChecks = [
  [".claude-plugin/plugin.json", (j) => [j.name]],
  [".claude-plugin/marketplace.json", (j) => [j.name, j.plugins[0].name]],
  [".codex-plugin/plugin.json", (j) => [j.name]],
  [".opencode/plugin.json", (j) => [j.name]],
  [".pi-plugin/plugin.json", (j) => [j.name]],
  ["gemini-extension.json", (j) => [j.name]],
];

for (const [path, pick] of nameChecks) {
  for (const name of pick(readJson(path))) {
    if (name !== PLUGIN_NAME) {
      errors.push(`${path}: plugin name is "${name}", expected "${PLUGIN_NAME}"`);
    }
  }
}

// Every runtime manifest must describe itself.
const descChecks = [
  ".claude-plugin/plugin.json",
  ".codex-plugin/plugin.json",
  ".opencode/plugin.json",
  ".pi-plugin/plugin.json",
  "gemini-extension.json",
];

for (const path of descChecks) {
  const { description } = readJson(path);
  if (!description || !description.trim()) {
    errors.push(`${path}: missing or empty description`);
  }
}

// package.json carries the npm package name — assert it stays scoped.
const pkg = readJson("package.json");
if (pkg.name !== "@rizukirr/vibekit") {
  errors.push(`package.json: npm name is "${pkg.name}", expected "@rizukirr/vibekit"`);
}

report("Manifest consistency", errors);
