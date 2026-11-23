// runtimes/antigravity.mjs
import { triggerTable } from '../lib/table.mjs'
import { startSkills } from '../lib/start.mjs'

export const id = 'antigravity'

// agy reads a plugin's rules from `rules/` and its hooks from `hooks.json` at
// the plugin root, never `hooks/hooks.json`. Hook commands run in the plugin
// folder, so their paths are relative to it. One SessionStart hook per start
// skill injects that skill. agy runs a hook through cmd.exe on Windows and sh
// elsewhere, and no quoted or ./ path works under both: cmd runs the
// backslash path, sh cannot find it, and || hands sh the forward-slash path.
// The form holds no quote, so it does not depend on cmd's /s quote rules.
const hook = args => `hooks\\run-hook.cmd ${args} || ./hooks/run-hook.cmd ${args}`

export function emit(model) {
  const { config } = model
  return {
    'plugin.json': `${JSON.stringify({
      name: config.name,
      description: config.description,
      version: config.version,
    }, null, 2)}\n`,
    'hooks.json': `${JSON.stringify({
      [config.name]: {
        SessionStart: startSkills(model).map(name => ({ type: 'command', command: hook(`session-start antigravity ${name}`) })),
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
