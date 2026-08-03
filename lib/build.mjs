// lib/build.mjs
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildModel } from './model.mjs'
import { applyRegion } from './markers.mjs'

export const MANIFEST = '.vibekit-manifest'

// Merges each emitter's path→contents map. Two emitters claiming one path is an
// error rather than last-write-wins: a silent overwrite is precisely the kind of
// drift this generator exists to prevent.
export function mergeEmitters(emitters, model) {
  const files = {}
  const owner = {}
  for (const emitter of emitters) {
    for (const [path, contents] of Object.entries(emitter.emit(model))) {
      if (path in files) {
        throw new Error(`'${path}' emitted by both '${owner[path]}' and '${emitter.id}'`)
      }
      files[path] = contents
      owner[path] = emitter.id
    }
  }
  return { files, owner }
}

export function applyRegions(emitters, model, files, owner, io) {
  for (const emitter of emitters) {
    if (!emitter.regions) continue
    for (const [path, regions] of Object.entries(emitter.regions(model))) {
      if (path in files) {
        throw new Error(`'${path}' is claimed by both '${owner[path]}' and '${emitter.id}'`)
      }
      let text = io.read(path)
      if (text === null) throw new Error(`'${path}' has a generated region but does not exist`)
      for (const [id, content] of Object.entries(regions)) text = applyRegion(text, id, content)
      files[path] = text
      owner[path] = emitter.id
    }
  }
  return files
}

// Compares the in-memory map against disk. `previous` is the manifest from the
// last run; only paths it lists are eligible for removal, so the generator can
// never delete a file it did not create.
export function planChanges(files, io, previous) {
  const write = []
  for (const [path, contents] of Object.entries(files)) {
    if (io.read(path) !== contents) write.push(path)
  }
  const emitted = new Set(Object.keys(files))
  const remove = previous.filter(path => !emitted.has(path))
  return { write, remove }
}

export async function build(root) {
  const config = JSON.parse(readFileSync(join(root, 'vibekit.config.json'), 'utf8'))
  const model = buildModel(config, join(root, 'skills'))

  const emitters = []
  for (const id of ['core', ...config.runtimes]) {
    let module
    try {
      module = await import(new URL(`../runtimes/${id}.mjs`, import.meta.url))
    } catch (error) {
      throw new Error(`runtimes/${id}.mjs could not be loaded: ${error.message}`)
    }
    if (module.id !== id) throw new Error(`runtimes/${id}.mjs exports id '${module.id}'`)
    emitters.push(module)
  }

  return { emitters, model }
}
