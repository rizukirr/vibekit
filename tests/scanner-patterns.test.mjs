// tests/scanner-patterns.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'

// The HOL catalog runs this proximity rule over every code file in a fresh clone
// and reports one high finding per matching file, per detected ecosystem. It never
// checks whether a shell is involved, so an argv array reaching execve directly
// still trips it. A high finding turns the catalog listing check red, which is why
// this is a guard and not a style preference.
// Copied from codex_plugin_scanner/checks/code_quality.py, SHELL_INJECT_RE.
const SHELL_INJECT = /`[^`]*\$\{[^}]+\}[^`]*`[\s\S]{0,30}\b(exec|spawn|execSync|spawnSync|os\.system|subprocess)\b/
const CODE_EXTS = new Set(['.py', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'])

// Tracked files only, which is what a clone of this repo contains. The scanner
// walks the checkout, so anything gitignored is out of its reach as well as ours.
function trackedCodeFiles() {
  const listing = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  return listing.split('\0').filter(path => path && CODE_EXTS.has(extname(path)))
}

test('no tracked code file trips the catalog scanner shell injection rule', () => {
  const files = trackedCodeFiles()

  // Without these the loop passes vacuously on an empty or truncated listing.
  assert.ok(files.length > 0, 'no code files found: the guard would pass vacuously')
  assert.ok(files.includes('evals/run.mjs'), 'the file this guard was written for must be covered')

  for (const path of files) {
    assert.ok(
      !SHELL_INJECT.test(readFileSync(path, 'utf8')),
      path + ' puts a template literal within thirty characters of a process token, which the catalog scanner reports as a high severity finding',
    )
  }
})
