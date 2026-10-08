import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSubmission } from '../lib/submission.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PRIVATE_KEY_HEADER = ['-----BEGIN ', 'PRIVATE KEY-----'].join('')

test('test source contains no literal private key header', () => {
  assert.ok(!readFileSync(fileURLToPath(import.meta.url), 'utf8').includes(PRIVATE_KEY_HEADER))
})

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'vibekit-submission-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const path of ['skills', 'submission', 'vibekit.config.json', 'LICENSE', 'PRIVACY.md']) cpSync(join(ROOT, path), join(root, path), { recursive: true })
  return root
}

function update(root, path, mutate) {
  const file = join(root, path)
  const data = JSON.parse(readFileSync(file, 'utf8'))
  mutate(data)
  writeFileSync(file, JSON.stringify(data))
}

function unzip(archive, ...args) {
  return execFileSync('unzip', [...args, archive], { encoding: 'utf8' })
}

test('builds and independently extracts a versioned skills-only archive without changing sources', t => {
  const root = fixture(t)
  update(root, 'vibekit.config.json', config => { config.version = '2.3.4-rc.1+test' })
  for (const path of ['hooks', '.git', 'docs']) {
    mkdirSync(join(root, path))
    writeFileSync(join(root, path, 'unrelated.txt'), 'do not package')
  }
  writeFileSync(join(root, '.env'), 'do not package')
  const startup = join(root, 'skills/using-vibekit/SKILL.md')
  const original = readFileSync(startup, 'utf8')
  const skill = join(root, 'skills/lazy/SKILL.md')
  const originalSkill = readFileSync(skill, 'utf8')
  mkdirSync(join(root, 'skills/lazy/references'))
  writeFileSync(join(root, 'skills/lazy/references/check.md'), 'Resource included.\n')
  writeFileSync(skill, `${originalSkill}\n[Resource](references/check.md)\n\n\`docs/specs/future.md\`\n\n\`\`\`md\n[Future document](docs/future.md)\n\`\`\`\n`)
  const expectedSkill = readFileSync(skill, 'utf8')
  const { artifact, skills } = buildSubmission({ sourceRoot: root })
  assert.equal(artifact, join(root, 'dist/openai/vibekit-2.3.4-rc.1+test.zip'))
  const entries = unzip(artifact, '-Z1').trim().split('\n')
  const expectedSkills = readdirSync(join(root, 'skills')).sort()
  assert.deepEqual(skills, expectedSkills)
  assert.equal(entries.length, skills.length + 7)
  assert.ok(entries.includes('skills/lazy/references/check.md'))
  for (const entry of entries) assert.match(entry, /^(?:\.codex-plugin\/plugin\.json|skills\/[^/]+\/.+|AGENTS\.md|LICENSE|PRIVACY\.md|README\.md|assets\/icon\.svg)$/)
  const extracted = join(root, 'extracted')
  mkdirSync(extracted)
  execFileSync('unzip', ['-q', artifact, '-d', extracted])
  const manifest = JSON.parse(readFileSync(join(extracted, '.codex-plugin/plugin.json'), 'utf8'))
  assert.equal(manifest.version, '2.3.4-rc.1+test')
  assert.equal(manifest.name, 'vibekit')
  const listing = JSON.parse(readFileSync(join(root, 'submission/interface.json'), 'utf8'))
  assert.equal(manifest.interface.privacyPolicyURL, listing.privacyPolicyURL)
  assert.equal(manifest.interface.supportURL, listing.supportURL)
  assert.deepEqual(Object.keys(manifest).sort(), ['author', 'description', 'extensions', 'interface', 'name', 'skills', 'version'])
  assert.deepEqual(Object.keys(manifest.extensions['com.openai']), ['onboardingSkill'])
  for (const resource of [manifest.skills, manifest.interface.logo, manifest.interface.composerIcon, manifest.extensions['com.openai'].onboardingSkill]) assert.ok(existsSync(resolve(extracted, resource)), resource)
  for (const name of skills) assert.ok(existsSync(join(extracted, 'skills', name, 'SKILL.md')))
  const staged = readFileSync(join(extracted, 'skills/using-vibekit/SKILL.md'), 'utf8')
  assert.match(staged, /\[auto-trigger table\]\(\.\.\/\.\.\/AGENTS\.md\)/)
  assert.match(staged, /If no dedicated invocation tool is available/)
  assert.match(staged, /Activate Vibekit explicitly/)
  assert.match(staged, /System and developer instructions take precedence/)
  assert.doesNotMatch(staged, /CLAUDE\.md|Use the `Skill` tool/)
  assert.match(readFileSync(join(extracted, 'AGENTS.md'), 'utf8'), /\| `brainstorm` \| hard \|/)
  assert.equal(readFileSync(join(extracted, 'README.md'), 'utf8'), readFileSync(join(root, 'submission/README.md'), 'utf8'))
  assert.equal(readFileSync(join(extracted, 'PRIVACY.md'), 'utf8'), readFileSync(join(root, 'PRIVACY.md'), 'utf8'))
  assert.equal(readFileSync(startup, 'utf8'), original)
  assert.equal(readFileSync(skill, 'utf8'), expectedSkill)
  assert.equal(readFileSync(join(extracted, 'skills/lazy/SKILL.md'), 'utf8'), expectedSkill)
  assert.ok(!existsSync(join(extracted, 'plugin.json')))
})

