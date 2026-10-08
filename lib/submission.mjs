import { execFileSync } from 'node:child_process'
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { buildModel } from './model.mjs'
import { triggerTable } from './table.mjs'

const LIMITS = { displayName: 30, shortDescription: 30, longDescription: 4000, developerName: 80, category: 80, websiteURL: 1024, logo: 1024, composerIcon: 1024 }
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
const FORBIDDEN_PART = /^(?:\..*|hooks?|apps?|node_modules|secrets?|credentials?)(?:$|[.])|\.(?:pem|key|p12|pfx)$/i
const SECRET = /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}|\bAKIA[A-Z0-9]{16}\b/

function string(value, label, limit = Infinity) {
  if (typeof value !== 'string' || !value.trim() || [...value].length > limit) {
    throw new Error(`${label} must be a nonempty string of at most ${limit} characters`)
  }
}

function safeRelative(path) {
  if (typeof path !== 'string' || !path || isAbsolute(path) || /[\\\x00-\x1f:]/.test(path) || path.split('/').includes('..')) {
    throw new Error(`unsafe package path: ${path}`)
  }
  return path.replace(/^\.\//, '').replace(/\/$/, '')
}

// Check every component, so a regular file below a symlink is refused too.
function sourcePath(root, path) {
  const clean = safeRelative(path)
  let current = root
  for (const part of clean.split('/')) {
    current = join(current, part)
    const stat = lstatSync(current)
    if (stat.isSymbolicLink()) throw new Error(`symbolic links are not allowed: ${path}`)
  }
  const actual = realpathSync(current)
  if (relative(root, actual).startsWith(`..${sep}`) || isAbsolute(relative(root, actual))) {
    throw new Error(`source path is outside source tree: ${path}`)
  }
  return current
}

function walk(root, path, visit) {
  const absolute = sourcePath(root, path)
  const stat = lstatSync(absolute)
  if (stat.isDirectory()) {
    for (const entry of readdirSync(absolute).sort()) walk(root, `${path}/${entry}`, visit)
  } else if (stat.isFile()) {
    visit(path, readFileSync(absolute))
  } else {
    throw new Error(`only regular files and directories are allowed: ${path}`)
  }
}

function validateListing(listing) {
  if (!listing || typeof listing !== 'object' || Array.isArray(listing)) throw new Error('interface must be an object')
  const supported = new Set([...Object.keys(LIMITS), 'capabilities', 'defaultPrompt'])
  for (const key of Object.keys(listing)) {
    if (!supported.has(key)) throw new Error(`unsupported interface field: ${key}`)
  }
  for (const [key, limit] of Object.entries(LIMITS)) string(listing[key], `interface.${key}`, limit)
  const website = new URL(listing.websiteURL)
  if (website.protocol !== 'https:' || website.username || website.password) throw new Error('interface.websiteURL must use HTTPS without credentials')
  if (!Array.isArray(listing.capabilities) || listing.capabilities.length > 20) throw new Error('interface.capabilities must be an array of at most 20 labels')
  for (const capability of listing.capabilities) string(capability, 'capability', 120)
  if (listing.defaultPrompt !== undefined) {
    const prompts = Array.isArray(listing.defaultPrompt) ? listing.defaultPrompt : [listing.defaultPrompt]
    if (!prompts.length || prompts.length > 3 || new Set(prompts).size !== prompts.length) throw new Error('defaultPrompt must contain one to three unique prompts')
    for (const prompt of prompts) {
      string(prompt, 'defaultPrompt', 128)
      if (prompt.includes('@')) throw new Error('defaultPrompt must omit app mentions')
    }
  }
}

function validateIcon(data, path) {
  const svg = data.toString('utf8')
  if (data.length > 5 * 1024 * 1024) throw new Error(`icon exceeds 5 MiB: ${path}`)
  // This package accepts a deliberately small geometric SVG subset.
  const tags = [...svg.matchAll(/<\/?([\w:-]+)/g)].map(match => match[1])
  if (!tags.length || tags.some(tag => !['svg', 'rect', 'path', 'circle', 'polygon', 'polyline', 'line', 'ellipse', 'g', 'title', 'desc'].includes(tag)) || /<!|<\?|\bon\w+\s*=|href\s*=|url\s*\(|style\s*=|@import|&/i.test(svg)) {
    throw new Error(`icon must be a self-contained geometric SVG: ${path}`)
  }
  const opening = /^\s*<svg\b([^>]*)>/.exec(svg)
  const viewBox = /\bviewBox="([^"]+)"/.exec(opening?.[1] ?? '')
  const dimensions = viewBox?.[1].trim().split(/[\s,]+/).map(Number)
  if (!dimensions || dimensions.length !== 4 || !dimensions.every(Number.isFinite) || dimensions[2] < 48 || dimensions[2] !== dimensions[3]) {
    throw new Error(`icon must have a square numeric viewBox of at least 48 by 48: ${path}`)
  }
  const width = /\bwidth="([^"]+)"/.exec(opening[1])?.[1]
  const height = /\bheight="([^"]+)"/.exec(opening[1])?.[1]
  if ((width !== undefined || height !== undefined) && (!/^\d+(?:\.\d+)?$/.test(width ?? '') || Number(width) !== Number(height) || Number(width) < 48)) {
    throw new Error(`icon dimensions must be square and numeric: ${path}`)
  }
}

