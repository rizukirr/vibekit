// tests/no-external-references.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// vibekit absorbs ideas from the projects in external/; it never depends on them.
// Naming one in a shipped file implies a dependency the user does not have, and
// external/ is gitignored so the reference could never resolve.
const BORROWED_FROM = ['caveman', 'ponytail', 'superpowers', 'karpathy', 'prompt-engineering-guide']

function shippedFiles() {
  const skills = readdirSync('skills', { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
    .map(entry => join('skills', entry.name, 'SKILL.md'))
  return [...skills, 'README.md', 'CLAUDE.md', 'AGENTS.md']
}

test('no shipped file names a project vibekit only borrows from', () => {
  for (const path of shippedFiles()) {
    const text = readFileSync(path, 'utf8').toLowerCase()
    for (const name of BORROWED_FROM) {
      assert.ok(
        !text.includes(name),
        `${path} references '${name}' — vibekit absorbs, it does not depend`,
      )
    }
  }
})

test('the guard actually covers every skill directory', () => {
  const covered = shippedFiles().filter(p => p.startsWith('skills/'))
  const actual = readdirSync('skills', { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))
  assert.equal(covered.length, actual.length)
  assert.ok(actual.length > 0, 'no skills found — the guard would pass vacuously')
})