const invalidListings = [
  ['missing required field', listing => { delete listing.displayName }, /displayName/],
  ['long subtitle', listing => { listing.shortDescription = 'x'.repeat(31) }, /shortDescription/],
  ['long description', listing => { listing.longDescription = 'x'.repeat(4001) }, /longDescription/],
  ['too many capabilities', listing => { listing.capabilities = Array(21).fill('x') }, /capabilities/],
  ['invalid capability', listing => { listing.capabilities = [''] }, /capability/],
  ['insecure website', listing => { listing.websiteURL = 'http://example.com' }, /HTTPS/],
  ['website credentials', listing => { listing.websiteURL = 'https://user:password@example.com' }, /HTTPS/],
  ['oversized prompt', listing => { listing.defaultPrompt = ['x'.repeat(129)] }, /defaultPrompt/],
  ['app reference', listing => { listing.apps = ['./apps.json'] }, /unsupported interface field/],
  ['icon traversal', listing => { listing.logo = './assets/../../LICENSE.svg' }, /unsafe package path/],
  ['absolute icon path', listing => { listing.logo = '/tmp/icon.svg' }, /must reference/],
  ['missing icon', listing => { listing.logo = './assets/missing.svg' }, /ENOENT/],
]

for (const key of ['privacyPolicyURL', 'supportURL']) {
  for (const [name, value] of [
    ['missing', undefined],
    ['whitespace-only', '   '],
    ['malformed', 'not a URL'],
    ['insecure', 'http://example.com'],
    ['credentials', 'https://user:password@example.com'],
    ['oversized', `https://example.com/${'x'.repeat(1024)}`],
  ]) {
    invalidListings.push([`${name} ${key}`, listing => {
      if (value === undefined) delete listing[key]
      else listing[key] = value
    }, new RegExp(`interface\\.${key}`)])
  }
}

for (const [name, mutate, error] of invalidListings) {
  test(`rejects ${name} and preserves a preexisting artifact`, t => {
    const root = fixture(t)
    const destination = join(root, 'existing.zip')
    writeFileSync(destination, 'previous artifact')
    update(root, 'submission/interface.json', mutate)
    assert.throws(() => buildSubmission({ sourceRoot: root, destination }), error)
    assert.equal(readFileSync(destination, 'utf8'), 'previous artifact')
    assert.ok(!readdirSync(root).some(name => name.startsWith('.vibekit-archive-')))
  })
}

test('missing policy preserves a preexisting artifact', t => {
  const root = fixture(t)
  const destination = join(root, 'existing.zip')
  writeFileSync(destination, 'previous artifact')
  rmSync(join(root, 'PRIVACY.md'))
  assert.throws(() => buildSubmission({ sourceRoot: root, destination }), /ENOENT.*PRIVACY\.md/)
  assert.equal(readFileSync(destination, 'utf8'), 'previous artifact')
  assert.ok(!readdirSync(root).some(name => name.startsWith('.vibekit-archive-')))
})

for (const [name, path, value, error] of [
  ['semantic version', 'version', '../outside', /semantic version/],
  ['identity name', 'name', 'x'.repeat(65), /config.name/],
  ['identity description', 'description', 'x'.repeat(4001), /config.description/],
  ['missing bootstrap', 'bootstrap', 'missing', /not an existing skill/],
]) {
  test(`rejects invalid ${name}`, t => {
    const root = fixture(t)
    update(root, 'vibekit.config.json', config => { config[path] = value })
    assert.throws(() => buildSubmission({ sourceRoot: root }), error)
  })
}

