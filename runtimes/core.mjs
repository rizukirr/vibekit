// runtimes/core.mjs
import { skillTable } from '../lib/table.mjs'

export const id = 'core'

// files[] names directories, never individual skills. v1 listed each skill
// explicitly, which meant every new skill needed a package.json edit, and a
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
  const { pkg: contributed = {}, ships = [] } = model.contributions ?? {}
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
    files: [...new Set([...FILES, ...ships])].sort(),
    publishConfig: config.npm.publishConfig,
    ...contributed,
  }
  return { 'package.json': `${JSON.stringify(pkg, null, 2)}\n` }
}

export function regions(model) {
  return { 'README.md': { 'skill-list': skillTable(model.skills) } }
}
