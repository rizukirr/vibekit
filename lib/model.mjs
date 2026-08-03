// lib/model.mjs
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseFrontmatter } from './frontmatter.mjs'

const REQUIRED = ['name', 'description', 'trigger']
const GATES = ['hard', 'soft', 'none']

// Frontmatter values are interpolated into generated Markdown. A value carrying
// marker syntax would close a generated region early and silently swallow the
// prose after it, so marker-like content is rejected at the same place every
// other authoring rule lives. Pipes are NOT rejected — they are legitimate in
// trigger prose and are escaped at render time instead (see lib/table.mjs).
const FORBIDDEN = '<!-- vibekit:generated'
const FORBIDDEN_CLOSE = '<!-- /vibekit:generated'

// Builds the single in-memory model every emitter reads. Discovery is a glob of
// skills/*/SKILL.md — there is deliberately no skill list anywhere else in the
// repo, which is what makes registration drift impossible rather than merely
// detectable.
export function buildModel(config, skillsDir) {
  const dirs = readdirSync(skillsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
    .map(entry => entry.name)
    .sort()

  const skills = dirs.map(dir => {
    let text
    try {
      text = readFileSync(join(skillsDir, dir, 'SKILL.md'), 'utf8')
    } catch {
      throw new Error(`${dir}: missing SKILL.md`)
    }

    const { data } = parseFrontmatter(text)

    for (const key of REQUIRED) {
      if (typeof data[key] !== 'string' || data[key].trim() === '') {
        throw new Error(`${dir}: frontmatter '${key}' is required and must be a non-empty string`)
      }
      if (data[key].includes(FORBIDDEN) || data[key].includes(FORBIDDEN_CLOSE)) {
        throw new Error(`${dir}: frontmatter '${key}' must not contain generated-region marker syntax`)
      }
    }
    // Duplicate names need no separate check: directory names are unique, and
    // name must equal its directory.
    if (data.name !== dir) {
      throw new Error(`${dir}: frontmatter name '${data.name}' does not match directory`)
    }
    if (data.command !== undefined && typeof data.command !== 'boolean') {
      throw new Error(`${dir}: 'command' must be true or false`)
    }
    const gate = data.gate === undefined ? 'none' : data.gate
    if (!GATES.includes(gate)) {
      throw new Error(`${dir}: gate must be one of ${GATES.join(', ')}`)
    }

    return {
      name: data.name,
      description: data.description,
      trigger: data.trigger,
      command: data.command === true,
      gate,
      dir,
    }
  })

  if (!skills.some(skill => skill.name === config.bootstrap)) {
    throw new Error(`config.bootstrap '${config.bootstrap}' is not an existing skill`)
  }

  return { config, skills }
}
