// tests/gate.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildModel } from '../lib/model.mjs'
import { pipelineSkills, modifierSkills, missingSkills, denyReason, startText } from '../lib/gate.mjs'

const model = buildModel(JSON.parse(readFileSync('vibekit.config.json', 'utf8')), 'skills')

test('pipeline skills are every hard gate and every command, sorted', () => {
  const list = pipelineSkills(model.skills)
  for (const skill of model.skills) assert.equal(list.includes(skill.name), skill.gate === 'hard' || skill.command, skill.name)
  assert.deepEqual(list, [...list].sort())
})

test('modifier skills are lazy, plain and terse', () => {
  assert.deepEqual(modifierSkills(model.skills), ['lazy', 'plain', 'terse'])
})

test('a session with nothing loaded misses quick and every modifier', () => {
  assert.deepEqual(missingSkills(new Set(), ['brainstorm', 'quick'], ['lazy', 'plain', 'terse']), ['quick', 'lazy', 'plain', 'terse'])
})

test('any pipeline skill satisfies the pipeline part', () => {
  assert.deepEqual(missingSkills(new Set(['brainstorm', 'lazy']), ['brainstorm', 'quick'], ['lazy', 'plain', 'terse']), ['plain', 'terse'])
  assert.deepEqual(missingSkills(new Set(['quick', 'lazy', 'plain', 'terse']), ['brainstorm', 'quick'], ['lazy', 'plain', 'terse']), [])
})

test('the deny reason names each missing skill in order and the off switch', () => {
  const reason = denyReason(['quick', 'plain'])
  assert.match(reason, /in order: vibekit:quick vibekit:plain\./)
  assert.match(reason, /file was not changed/)
  assert.match(reason, /VIBEKIT_GATE=off/)
  assert.doesNotMatch(reason, /["\\]/)
})

test('the start text carries the skill name and body', () => {
  const text = startText('using-vibekit', 'BODY')
  assert.match(text, /using-vibekit/)
  assert.match(text, /\nBODY\n/)
})
