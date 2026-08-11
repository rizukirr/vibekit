// tests/no-external-references.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// vibekit absorbs ideas from the projects in external/; it never depends on them.
// Naming one in a shipped file implies a dependency the user does not have, and
// external/ is gitignored so the reference could never resolve.
// Hand-maintained: external/ is gitignored, so the guard cannot derive this from
// the directory listing and stay green in CI. Add a name here when a reference is
// cloned — this list went stale the moment spec-kit landed.
const BORROWED_FROM = ['caveman', 'ponytail', 'superpowers', 'karpathy', 'prompt-engineering-guide', 'spec-kit', 'speckit']

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

test('the guard covers every skill plus all three generated docs', () => {
  const files = shippedFiles()
  const skillDirs = readdirSync('skills', { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('_'))

  // Without this the first test passes vacuously on an empty list.
  assert.ok(skillDirs.length > 0, 'no skills found — the guard would pass vacuously')

  // Anchored on a file that must exist, so the assertion is not derived purely
  // from the same readdirSync the implementation uses.
  assert.ok(files.includes('skills/brainstorm/SKILL.md'), 'a known skill must be covered')

  for (const doc of ['README.md', 'CLAUDE.md', 'AGENTS.md']) {
    assert.ok(files.includes(doc), `${doc} must be covered`)
  }

  assert.equal(files.length, skillDirs.length + 3, 'every skill plus exactly three docs')
})
