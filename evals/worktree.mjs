// evals/worktree.mjs
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve('.eval-worktrees')

function git(args) {
  const proc = spawnSync('git', args, { encoding: 'utf8' })
  if (proc.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${proc.stderr.trim()}`)
  return proc.stdout.trim()
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
  if (!resolve(path).startsWith(ROOT)) {
    throw new Error(`refusing to remove ${path}: outside ${ROOT}`)
  }
  if (!existsSync(path)) return
  git(['worktree', 'remove', path]) // no --force: a dirty worktree should fail loudly
}
