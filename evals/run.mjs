// evals/run.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { runSession } from './session.mjs'
import { scoreScenario, compare } from './score.mjs'
import { materialise, remove } from './worktree.mjs'

export function parseArgs(argv) {
  const value = flag => {
    const i = argv.indexOf(flag)
    if (i === -1) return null
    const next = argv[i + 1]
    // A flag's value must never be another flag: `--scenarios --judge` is a
    // typo, not a scenario named "--judge".
    if (next === undefined || next.startsWith('-')) {
      throw new Error(`${flag} requires a value`)
    }
    return next
  }

  const list = value('--scenarios')
  const n = value('-n')
  if (n !== null && !Number.isInteger(Number(n))) {
    throw new Error(`-n must be an integer, got '${n}'`)
  }

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

// Every check here is about malformed input. The harness reports a verdict, so
// the one thing it must never do is report PASS without having measured
// anything — a green result with nothing behind it is worse than a crash,
// because it looks like success and gets committed as trend history.
export function validatePlan(runs, scenarios, opts, thresholds) {
  const known = new Set(scenarios.map(s => s.id))

  if (opts.scenarios) {
    const unknown = opts.scenarios.filter(id => !known.has(id))
    if (unknown.length) throw new Error(`unknown scenario id(s): ${unknown.join(', ')}`)
  }

  const ghosts = Object.keys(thresholds.scenarios ?? {}).filter(id => !known.has(id))
  if (ghosts.length) {
    throw new Error(`thresholds.json names unknown scenario(s): ${ghosts.join(', ')}`)
  }

  if (runs.length === 0) {
    throw new Error('no sessions planned — refusing to report a result for zero measurements')
  }
}

// Measured per-session cost ranges, taken from real runs recorded in
// evals/results/*.json — not estimated from token prices. Haiku sessions in this
// project ranged $0.0217 to $0.0887 depending on how much the session did.
// vibekit: flat per-model range, refine from historical results if the spread
// starts misleading people.
const COST_PER_SESSION = {
  haiku: [0.02, 0.09],
  sonnet: [0.10, 0.45],
  opus: [0.50, 2.00],
}
const DEFAULT_RANGE = COST_PER_SESSION.sonnet

export function estimateCost(runs, opts) {
  let low = 0
  let high = 0
  for (const run of runs) {
    const [lo, hi] = COST_PER_SESSION[run.scenario.model] ?? DEFAULT_RANGE
    low += lo
    high += hi
    // A judged run adds one grading call per successful session.
    if (opts.judge) {
      const [jlo, jhi] = COST_PER_SESSION.haiku
      low += jlo
      high += jhi
    }
  }
  return { sessions: runs.length, low, high }
}

export function formatPlan(runs, opts) {
  const est = estimateCost(runs, opts)
  const lines = [
    `${runs.length} sessions${opts.judge ? ` + ${runs.length} judge calls` : ''}` +
      ` — est. $${est.low.toFixed(2)}-$${est.high.toFixed(2)}`,
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

// N1: the rubric is identical for every call; re-reading it once per judged
// session was nine identical disk reads on a nine-session run.
let rubricCache = null
function rubric() {
  rubricCache ??= readFileSync('evals/judge.md', 'utf8')
  return rubricCache
}

// The judge is the same claude binary, so it adds no dependency. Opt-in because
// it doubles session count and cost.
export function judgeTranscript(scenario, transcript, spawn) {
  const prompt = `${rubric()}\n\nSKILL: ${scenario.expect?.skill ?? '(none)'}\n\nTRANSCRIPT:\n${transcript}`
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
  validatePlan(runs, scenarios, opts, thresholds)

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
    const judged = r.judge ? ` followed=${r.judge.followedRate.toFixed(2)} score=${r.judge.meanScore.toFixed(1)}` : ''
    console.log(`  ${id}: rate=${rate} footprint=${r.inputFootprint ?? '-'} errors=${r.errored}${judged}`)
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
