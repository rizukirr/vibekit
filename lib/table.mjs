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

// README shows the same set as a table: what each skill is for, and whether it
// gates. Generated rather than hand-written for the same reason the trigger map
// is — a hand-kept list drifts the first time a skill is added.
export function skillTable(skills) {
  return [
    '| Skill | What it does | Gate |',
    '|---|---|---|',
    ...skills.map(skill => `| \`${cell(skill.name)}\` | ${cell(skill.description)} | ${cell(skill.gate)} |`),
  ].join('\n')
}
