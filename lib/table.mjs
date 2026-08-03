// lib/table.mjs

// Markdown table cells are pipe-delimited, so a pipe inside a value silently
// adds a column. The authoring contract allows any string in `trigger`, and real
// trigger prose reads like "returns not satisfied | partial" — so cells are
// escaped rather than the character being banned.
function cell(value) {
  return value.replace(/\|/g, '\\|')
}

// One renderer, used by every runtime that shows a trigger map. Restating this
// per-emitter is exactly the duplication this rewrite exists to remove.
export function triggerTable(skills) {
  return [
    '| Trigger condition | Skill | Gate |',
    '|---|---|---|',
    ...skills.map(skill => `| ${cell(skill.trigger)} | \`${cell(skill.name)}\` | ${cell(skill.gate)} |`),
  ].join('\n')
}

export function skillList(skills) {
  return skills.map(skill => `- \`${skill.name}\` — ${skill.description}`).join('\n')
}
