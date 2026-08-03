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
  assert.ok(out.includes('- `alpha` — Alpha does A.'))
  assert.ok(out.includes('- `beta` — Beta does B.'))
})
