// evals/session.mjs
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { parseTranscript } from './parse.mjs'

// A skill whose precondition is a file on disk cannot be measured in an empty
// directory. Seeding is what makes `plan` reachable at all: its gate is an
// approved spec, and the session starts with nothing.
function seedFiles(root, files = {}) {
  for (const [rel, contents] of Object.entries(files)) {
    const dest = join(root, rel)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, contents)
  }
}

const SKIP_DIRS = new Set(['node_modules', '.git'])
const MAX_FILE_BYTES = 256 * 1024
// A per-file cap does not bound the total: many medium files each pass the
// per-file guard and still exhaust memory together. Collection stops at the
// aggregate ceiling and says so, rather than growing without limit.
const MAX_TOTAL_BYTES = 8 * 1024 * 1024

// Transcript-only scoring can see that a skill fired; it cannot see what the
// skill wrote. The design this harness exists to test is a claim about the
// content of a produced file, so the file has to come back.
function collectFiles(root) {
  const out = {}
  let total = 0
  let truncated = false
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full)
      } else if (entry.isFile() && statSync(full).size <= MAX_FILE_BYTES) {
        const size = statSync(full).size
        if (total + size > MAX_TOTAL_BYTES) {
          truncated = true
          continue
        }
        total += size
        out[relative(root, full).split(sep).join('/')] = readFileSync(full, 'utf8')
      }
    }
  }
  walk(root)
  return { files: out, truncated }
}

// Sessions run with edits permitted, because "did the agent write code before
// invoking the skill" is the thing being measured — plan mode would block the
// very action under observation. Safety comes from the cwd being a throwaway
// temp directory, never the repo.
export function runSession(scenario, pluginDir, spawn = spawnSync) {
  const cwd = mkdtempSync(join(tmpdir(), 'vibekit-eval-'))
  try {
    seedFiles(cwd, scenario.files)
    const args = [
      '-p', scenario.prompt,
      '--output-format', 'stream-json',
      '--verbose', // required by the CLI whenever output-format is stream-json
      '--plugin-dir', pluginDir,
      '--permission-mode', 'bypassPermissions',
      // bypassPermissions would otherwise hand the session Bash, and a temp cwd
      // does not contain arbitrary command execution. Write/Edit stay available
      // because attempting them is the behaviour under measurement.
      '--disallowedTools', 'Bash',
    ]
    if (scenario.model) args.push('--model', scenario.model)

    const proc = spawn('claude', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    const stdout = proc.stdout ?? ''
    const parsed = parseTranscript(stdout)
    // `raw` is what the opt-in judge grades; `contains` backs the
    // transcriptContains expectation without re-reading the stream.
    // Collected inside the try, before the finally removes the directory.
    const { files, truncated } = collectFiles(cwd)
    return { ...parsed, raw: stdout, files, filesTruncated: truncated, seeded: scenario.files ?? {}, contains: needle => stdout.includes(needle) }
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}
