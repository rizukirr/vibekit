// Syntax-check the only executable code in the repo. Dependency-free:
//   - .js / .mjs  -> `node --check`
//   - .ts         -> `node --experimental-strip-types --check` (no tsc needed)
//   - shell       -> `shellcheck` when available (preinstalled on GitHub's
//                    ubuntu runners; skipped with a notice locally if absent)
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { report } from "./_util.mjs";

const tracked = execSync("git ls-files", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const errors = [];

// JS / TS syntax via node itself.
for (const f of tracked) {
  let cmd;
  if (f.endsWith(".ts")) cmd = `node --experimental-strip-types --check ${f}`;
  else if (f.endsWith(".js") || f.endsWith(".mjs")) cmd = `node --check ${f}`;
  else continue;
  try {
    execSync(cmd, { stdio: "pipe" });
  } catch (e) {
    errors.push(`${f}: ${(e.stderr || e.message).toString().trim().split("\n")[0]}`);
  }
}

// Shell scripts (by shebang) via shellcheck, when present.
const hasShellcheck = (() => {
  try {
    execSync("command -v shellcheck", { stdio: "pipe", shell: "/bin/bash" });
    return true;
  } catch {
    return false;
  }
})();

const shellFiles = tracked.filter((f) => {
  try {
    return /^#!.*\b(ba)?sh\b/.test(readFileSync(f, "utf8").split("\n", 1)[0]);
  } catch {
    return false;
  }
});

if (!hasShellcheck) {
  if (shellFiles.length) {
    console.log(`  (shellcheck not installed — skipping ${shellFiles.length} shell script(s))`);
  }
} else {
  for (const f of shellFiles) {
    try {
      execSync(`shellcheck ${f}`, { stdio: "pipe" });
    } catch (e) {
      errors.push(`${f}: shellcheck failed\n${(e.stdout || "").toString().trim()}`);
    }
  }
}

report("Code syntax", errors);
