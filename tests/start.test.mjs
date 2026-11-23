// tests/start.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildModel } from '../lib/model.mjs'
import { modifierSkills, startSkills, startText } from '../lib/start.mjs'
import { MODEL } from './helpers.mjs'

const model = buildModel(JSON.parse(readFileSync('vibekit.config.json', 'utf8')), 'skills')

test('modifier skills are every skill whose description ends Stays on after., sorted', () => {
  const list = modifierSkills(model.skills)
  for (const skill of model.skills) assert.equal(list.includes(skill.name), skill.description.trim().endsWith('Stays on after.'), skill.name)
  assert.deepEqual(list, [...list].sort())
})

test('start skills are the bootstrap skill, then every other modifier', () => {
  const list = startSkills(model)
  assert.equal(list[0], model.config.bootstrap)
  assert.deepEqual(list.slice(1), modifierSkills(model.skills).filter(name => name !== model.config.bootstrap))
})

test('a new skill whose description ends Stays on after. joins the start skills', () => {
  const zeta = { name: 'zeta', description: 'Zeta. Stays on after.', trigger: 't', command: false, gate: 'none', dir: 'zeta' }
  assert.deepEqual(startSkills({ ...MODEL, skills: [...MODEL.skills, zeta] }), [MODEL.config.bootstrap, 'zeta'])
})

test('only the first start block says vibekit is present', () => {
  assert.match(startText('quick', 'BODY', true), /^<EXTREMELY_IMPORTANT>\nYou have vibekit\.\n/)
  const later = startText('lazy', 'BODY', false)
  assert.doesNotMatch(later, /You have vibekit/)
  assert.match(later, /full content of the lazy skill/)
  assert.match(later, /\nBODY\n/)
})
