// runtimes/claude-code.mjs
import { triggerTable } from '../lib/table.mjs'

export const id = 'claude-code'

function pluginManifest(config) {
  return {
    name: config.name,
    description: config.description,
    version: config.version,
    author: config.author,
    homepage: config.homepage,
    repository: config.repository,
    license: config.license,
    keywords: config.keywords,
  }
}

function commandFile(skill) {
  return [
    '---',
    `description: ${JSON.stringify(skill.description)}`,
    'argument-hint: <intent>',
    '---',
    '',
    `Invoke the \`${skill.name}\` skill and follow it exactly.`,
    '',
    '**User intent:** $ARGUMENTS',
    '',
  ].join('\n')
}

export function emit(model) {
  const { config, skills } = model
  const json = value => `${JSON.stringify(value, null, 2)}\n`

  const files = {
    '.claude-plugin/plugin.json': json(pluginManifest(config)),
    '.claude-plugin/marketplace.json': json({
      name: `${config.name}-marketplace`,
      description: config.description,
      owner: config.author,
      plugins: [{
        name: config.name,
        description: config.description,
        version: config.version,
        source: './',
        author: config.author,
      }],
    }),
    // The polyglot wrapper is what makes the hook run on Windows; invoking
    // session-start directly works on Unix and silently does nothing on Windows,
    // which leaves every skill inert with no error.
    'hooks/hooks.json': json({
      hooks: {
        SessionStart: [{
          matcher: 'startup|clear|compact',
          hooks: [{
            type: 'command',
            command: '"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" session-start',
            shell: 'bash',
            async: false,
          }],
        }],
      },
    }),
  }

  for (const skill of skills.filter(s => s.command)) {
    files[`commands/${skill.name}.md`] = commandFile(skill)
  }

  return files
}

export function regions(model) {
  return { 'CLAUDE.md': { 'trigger-table': triggerTable(model.skills) } }
}
