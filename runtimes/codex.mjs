// runtimes/codex.mjs
import { triggerTable } from '../lib/table.mjs'

export const id = 'codex'

// Minimal TOML writer for the two string keys a command file needs. A general
// TOML serializer would be a dependency or a home-grown library; this is the
// shape the format actually requires.
function commandFile(skill) {
  const description = skill.description.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return [
    `description = "${description}"`,
    '',
    'prompt = """',
    `Invoke the \`${skill.name}\` skill and follow it exactly.`,
    '',
    'User intent: {{args}}',
    '"""',
    '',
  ].join('\n')
}

export function emit(model) {
  const { config, skills } = model

  const files = {
    '.codex-plugin/plugin.json': `${JSON.stringify({
      name: config.name,
      version: config.version,
      description: config.description,
      author: config.author,
      homepage: config.homepage,
      repository: config.repository,
      license: config.license,
      keywords: config.keywords,
      skills: './skills/',
      hooks: './hooks/hooks.json',
    }, null, 2)}\n`,
    // Codex resolves a marketplace through this path, not through
    // .codex-plugin/plugin.json. Confirmed 2026-08-11 against codex-cli 0.147.0:
    // without it `codex plugin marketplace add` has nothing to read.
    '.agents/plugins/marketplace.json': `${JSON.stringify({
      name: config.name,
      interface: { displayName: config.name },
      plugins: [{
        name: config.name,
        source: { source: 'local', path: './' },
        policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
        category: 'Productivity',
      }],
    }, null, 2)}\n`,
  }

  for (const skill of skills.filter(s => s.command)) {
    files[`commands/${skill.name}.toml`] = commandFile(skill)
  }

  return files
}

export function regions(model) {
  return { 'AGENTS.md': { 'trigger-table': triggerTable(model.skills) } }
}

export function ships() {
  return ['.agents/']
}
