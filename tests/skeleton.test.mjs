// tests/skeleton.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const config = JSON.parse(readFileSync('vibekit.config.json', 'utf8'))

test('config names a bootstrap skill that exists', () => {
  assert.ok(existsSync(`skills/${config.bootstrap}/SKILL.md`))
})

test('config names only runtimes that will have emitters', () => {
  assert.deepEqual(config.runtimes, ['claude-code', 'codex', 'opencode'])
})

test('every stub skill has a SKILL.md', () => {
  for (const name of ['using-vibekit', 'example-command', 'example-plain']) {
    assert.ok(existsSync(`skills/${name}/SKILL.md`), `${name} missing`)
  }
})

test('mixed markdown files carry balanced marker regions', () => {
  for (const [file, id] of [['CLAUDE.md', 'trigger-table'], ['AGENTS.md', 'trigger-table'], ['README.md', 'skill-list']]) {
    const text = readFileSync(file, 'utf8')
    assert.ok(text.includes(`<!-- vibekit:generated:${id} -->`), `${file} missing open marker`)
    assert.ok(text.includes('<!-- /vibekit:generated -->'), `${file} missing close marker`)
  }
})
