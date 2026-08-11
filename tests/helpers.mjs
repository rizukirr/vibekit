// tests/helpers.mjs
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Creates a throwaway skills/ tree. `skills` maps directory name → SKILL.md text.
// Returns the directory path plus a cleanup function.
export function makeSkillsDir(skills) {
  const root = mkdtempSync(join(tmpdir(), 'vibekit-test-'))
  for (const [dir, contents] of Object.entries(skills)) {
    mkdirSync(join(root, dir), { recursive: true })
    if (contents !== null) writeFileSync(join(root, dir, 'SKILL.md'), contents)
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

export function skillFile({ name, description = 'does a thing', trigger = 'when X', extra = '' }) {
  return `---\nname: ${name}\ndescription: ${description}\ntrigger: ${trigger}\n${extra}---\n\nbody\n`
}

// A fixed model, used by every emitter test so their expected output is stable.
export const MODEL = {
  config: {
    name: 'vibekit',
    version: '0.6.0',
    description: 'Guardrailed vibe-coding pipeline for coding agents.',
    author: { name: 'rizukirr', url: 'https://github.com/rizukirr' },
    license: 'MIT',
    homepage: 'https://github.com/rizukirr/vibekit',
    repository: 'https://github.com/rizukirr/vibekit',
    bootstrap: 'using-vibekit',
    runtimes: ['claude-code', 'codex'],
    keywords: ['vibekit', 'skills'],
    npm: {
      name: '@rizukirr/vibekit',
      type: 'module',
      engines: { node: '>=24' },
      scripts: { check: 'node bin/generate.mjs --check' },
      publishConfig: { access: 'public' },
    },
  },
  skills: [
    { name: 'alpha', description: 'Alpha does A.', trigger: 'When A happens', command: true, gate: 'hard', dir: 'alpha' },
    { name: 'beta', description: 'Beta does B.', trigger: 'When B happens', command: false, gate: 'none', dir: 'beta' },
  ],
}
