// runtimes/antigravity.mjs
import { triggerTable } from '../lib/table.mjs'
import { pipelineSkills, modifierSkills } from '../lib/gate.mjs'

export const id = 'antigravity'

// agy reads a plugin's rules from `rules/` and its hooks from `hooks.json` at
// the plugin root, never `hooks/hooks.json`. Hook commands run in the plugin
// folder, so their paths are relative to it. The SessionStart hook injects
// the bootstrap skill and the PreToolUse hook is the edit guard, on the two
// tools agy writes files with.
export function emit(model) {
  const { config, skills } = model
  return {
    'plugin.json': `${JSON.stringify({
      name: config.name,
      description: config.description,
      version: config.version,
    }, null, 2)}\n`,
    'hooks.json': `${JSON.stringify({
      [config.name]: {
        SessionStart: [{ type: 'command', command: './hooks/run-hook.cmd session-start antigravity' }],
        PreToolUse: [{
          matcher: 'write_file|edit_file',
          hooks: [{ type: 'command', command: `./hooks/run-hook.cmd edit-gate ${pipelineSkills(skills).join('+')} ${modifierSkills(skills).join('+')}` }],
        }],
      },
    }, null, 2)}\n`,
  }
}

export function ships() {
  return ['plugin.json', 'hooks.json', 'rules/AGENTS.md']
}

export function regions(model) {
  return { 'rules/AGENTS.md': { 'trigger-table': triggerTable(model.skills) } }
}
