// evals/run.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { runSession } from './session.mjs'
import { scoreScenario, compare } from './score.mjs'
import { materialise, remove } from './worktree.mjs'

export function parseArgs(argv) {
  const value = flag => {
    const i = argv.indexOf(flag)
    return i === -1 ? null : argv[i + 1]
  }
  const list = value('--scenarios')
  const n = value('-n')
  return {
    baseline: value('--baseline'),
    candidate: value('--candidate') ?? 'HEAD',
    judge: argv.includes('--judge'),
    dryRun: argv.includes('--dry-run'),
    scenarios: list ? list.split(',') : null,
    n: n ? Number(n) : null,
  }
}

export function planRuns(scenarios, opts) {
  const selected = opts.scenarios ? scenarios.filter(s => opts.scenarios.includes(s.id)) : scenarios
  const variants = [['candidate', opts.candidate]]
  if (opts.baseline) variants.push(['baseline', opts.baseline])

  const runs = []
  for (const [variant, ref] of variants) {
    for (const scenario of selected) {
      const repeats = opts.n ?? scenario.n ?? 3
      for (let i = 0; i < repeats; i++) runs.push({ variant, ref, scenario, i })
    }
  }
  return runs
}

export function formatPlan(runs, opts) {
  const lines = [
    `${runs.length} sessions${opts.judge ? ` + ${runs.length} judge calls` : ''}`,
    `candidate: ${opts.candidate}`,
  ]
  if (opts.baseline) lines.push(`baseline: ${opts.baseline}`)
  for (const [id, count] of Object.entries(
    runs.reduce((acc, r) => ({ ...acc, [`${r.variant}:${r.scenario.id}`]: (acc[`${r.variant}:${r.scenario.id}`] ?? 0) + 1 }), {}),
  )) {
    lines.push(`  ${id} x${count}`)
  }
  return lines.join('\n')
}

function requireClaude() {
  const probe = spawnSync('claude', ['--version'], { encoding: 'utf8' })
  if (probe.status !== 0) {
    throw new Error('claude CLI not available or not authenticated — cannot run evals')
  }
}

// The judge is the same claude binary, so it adds no dependency. Opt-in because
// it doubles session count and cost.
export function judgeTranscript(scenario, transcript, spawn) {
  const rubric = readFileSync('evals/judge.md', 'utf8')
  const prompt = `${rubric}\n\nSKILL: ${scenario.expect?.skill ?? '(none)'}\n\nTRANSCRIPT:\n${transcript}`
  const proc = spawn('claude', ['-p', prompt, '--output-format', 'json', '--model', 'haiku'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  try {
    const outer = JSON.parse(proc.stdout ?? '')
    return JSON.parse(outer.result)
  } catch {
    return { judge_error: true, followed: null, score: null, why: 'unparseable judge output' }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const scenarios = JSON.parse(readFileSync('evals/scenarios.json', 'utf8'))
  const thresholds = JSON.parse(readFileSync('evals/thresholds.json', 'utf8'))
  const runs = planRuns(scenarios, opts)

  console.log(formatPlan(runs, opts))
  if (opts.dryRun) {
    console.log('dry run — nothing spawned')
    return 0
  }

  requireClaude()

  const worktrees = {}
  const byVariant = { candidate: {}, baseline: {} }
  try {
    for (const run of runs) {
      worktrees[run.ref] ??= materialise(run.ref)
      const result = runSession(run.scenario, worktrees[run.ref])
      if (opts.judge && result.ok) result.judge = judgeTranscript(run.scenario, result.raw, spawnSync)
      ;(byVariant[run.variant][run.scenario.id] ??= []).push(result)
      process.stdout.write(result.ok ? '.' : 'E')
    }
  } finally {
    process.stdout.write('\n')
    for (const path of Object.values(worktrees)) remove(path)
  }

  const score = groups =>
    Object.fromEntries(
      Object.entries(groups).map(([id, results]) => [
        id,
        scoreScenario(scenarios.find(s => s.id === id), results),
      ]),
    )

  const candidate = score(byVariant.candidate)
  const baseline = opts.baseline ? score(byVariant.baseline) : null
  const verdict = compare(candidate, baseline, thresholds)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  mkdirSync('evals/results', { recursive: true })
  const out = `evals/results/${stamp}-${opts.candidate.replace(/[^\w.-]/g, '_')}.json`
  // The runner writes the file; committing it is a human step. A runner that
  // auto-commits would fight the review pipeline.
  writeFileSync(out, `${JSON.stringify({ opts, candidate, baseline, verdict }, null, 2)}\n`)
  console.log(`results: ${out}`)

  for (const [id, r] of Object.entries(candidate)) {
    const rate = r.incomplete ? 'incomplete' : r.rate.toFixed(2)
    console.log(`  ${id}: rate=${rate} footprint=${r.inputFootprint ?? '-'} errors=${r.errored}`)
  }

  if (!verdict.pass) {
    console.error('FAIL')
    for (const f of verdict.failures) console.error(`  ${f}`)
    return 1
  }
  console.log('PASS')
  return 0
}

if (process.argv[1] && process.argv[1].endsWith('run.mjs')) {
  main().then(code => process.exit(code)).catch(error => {
    console.error(`vibekit-eval: ${error.message}`)
    process.exit(1)
  })
}
