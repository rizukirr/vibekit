// Smoke-test the SessionStart hook end-to-end on the current platform. This is
// the one check that must also pass on Windows: the hook IS the integration —
// when it fails to execute, every skill goes inert with no visible error, which
// is precisely the failure this check exists to catch.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { report } from "./_util.mjs";

const errors = [];
const wrapper = join(process.cwd(), "hooks", "run-hook.cmd");
const direct = join(process.cwd(), "hooks", "session-start");

// On Windows the wrapper is invoked as a .cmd through the shell (the real path
// a runtime takes); on Unix it is invoked as a bash script.
const run = (extraEnv = {}) => {
  const env = { ...process.env, ...extraEnv };
  return process.platform === "win32"
    ? spawnSync(wrapper, ["session-start"], { encoding: "utf8", shell: true, env })
    : spawnSync("bash", [wrapper, "session-start"], { encoding: "utf8", env });
};

// The hook emits one of three envelope shapes depending on the runtime.
const contextOf = (o) =>
  o?.hookSpecificOutput?.additionalContext ?? o?.additionalContext ?? o?.additional_context;

if (!existsSync(wrapper)) {
  errors.push("hooks/run-hook.cmd does not exist");
} else {
  // Hermetic: clear every envelope-selecting variable so the bare shape is
  // deterministic regardless of what the ambient environment happens to set.
  const r = run({ CURSOR_PLUGIN_ROOT: "", CLAUDE_PLUGIN_ROOT: "", COPILOT_CLI: "" });

  if (r.status !== 0) {
    errors.push(`wrapper exited ${r.status} (stderr: ${(r.stderr || "").trim().slice(0, 200)})`);
  }

  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch (e) {
    errors.push(`stdout is not valid JSON: ${e.message}`);
  }

  if (parsed) {
    const ctx = contextOf(parsed);
    if (typeof ctx !== "string") {
      errors.push(`no context field in envelope (keys: ${Object.keys(parsed).join(", ")})`);
    } else {
      // Assert on payload content, not just parseability. session-start
      // swallows a failed read and emits the error text AS the context with
      // exit 0, so a JSON-valid response proves nothing on its own.
      if (!ctx.includes("You have vibekit")) errors.push("context missing priming header");
      if (!ctx.includes("Auto-trigger map")) errors.push("context missing using-vibekit skill body");
      if (/No such file or directory|Error reading/.test(ctx)) {
        errors.push("context contains a file-read error instead of the skill body");
      }
    }
  }

  // The CLAUDE_PLUGIN_ROOT branch must produce the nested envelope.
  const nested = run({ CLAUDE_PLUGIN_ROOT: process.cwd(), COPILOT_CLI: "" });
  try {
    const n = JSON.parse(nested.stdout);
    if (!n.hookSpecificOutput?.additionalContext?.includes("You have vibekit")) {
      errors.push("CLAUDE_PLUGIN_ROOT branch did not produce hookSpecificOutput.additionalContext");
    }
  } catch {
    errors.push("CLAUDE_PLUGIN_ROOT branch did not emit valid JSON");
  }

  // The CURSOR_PLUGIN_ROOT branch must produce the flat snake_case envelope.
  const cursor = run({ CURSOR_PLUGIN_ROOT: process.cwd() });
  try {
    const c = JSON.parse(cursor.stdout);
    if (!c.additional_context?.includes("You have vibekit")) {
      errors.push("CURSOR_PLUGIN_ROOT branch did not produce additional_context");
    }
  } catch {
    errors.push("CURSOR_PLUGIN_ROOT branch did not emit valid JSON");
  }

  // On Unix the wrapper must be a transparent pass-through. (Skipped on
  // Windows, where session-start cannot be invoked directly at all — that
  // being the whole reason the wrapper exists.)
  if (process.platform !== "win32" && existsSync(direct)) {
    const d = spawnSync("bash", [direct], { encoding: "utf8" });
    if (d.stdout !== r.stdout) errors.push("wrapper output differs from direct session-start invocation");
  }

  // Regression guard: the batch half must stay inert under bash.
  if (process.platform !== "win32" && (r.stderr || "").trim() !== "") {
    errors.push(`wrapper emitted stderr under bash: ${r.stderr.trim().slice(0, 200)}`);
  }

  // Missing-argument guard must fail loudly rather than exec a directory.
  const bare = process.platform === "win32"
    ? spawnSync(wrapper, [], { encoding: "utf8", shell: true })
    : spawnSync("bash", [wrapper], { encoding: "utf8" });
  if (bare.status !== 1) errors.push(`wrapper with no argument exited ${bare.status}, expected 1`);
}

report(`SessionStart hook (${process.platform})`, errors);
