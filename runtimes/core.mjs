// runtimes/core.mjs
import { skillList } from '../lib/table.mjs'

export const id = 'core'

// files[] names directories, never individual skills. v1 listed each skill
// explicitly, which meant every new skill needed a package.json edit — and a
// forgotten edit shipped a broken package.
const FILES = [
  '.claude-plugin/',
  '.codex-plugin/',
  'commands/',
  'hooks/',
  'skills/',
  'AGENTS.md',
  'CLAUDE.md',
  'LICENSE',
  'README.md',
]

export function emit(model) {
  const { config } = model
  const pkg = {
    name: config.npm.name,
    version: config.version,
    description: config.description,
    type: config.npm.type,
    license: config.license,
    author: config.author,
    homepage: config.homepage,
    repository: config.repository,
    keywords: config.keywords,
    engines: config.npm.engines,
    scripts: config.npm.scripts,
    files: FILES,
    publishConfig: config.npm.publishConfig,
  }
  return { 'package.json': `${JSON.stringify(pkg, null, 2)}\n` }
}

export function regions(model) {
  return { 'README.md': { 'skill-list': skillList(model.skills) } }
}