for (const link of ['missing.md', '../../../../outside.md', '/tmp/outside.md', 'file:///tmp/outside.md', '%2e%2e/%2e%2e/%2e%2e/outside.md']) {
  test(`rejects unsafe or dangling local skill link ${link}`, t => {
    const root = fixture(t)
    const path = join(root, 'skills/lazy/SKILL.md')
    writeFileSync(path, `${readFileSync(path, 'utf8')}\n[Resource](${link})\n`)
    assert.throws(() => buildSubmission({ sourceRoot: root }), /resource link/)
  })
}

test('rejects nested and top-level symbolic links', t => {
  const root = fixture(t)
  const nested = join(root, 'skills/lazy/link.md')
  symlinkSync(join(root, 'LICENSE'), nested)
  assert.throws(() => buildSubmission({ sourceRoot: root }), /symbolic links/)
  rmSync(nested)
  symlinkSync(join(root, 'skills/lazy'), join(root, 'skills/linked'))
  assert.throws(() => buildSubmission({ sourceRoot: root }), /symbolic links/)
})

test('rejects resource directories reached through symbolic links', t => {
  const root = fixture(t)
  const assets = join(root, 'submission/assets')
  cpSync(assets, join(root, 'other-assets'), { recursive: true })
  rmSync(assets, { recursive: true })
  symlinkSync(join(root, 'other-assets'), assets)
  assert.throws(() => buildSubmission({ sourceRoot: root }), /symbolic links/)
})

for (const path of ['.env', 'private.key', 'hooks/runner.json', 'apps/config.json']) {
  test(`rejects forbidden skill resource ${path}`, t => {
    const root = fixture(t)
    const file = join(root, 'skills/lazy', path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, 'unexpected resource')
    assert.throws(() => buildSubmission({ sourceRoot: root }), /forbidden staged entry/)
  })
}

test('rejects common private key signatures in resources', t => {
  const root = fixture(t)
  writeFileSync(join(root, 'skills/lazy/leak.txt'), PRIVATE_KEY_HEADER)
  assert.throws(() => buildSubmission({ sourceRoot: root }), /possible secret/)
})

for (const svg of ['<svg viewBox="0 0 32 32"></svg>', '<svg viewBox="0 0 128 64"></svg>', '<svg viewBox="0 0 128 128"><script/></svg>', '<svg viewBox="0 0 128 128"><image href="https://example.com/icon"/></svg>']) {
  test(`rejects invalid icon ${svg}`, t => {
    const root = fixture(t)
    writeFileSync(join(root, 'submission/assets/icon.svg'), svg)
    assert.throws(() => buildSubmission({ sourceRoot: root }), /icon must/)
  })
}

test('source adaptation mismatch fails without replacing an existing artifact', t => {
  const root = fixture(t)
  const destination = join(root, 'keep.zip')
  writeFileSync(destination, 'previous archive')
  const path = join(root, 'skills/using-vibekit/SKILL.md')
  writeFileSync(path, readFileSync(path, 'utf8').replace('Use the `Skill` tool.', 'Invoke skills differently.'))
  assert.throws(() => buildSubmission({ sourceRoot: root, destination }), /startup adaptation mismatch/)
  assert.equal(readFileSync(destination, 'utf8'), 'previous archive')
})

test('missing native tools produce a prerequisite error and preserve the destination', t => {
  const root = fixture(t)
  const destination = join(root, 'keep.zip')
  const tools = join(root, 'empty-path')
  mkdirSync(tools)
  writeFileSync(destination, 'previous archive')
  const originalPath = process.env.PATH
  try {
    process.env.PATH = tools
    assert.throws(() => buildSubmission({ sourceRoot: root, destination }), /required native tool 'zip' is unavailable/)
  } finally {
    process.env.PATH = originalPath
  }
  assert.equal(readFileSync(destination, 'utf8'), 'previous archive')
})

test('an archive command failure preserves the destination and cleans temporary output', t => {
  const root = fixture(t)
  const destination = join(root, 'keep.zip')
  const tools = join(root, 'fake-tools')
  mkdirSync(tools)
  writeFileSync(join(tools, 'zip'), `#!${process.execPath}\nif (process.argv.includes('-v')) process.exit(0)\nconsole.error('intentional archive failure')\nprocess.exit(42)\n`, { mode: 0o755 })
  writeFileSync(destination, 'previous archive')
  const originalPath = process.env.PATH
  try {
    process.env.PATH = `${tools}:${originalPath}`
    assert.throws(() => buildSubmission({ sourceRoot: root, destination }), /zip failed: intentional archive failure/)
  } finally {
    process.env.PATH = originalPath
  }
  assert.equal(readFileSync(destination, 'utf8'), 'previous archive')
  assert.ok(!readdirSync(root).some(name => name.startsWith('.vibekit-archive-')))
})
