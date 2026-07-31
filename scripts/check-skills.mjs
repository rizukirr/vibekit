// Validate every shipped skill: it must have YAML frontmatter with a `name`
// (matching its directory) and a `description`, and its body must be
// self-contained — no machine-absolute paths or vendored-project names that
// would leak into a published skill (see CLAUDE.md "Keep skills self-contained").
//
// Scope is the canonical top-level skills/ dir only. Directories starting with
// `_` (e.g. _authoring) are reference material, not skills, and are skipped.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { report } from "./_util.mjs";

// Unambiguous leaks. A shipped skill must be readable by someone who has only
// the published package: no machine paths, no third-party project names, and no
// reference to dev-only trees that never ship. AGENTS.md states this rule; this
// list is what enforces it. Authoring docs under skills/_authoring/ may name
// other projects freely — the directory scan below skips `_`-prefixed dirs.
const FORBIDDEN = [
  [/\/home\/[a-z]/i, "machine-absolute path (/home/...)"],
  [/\/Users\/[A-Za-z]/, "machine-absolute path (/Users/...)"],
  [/\bponytail\b/i, "vendored-project name (ponytail)"],
  [/\bopenclaw\b/i, "vendored-project name (openclaw)"],
  [/\bsuperpowers\b/i, "third-party project name (superpowers)"],
  [/\bcaveman\b/i, "third-party project name (caveman)"],
  [/\boh-my-claudecode\b/i, "third-party project name (oh-my-claudecode)"],
  [/\boh-my-codex\b/i, "third-party project name (oh-my-codex)"],
  [/\bPrompt-Engineering-Guide\b/i, "third-party project name (Prompt-Engineering-Guide)"],
  [/\bandrej-karpathy-skills\b/i, "third-party project name (andrej-karpathy-skills)"],
  [/\bwriting-plans\b/i, "foreign skill name (writing-plans) — vibekit's is plan-write"],
  [/external\//, "dev-only path (external/) — never ships, see check-pack.mjs"],
];

const errors = [];
const dirs = readdirSync("skills", { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name);

let validated = 0;
for (const name of dirs) {
  const file = join("skills", name, "SKILL.md");
  if (!existsSync(file)) {
    errors.push(`skills/${name}/ has no SKILL.md`);
    continue;
  }
  validated++;
  const body = readFileSync(file, "utf8");

  const fm = body.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) {
    errors.push(`${file}: missing frontmatter block`);
    continue;
  }
  const block = fm[1];
  const fmName = block.match(/^name:\s*(.+)$/m)?.[1].trim();
  const fmDesc = block.match(/^description:\s*(.+)$/m)?.[1].trim();

  if (!fmName) errors.push(`${file}: frontmatter missing name`);
  else if (fmName !== name) errors.push(`${file}: name "${fmName}" != directory "${name}"`);
  if (!fmDesc) errors.push(`${file}: frontmatter missing description`);

  for (const [re, label] of FORBIDDEN) {
    if (re.test(body)) errors.push(`${file}: contains ${label}`);
  }
}

report(`Skill integrity (${validated} skills)`, errors);
