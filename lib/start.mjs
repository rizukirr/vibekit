// lib/start.mjs
// The skills every session starts with, in one place for every runtime. The
// OpenCode plugin and the pi extension embed startText's source.

// Skills that stay on once loaded, marked by the end of their description.
export const modifierSkills = skills => skills.filter(skill => skill.description.trim().endsWith('Stays on after.')).map(skill => skill.name).sort()

// The bootstrap skill, then every modifier. Each is injected whole at session
// start, one block per skill.
export const startSkills = model => [model.config.bootstrap, ...modifierSkills(model.skills).filter(name => name !== model.config.bootstrap)]

// One start-up block. Only the first block of a session says vibekit is present.
export const startText = (name, body, first) => '<EXTREMELY_IMPORTANT>\n' + (first ? 'You have vibekit.\n\n' : '') + 'Below is the full content of the ' + name + ' skill. Load every other vibekit skill the way this tool loads skills.\n\n' + body + '\n</EXTREMELY_IMPORTANT>'
