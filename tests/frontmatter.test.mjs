// tests/frontmatter.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFrontmatter } from '../lib/frontmatter.mjs'

test('parses flat key-value pairs and returns the body', () => {
  const { data, body } = parseFrontmatter('---\nname: foo\ndescription: does a thing\n---\n# Foo\n')
  assert.equal(data.name, 'foo')
  assert.equal(data.description, 'does a thing')
  assert.equal(body, '# Foo\n')
})

test('coerces true and false to booleans', () => {
  const { data } = parseFrontmatter('---\ncommand: true\nhidden: false\n---\nbody\n')
  assert.equal(data.command, true)
  assert.equal(data.hidden, false)
})

test('keeps colons that appear inside a value when quoted', () => {
  const { data } = parseFrontmatter('---\ntrigger: "About to run: anything"\n---\nbody\n')
  assert.equal(data.trigger, 'About to run: anything')
})

test('strips a matched pair of double quotes from a value', () => {
  const { data } = parseFrontmatter('---\ndescription: "does a thing"\n---\nbody\n')
  assert.equal(data.description, 'does a thing')
})

test('strips a matched pair of single quotes from a value', () => {
  const { data } = parseFrontmatter("---\ndescription: 'does a thing'\n---\nbody\n")
  assert.equal(data.description, 'does a thing')
})

test('keeps an interior colon unchanged once the surrounding quotes are stripped', () => {
  const { data } = parseFrontmatter('---\ntrigger: "About to run: anything"\n---\nbody\n')
  assert.equal(data.trigger, 'About to run: anything')
})

test('throws when the frontmatter block is missing', () => {
  assert.throws(() => parseFrontmatter('# Foo\n'), /missing frontmatter/)
})

test('throws on a malformed line', () => {
  assert.throws(() => parseFrontmatter('---\nname foo\n---\nbody\n'), /malformed frontmatter/)
})

test('throws when an unquoted value contains colon-space', () => {
  assert.throws(() => parseFrontmatter('---\ntrigger: run and then: do more\n---\nbody\n'), (err) => {
    return err.message.includes("'trigger'") && err.message.includes(': ')
  })
})

test('does not throw when a quoted value contains colon-space', () => {
  const { data } = parseFrontmatter('---\ntrigger: "run and then: do more"\n---\nbody\n')
  assert.equal(data.trigger, 'run and then: do more')
})