function adaptStartup(text) {
  const replacements = [
    ['Every skill declares its own trigger, and the auto-trigger table in `CLAUDE.md` is generated from those declarations, so it is never out of date. Read the table, not a copy of it.', 'Every skill declares its own trigger. Read the generated [auto-trigger table](../../AGENTS.md), which is bundled as a resource. A plugin-root AGENTS.md is not assumed to load automatically.'],
    ["Use the `Skill` tool. The skill's content loads and you follow it directly. Never read a skill file as a substitute for invoking it: reading gives you the text without the commitment.", 'Use the skill invocation mechanism provided by Codex. If no dedicated invocation tool is available, read the matching bundled skills/<name>/SKILL.md file, resolved from this plugin root, and follow its instructions. Resolve sibling skills relative to this file when needed.'],
    ['1. **The user\'s explicit instructions**: highest. If they say "skip the design step", skip it.\n2. **vibekit skills**: these override default behaviour where they conflict.\n3. **The default system prompt**: lowest.', 'Follow the platform instruction hierarchy. System and developer instructions take precedence over user instructions, and bundled skill guidance cannot override them. Follow the user\'s explicit instructions within those constraints, including a request to skip a design step.'],
  ]
  for (const [expected, replacement] of replacements) {
    if (text.split(expected).length !== 2) throw new Error('startup adaptation mismatch: expected source instruction changed')
    text = text.replace(expected, replacement)
  }
  return `${text}\n## Activation in Codex\n\nActivate Vibekit explicitly after installation by asking Codex to use the using-vibekit skill. This submission has no lifecycle startup hooks. Re-activate it in a new conversation when needed.\n`
}

