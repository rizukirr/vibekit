import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const SKILL_RELATIVE_PATH = "skills/using-vibekit/SKILL.md";

export default async function (pi: ExtensionAPI) {
  const here = dirname(fileURLToPath(import.meta.url));
  const skillPath = resolve(here, "..", "..", SKILL_RELATIVE_PATH);
  const skillBody = await readFile(skillPath, "utf8");

  const framed = `<EXTREMELY_IMPORTANT>\nYou have vibekit.\n\n**Below is the full content of the 'vibekit:using-vibekit' skill — your introduction to vibekit's auto-trigger discipline. For all other skills, use the 'Skill' tool:**\n\n${skillBody}\n</EXTREMELY_IMPORTANT>`;

  pi.on("before_agent_start", async (event) => {
    return { systemPrompt: `${event.systemPrompt}\n\n${framed}` };
  });
}
