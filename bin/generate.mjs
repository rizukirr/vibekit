#!/usr/bin/env node
// bin/generate.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, mergeEmitters, applyRegions, planChanges, MANIFEST } from '../lib/build.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const check = process.argv.includes('--check')

const io = {
  read(path) {
    try { return readFileSync(join(ROOT, path), 'utf8') } catch { return null }
  },
}

const { emitters, model } = await build(ROOT)
const { files, owner } = mergeEmitters(emitters, model)
applyRegions(emitters, model, files, owner, io)

const previous = (io.read(MANIFEST) ?? '').split('\n').filter(Boolean)
files[MANIFEST] = `${Object.keys(files).sort().join('\n')}\n`

const { write, remove } = planChanges(files, io, previous)

if (check) {
  if (write.length === 0 && remove.length === 0) {
    console.log('up to date')
    process.exit(0)
  }
  console.error('generated files are out of date:')
  for (const path of write) console.error(`  stale: ${path}`)
  for (const path of remove) console.error(`  orphan: ${path}`)
  console.error('run: npm run generate')
  process.exit(1)
}

for (const path of write) {
  const absolute = join(ROOT, path)
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, files[path])
  console.log(`wrote ${path}`)
}
for (const path of remove) {
  if (existsSync(join(ROOT, path))) {
    rmSync(join(ROOT, path))
    console.log(`removed ${path}`)
  }
}
console.log('done')
