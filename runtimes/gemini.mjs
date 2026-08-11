// runtimes/gemini.mjs
import { triggerTable } from '../lib/table.mjs'

export const id = 'gemini'

export function emit(model) {
  const { config } = model
  return {
    'gemini-extension.json': `${JSON.stringify({
      name: config.name,
      description: config.description,
      version: config.version,
      contextFileName: 'GEMINI.md',
    }, null, 2)}\n`,
  }
}

export function ships() {
  return ['gemini-extension.json', 'GEMINI.md']
}

export function regions(model) {
  return { 'GEMINI.md': { 'trigger-table': triggerTable(model.skills) } }
}
