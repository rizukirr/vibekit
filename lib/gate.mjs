// lib/gate.mjs
// The edit guard's rule, in one place for every runtime. The OpenCode plugin
// and the pi extension embed these functions' source, and a test pins the
// bash hook's reason to denyReason.

// Skills that count as entering the pipeline: each hard gate and each command.
export const pipelineSkills = skills => skills.filter(skill => skill.gate === 'hard' || skill.command).map(skill => skill.name).sort()

// Skills that stay on once loaded, marked by the end of their description.
export const modifierSkills = skills => skills.filter(skill => skill.description.trim().endsWith('Stays on after.')).map(skill => skill.name).sort()

// What a session still has to load before its first edit, in the order the
// model should load it. loaded is a Set of skill names.
export const missingSkills = (loaded, pipeline, modifiers) => [
  ...(pipeline.some(name => loaded.has(name)) ? [] : ['quick']),
  ...modifiers.filter(name => !loaded.has(name)),
]

export const denyReason = missing => 'vibekit denied this edit, so the file was not changed. Load each of these vibekit skills first, in order:' + missing.map(name => ' vibekit:' + name).join('') + '. Then retry the edit. Retrying first is denied again. To turn this check off, set VIBEKIT_GATE=off.'

// The text a session starts with, wrapping the bootstrap skill's body.
export const startText = (name, body) => '<EXTREMELY_IMPORTANT>\nYou have vibekit.\n\nBelow is the full content of the ' + name + ' skill. Load every other vibekit skill the way this tool loads skills.\n\n' + body + '\n</EXTREMELY_IMPORTANT>'
