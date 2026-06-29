// Shared helpers for the CI check scripts. Dependency-free by design — this
// repo ships no node_modules, so every check runs on a bare `node`.
import { readFileSync } from "node:fs";

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

// Print a pass/fail line for one check and exit non-zero on any error.
// Keeps each check script's reporting identical and CI-greppable.
export function report(name, errors) {
  if (errors.length === 0) {
    console.log(`✓ ${name}`);
    return;
  }
  console.error(`✗ ${name}`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
