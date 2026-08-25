// runtimes/antigravity.mjs
import { triggerTable } from '../lib/table.mjs'

export const id = 'antigravity'

// agy reads a plugin's rules from `rules/`, and nothing else in the plugin
// reaches the model unprompted: its own AGENTS.md, CLAUDE.md and GEMINI.md are
// all ignored. There is no session-start event to prime with either, so this
// file is the only always-on channel the trigger table has.
export function emit(model) {
  const { config } = model
  return {
    'plugin.json': `${JSON.stringify({
      name: config.name,
      description: config.description,
      version: config.version,
    }, null, 2)}\n`,
  }
}

export function ships() {
  return ['plugin.json', 'rules/AGENTS.md']
}

export function regions(model) {
  return { 'rules/AGENTS.md': { 'trigger-table': triggerTable(model.skills) } }
}
