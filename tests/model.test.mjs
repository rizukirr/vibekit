// tests/model.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildModel } from '../lib/model.mjs'
import { makeSkillsDir, skillFile, MODEL } from './helpers.mjs'

const config = MODEL.config

test('discovers skills sorted by name with defaults applied', () => {
  const { root, cleanup } = makeSkillsDir({
    zulu: skillFile({ name: 'zulu' }),
    'using-vibekit': skillFile({ name: 'using-vibekit' }),
  })
  try {
    const model = buildModel(config, root)
    assert.deepEqual(model.skills.map(s => s.name), ['using-vibekit', 'zulu'])
    assert.equal(model.skills[0].command, false)
    assert.equal(model.skills[0].gate, 'none')
  } finally { cleanup() }
})

test('skips underscore-prefixed directories', () => {
  const { root, cleanup } = makeSkillsDir({
    '_shared': null,
    'using-vibekit': skillFile({ name: 'using-vibekit' }),
  })
  try {
    assert.deepEqual(buildModel(config, root).skills.map(s => s.name), ['using-vibekit'])
  } finally { cleanup() }
})

test('throws when frontmatter name does not match the directory', () => {
  const { root, cleanup } = makeSkillsDir({ 'using-vibekit': skillFile({ name: 'mismatched' }) })
  try {
    assert.throws(() => buildModel(config, root), /does not match directory/)
  } finally { cleanup() }
})

test('throws when a required field is missing', () => {
  const { root, cleanup } = makeSkillsDir({
    'using-vibekit': '---\nname: using-vibekit\ndescription: d\n---\nbody\n',
  })
  try {
    assert.throws(() => buildModel(config, root), /'trigger' is required/)
  } finally { cleanup() }
})

test('throws when a skill directory has no SKILL.md', () => {
  const { root, cleanup } = makeSkillsDir({ 'using-vibekit': null })
  try {
    assert.throws(() => buildModel(config, root), /missing SKILL\.md/)
  } finally { cleanup() }
})

test('throws on an unknown gate value', () => {
  const { root, cleanup } = makeSkillsDir({
    'using-vibekit': skillFile({ name: 'using-vibekit', extra: 'gate: kinda\n' }),
  })
  try {
    assert.throws(() => buildModel(config, root), /gate must be one of/)
  } finally { cleanup() }
})

test('throws when the configured bootstrap skill does not exist', () => {
  const { root, cleanup } = makeSkillsDir({ alpha: skillFile({ name: 'alpha' }) })
  try {
    assert.throws(() => buildModel(config, root), /bootstrap/)
  } finally { cleanup() }
})

// Risk 3: marker syntax in frontmatter would close a generated region early and
// silently swallow the prose after it.
test('throws when frontmatter carries generated-region marker syntax', () => {
  const { root, cleanup } = makeSkillsDir({
    'using-vibekit': skillFile({ name: 'using-vibekit', trigger: 'x <!-- /vibekit:generated --> y' }),
  })
  try {
    assert.throws(() => buildModel(config, root), /must not contain generated-region marker syntax/)
  } finally { cleanup() }
})

test('allows a pipe in frontmatter: it is escaped at render time, not banned', () => {
  const { root, cleanup } = makeSkillsDir({
    'using-vibekit': skillFile({ name: 'using-vibekit', trigger: 'returns not satisfied | partial' }),
  })
  try {
    assert.equal(buildModel(config, root).skills[0].trigger, 'returns not satisfied | partial')
  } finally { cleanup() }
})
