// evals/worktree.mjs
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = join(REPO, '.eval-worktrees')

function git(args) {
  // cwd is pinned to the repo so the harness works from any directory.
  const proc = spawnSync('git', args, { encoding: 'utf8', cwd: REPO })
  if (proc.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${proc.stderr.trim()}`)
  return proc.stdout.trim()
}

// N3: a string prefix test would accept a sibling like `.eval-worktrees-old`.
// path.relative answers the question actually being asked — is this path inside
// that directory — and rejects both siblings and `..` traversal.
function inside(root, target) {
  const rel = relative(root, resolve(target))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

// Materialises a ref as a throwaway worktree. Variants are git refs rather than
// directories in the repo: a second skills/ tree would drift from the real one,
// which is the failure this project was rebuilt to remove.
export function materialise(ref) {
  git(['rev-parse', '--verify', `${ref}^{commit}`]) // fail before spawning sessions
  const path = join(ROOT, ref.replace(/[^\w.-]/g, '_'))
  if (existsSync(path)) return path
  git(['worktree', 'add', '--detach', path, ref])
  return path
}

export function remove(path) {
  if (!inside(ROOT, path)) {
    throw new Error(`refusing to remove ${path}: outside ${ROOT}`)
  }
  if (!existsSync(path)) return
  git(['worktree', 'remove', path]) // no --force: a dirty worktree should fail loudly
}
