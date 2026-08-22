// tests/table.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { triggerTable, skillList } from '../lib/table.mjs'
import { MODEL } from './helpers.mjs'

test('renders a three-column trigger table', () => {
  const out = triggerTable(MODEL.skills)
  assert.equal(out.split('\n')[0], '| Trigger condition | Skill | Gate |')
  assert.equal(out.split('\n')[1], '|---|---|---|')
  assert.ok(out.includes('| When A happens | `alpha` | hard |'))
  assert.ok(out.includes('| When B happens | `beta` | none |'))
})

test('renders one row per skill and nothing else', () => {
  assert.equal(triggerTable(MODEL.skills).split('\n').length, 2 + MODEL.skills.length)
})

test('renders a skill list with descriptions', () => {
  const out = skillList(MODEL.skills)
  assert.ok(out.includes('- `alpha`: Alpha does A.'))
  assert.ok(out.includes('- `beta`: Beta does B.'))
})

// B1: a pipe in a cell silently added a column, corrupting the auto-trigger map.
test('escapes pipes in table cells so a row keeps three columns', () => {
  const skills = [{ name: 'probe', description: 'd', trigger: 'When A | B happens', command: false, gate: 'none', dir: 'probe' }]
  const row = triggerTable(skills).split('\n')[2]
  assert.equal(row, '| When A \\| B happens | `probe` | none |')
  // Count unescaped delimiters: a well-formed 3-column row has exactly 4.
  const delimiters = row.split('').filter((c, i) => c === '|' && row[i - 1] !== '\\').length
  assert.equal(delimiters, 4)
})

test('leaves pipe-free cells untouched', () => {
  assert.ok(triggerTable(MODEL.skills).includes('| When A happens | `alpha` | hard |'))
})
