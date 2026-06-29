// Guard what actually gets published. Runs `npm pack --dry-run --json` and
// asserts the tarball (a) ships every canonical skill, (b) ships every runtime
// adapter, and (c) leaks none of the dev-only trees. This is the check that
// would have caught the debug-recovery skill being missing from the files
// whitelist — a real bug this repo shipped before CI existed.
import { execSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { report } from "./_util.mjs";

const out = execSync("npm pack --dry-run --json", { encoding: "utf8" });
const shipped = new Set(JSON.parse(out)[0].files.map((f) => f.path));
const errors = [];

// (a) every top-level skill with a SKILL.md must ship.
const skills = readdirSync("skills", { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name)
  .filter((n) => existsSync(join("skills", n, "SKILL.md")));

for (const n of skills) {
  if (!shipped.has(`skills/${n}/SKILL.md`)) {
    errors.push(`skill not shipped: skills/${n}/SKILL.md (add it to package.json "files")`);
  }
}

// (b) required adapters and top-level files. Prefixes are matched against any
// shipped path; exact names must be present verbatim.
const requiredPrefixes = [".claude-plugin/", ".codex-plugin/", ".opencode/", ".pi-plugin/"];
const requiredExact = ["gemini-extension.json", "AGENTS.md", "CLAUDE.md", "GEMINI.md", "README.md", "LICENSE"];

for (const p of requiredPrefixes) {
  if (![...shipped].some((path) => path.startsWith(p))) {
    errors.push(`adapter not shipped: nothing under ${p}`);
  }
}
for (const f of requiredExact) {
  if (!shipped.has(f)) errors.push(`required file not shipped: ${f}`);
}

// (c) no dev-only tree may leak into the tarball.
const forbiddenPrefixes = ["external/", "docs/", "tests/", ".git/", "node_modules/", "plugins/"];
for (const path of shipped) {
  for (const p of forbiddenPrefixes) {
    if (path.startsWith(p)) errors.push(`leaked into tarball: ${path}`);
  }
}

report(`Pack integrity (${shipped.size} files, ${skills.length} skills)`, errors);