function validateLinks(stage, path) {
  // Fenced examples describe future project files, not bundled dependencies.
  const text = readFileSync(join(stage, path), 'utf8').replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*(?:\n|$)/gm, '')
  const links = [
    ...text.matchAll(/!?\[[^\]\n]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["'][^\n]*["'])?\s*\)/g),
    ...text.matchAll(/^\s*\[[^\]\n]+\]:\s*(<[^>]+>|\S+)/gm),
  ]
  for (const match of links) {
    const link = match[1].replace(/^<|>$/g, '')
    if (/^(?:https?:|mailto:|#)/i.test(link)) continue
    let local
    try { local = decodeURIComponent(link.split(/[?#]/)[0]) } catch { throw new Error(`invalid resource link in ${path}: ${link}`) }
    if (!local) continue
    if (isAbsolute(local) || /[\\\x00-\x1f:]/.test(local)) throw new Error(`unsafe resource link in ${path}: ${link}`)
    const target = relative(stage, resolve(stage, dirname(path), local)).split(sep).join('/')
    try { sourcePath(stage, target) } catch (error) { throw new Error(`invalid local resource link in ${path}: ${link}: ${error.message}`) }
  }
}

function tool(name, args, options = {}) {
  try { return execFileSync(name, args, { encoding: 'utf8', ...options }) } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`required native tool '${name}' is unavailable, install zip and unzip`)
    throw new Error(`${name} failed: ${error.stderr?.toString().trim() || error.message}`)
  }
}

export function buildSubmission({ sourceRoot, destination } = {}) {
  const root = realpathSync(sourceRoot)
  const config = JSON.parse(readFileSync(sourcePath(root, 'vibekit.config.json'), 'utf8'))
  for (const key of ['name', 'version', 'description', 'bootstrap']) string(config[key], `config.${key}`, { name: 64, description: 4000 }[key])
  string(config.author?.name, 'config.author.name', 120)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.name)) throw new Error('config.name must be a lowercase plugin identifier')
  if (!SEMVER.test(config.version)) throw new Error('config.version must be a semantic version')
  safeRelative(config.bootstrap)
  const listing = JSON.parse(readFileSync(sourcePath(root, 'submission/interface.json'), 'utf8'))
  validateListing(listing)
  const skillsRoot = sourcePath(root, 'skills')
  for (const entry of readdirSync(skillsRoot)) {
    if (lstatSync(join(skillsRoot, entry)).isSymbolicLink()) throw new Error(`symbolic links are not allowed: skills/${entry}`)
  }
  const model = buildModel(config, skillsRoot)
  if (!model.skills.length) throw new Error('submission requires at least one skill')
  const artifact = resolve(destination ?? join(root, 'dist/openai', `${config.name}-${config.version}.zip`))
  if (!artifact.endsWith('.zip')) throw new Error('submission destination must end in .zip')
  tool('zip', ['-v'])
  tool('unzip', ['-v'])
  const stage = mkdtempSync(join(tmpdir(), 'vibekit-submission-'))
  let archiveDirectory
  try {
    const files = new Set()
    function put(path, data) {
      path = safeRelative(path)
      if (files.has(path)) throw new Error(`duplicate staged path: ${path}`)
      if (path !== '.codex-plugin/plugin.json' && path.split('/').some(part => FORBIDDEN_PART.test(part))) throw new Error(`forbidden staged entry: ${path}`)
      if (SECRET.test(data.toString('utf8'))) throw new Error(`possible secret in staged entry: ${path}`)
      mkdirSync(join(stage, dirname(path)), { recursive: true })
      writeFileSync(join(stage, path), data)
      files.add(path)
    }
    for (const skill of model.skills) {
      walk(root, `skills/${skill.dir}`, (path, data) => {
        if (path === `skills/${config.bootstrap}/SKILL.md`) data = adaptStartup(data.toString('utf8'))
        put(path, data)
      })
    }
    put('AGENTS.md', `# Vibekit trigger reference\n\nRead this resource from the startup skill after explicit activation. Its location at the plugin root does not make it automatic Codex configuration.\n\n${triggerTable(model.skills)}\n`)
    put('LICENSE', readFileSync(sourcePath(root, 'LICENSE')))
    put('README.md', readFileSync(sourcePath(root, 'submission/README.md')))
    for (const key of ['logo', 'composerIcon']) {
      if (!listing[key].startsWith('./assets/') || !listing[key].endsWith('.svg')) throw new Error(`interface.${key} must reference ./assets/*.svg`)
      const path = safeRelative(listing[key])
      const data = readFileSync(sourcePath(root, `submission/${path}`))
      validateIcon(data, path)
      if (!files.has(path)) put(path, data)
    }
    const manifest = {
      name: config.name,
      version: config.version,
      description: config.description,
      author: { name: config.author.name },
      skills: './skills/',
      interface: listing,
      extensions: { 'com.openai': { onboardingSkill: `./skills/${config.bootstrap}/SKILL.md` } },
    }
    put('.codex-plugin/plugin.json', `${JSON.stringify(manifest, null, 2)}\n`)
    for (const path of [manifest.skills, manifest.extensions['com.openai'].onboardingSkill, listing.logo, listing.composerIcon]) sourcePath(stage, path)
    for (const path of files) {
      if (path.endsWith('.md')) validateLinks(stage, path)
    }
    walk(stage, '.', path => {
      const clean = path.replace(/^\.\//, '')
      if (!files.has(clean)) throw new Error(`unexpected staged entry: ${clean}`)
    })
    mkdirSync(dirname(artifact), { recursive: true })
    archiveDirectory = mkdtempSync(join(dirname(artifact), '.vibekit-archive-'))
    const temporary = join(archiveDirectory, 'submission.zip')
    const entries = [...files].sort()
    tool('zip', ['-q', '-X', temporary, ...entries], { cwd: stage })
    tool('unzip', ['-t', temporary])
    const archived = tool('unzip', ['-Z1', temporary]).trim().split('\n').sort()
    if (JSON.stringify(archived) !== JSON.stringify(entries)) throw new Error('archive entries differ from validated stage')
    renameSync(temporary, artifact)
    return { artifact, skills: model.skills.map(skill => skill.name) }
  } finally {
    rmSync(stage, { recursive: true, force: true })
    if (archiveDirectory) rmSync(archiveDirectory, { recursive: true, force: true })
  }
}
