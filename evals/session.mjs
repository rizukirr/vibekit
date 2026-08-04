// evals/session.mjs
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseTranscript } from './parse.mjs'

// Sessions run with edits permitted, because "did the agent write code before
// invoking the skill" is the thing being measured — plan mode would block the
// very action under observation. Safety comes from the cwd being a throwaway
// temp directory, never the repo.
export function runSession(scenario, pluginDir, spawn = spawnSync) {
  const cwd = mkdtempSync(join(tmpdir(), 'vibekit-eval-'))
  try {
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
    return { ...parsed, raw: stdout, contains: needle => stdout.includes(needle) }
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
}
