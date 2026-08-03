// tests/ci.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')
const scripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts

test('every npm script the workflow runs exists in package.json', () => {
  const invoked = [...workflow.matchAll(/run:\s*npm run ([\w:]+)/g)].map(match => match[1])
  assert.ok(invoked.length > 0, 'workflow must invoke at least one npm script')
  for (const name of invoked) {
    assert.ok(name in scripts, `workflow runs "npm run ${name}" but package.json has no such script`)
  }
})

test('the workflow runs the drift check, the unit tests, and the hook check', () => {
  assert.match(workflow, /npm run check\b/)
  assert.match(workflow, /npm test\b/)
  assert.match(workflow, /npm run check:hook\b/)
})

test('the hook job runs on windows as well as ubuntu', () => {
  assert.match(workflow, /windows-latest/)
  assert.match(workflow, /ubuntu-latest/)
})

test('no dependency install step is needed', () => {
  assert.ok(!workflow.includes('npm ci'), 'the repo ships no dependencies')
  assert.ok(!workflow.includes('npm install'), 'the repo ships no dependencies')
})
