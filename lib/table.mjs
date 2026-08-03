// lib/table.mjs

// One renderer, used by every runtime that shows a trigger map. Restating this
// per-emitter is exactly the duplication this rewrite exists to remove.
export function triggerTable(skills) {
  return [
    '| Trigger condition | Skill | Gate |',
    '|---|---|---|',
    ...skills.map(skill => `| ${skill.trigger} | \`${skill.name}\` | ${skill.gate} |`),
  ].join('\n')
}

export function skillList(skills) {
  return skills.map(skill => `- \`${skill.name}\` — ${skill.description}`).join('\n')
}
