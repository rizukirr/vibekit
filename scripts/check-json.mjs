// Parse every git-tracked JSON file. A broken manifest silently breaks a
// runtime adapter, so this is the cheapest high-value guard. Using
// `git ls-files` scopes to tracked files, which matches the CI checkout and
// automatically excludes gitignored paths (e.g. external/).
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { report } from "./_util.mjs";

const files = execSync("git ls-files '*.json'", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const errors = [];
for (const f of files) {
  try {
    JSON.parse(readFileSync(f, "utf8"));
  } catch (e) {
    errors.push(`${f}: ${e.message}`);
  }
}

report(`JSON validity (${files.length} files)`, errors);
