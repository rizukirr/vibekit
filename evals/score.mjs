// evals/score.mjs

const VERIFY = '→ verify:'

// The three numeric forms a clause may carry. Each names a property of the
// runtime rather than of the code under test, which is what makes it derivable
// without having run anything. A bare number is a predicted value — and a bare
// three-digit number is exactly the wrong-`wc -l` defect this check exists to
// catch, so an HTTP status has to be introduced by a context word to count.
// Spelled-out numbers count. This plan's own Task 3 clause claimed "the four
// new path-set cases" when Step 1 defined three — a wrong count that a
// digits-only check waves through, which is how the defect class this skill
// targets escaped its own test on the very first plan written under it.
const WORD = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|twenty|thirty|forty|fifty|hundred|thousand'
const THRESHOLD = 'at least|at most|no more than|no fewer than|fewer than|under|over|below|above'

const ALLOWED_NUMERIC = [
  // `exits?` — clauses say "exits 0" far more often than "exit 0"; a singular-
  // only pattern left a bare 0 behind and flagged its own plan.
  /\bexits?\s+\d+/gi,
  /\b(?:status|http|returns)\s+\d{3}\b/gi,
  new RegExp(`\\b(?:${THRESHOLD})\\s+(?:\\d+|${WORD})\\b`, 'gi'),
]

const BARE_WORD_NUMBER = new RegExp(`\\b(?:${WORD})\\b`, 'i')

export function verifyClauses(text) {
  return text
    .split('\n')
    .filter(line => line.includes(VERIFY))
    .map(line => line.slice(line.indexOf(VERIFY) + VERIFY.length))
}

export function isPredicate(clause) {
  // Backticks are not quotes here: a clause names its command in a code span,
  // and every clause in this repo's own plans does. Straight quotes are the
  // tell — a predicted transcript arrives as "FAIL with ...".
  if (/["']/.test(clause)) return false
  let rest = clause
  for (const re of ALLOWED_NUMERIC) rest = rest.replace(re, '')
  return !/\d/.test(rest) && !BARE_WORD_NUMBER.test(rest)
}

function satisfied(scenario, run) {
  const expect = scenario.expect ?? {}
  if (expect.skill !== undefined) {
    const hit = run.skills.find(s => s.name === expect.skill)
    if (!hit) return false
    for (const forbidden of expect.before ?? []) {
      const earlier = run.tools.find(t => t.name === forbidden && t.index < hit.index)
      if (earlier) return false
    }
    // `after` is `before`'s mirror over skills: each named skill must already
    // have fired. Without it a delegation scenario cannot tell "brainstorm
    // delegated to lazy" from "lazy fired on its own trigger" — both leave a
    // lazy invocation in the transcript, and only one of them is the thing
    // under test.
    for (const required of expect.after ?? []) {
      const earlier = run.skills.find(s => s.name === required && s.index < hit.index)
      if (!earlier) return false
    }
  }
  if (expect.transcriptContains !== undefined && !run.contains?.(expect.transcriptContains)) {
    return false
  }

  // Expectations over what the session wrote, not what it said. `plan`'s
  // observable criteria are properties of a file on disk, and a transcript
  // cannot carry them.
  const produced = run.files ?? {}
  const seeded = run.seeded ?? {}

  if (expect.fileMatching !== undefined) {
    const re = new RegExp(expect.fileMatching)
    if (!Object.keys(produced).some(p => re.test(p))) return false
  }

  if (expect.onlyNewFilesMatching !== undefined) {
    const re = new RegExp(expect.onlyNewFilesMatching)
    for (const [path, contents] of Object.entries(produced)) {
      // A modified seed counts as writing outside the allowed path, since the
      // approved artefact is the one thing a planning skill must not edit.
      if (path in seeded) {
        if (seeded[path] !== contents) return false
        continue
      }
      if (!re.test(path)) return false
    }
  }

  // Seeded files are excluded throughout: they are the fixture, not the work,
  // and a spec that discusses verify clauses in prose would otherwise fail a
  // check aimed at the plan the session wrote.
  const written = Object.entries(produced).filter(([path]) => !(path in seeded))

  if (expect.verifyClauses === 'predicate') {
    for (const [, contents] of written) {
      if (!verifyClauses(contents).every(isPredicate)) return false
    }
  }

  if (expect.tasksHaveVerify) {
    for (const [, contents] of written) {
      const headers = contents.split('\n').filter(line => /^###\s+Task\s+\d+/.test(line))
      if (!headers.every(line => line.includes(VERIFY))) return false
    }
  }
  return true
}

const mean = xs => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length)

export function scoreScenario(scenario, runs) {
  const good = runs.filter(r => r.ok)
  const errored = runs.length - good.length

  // No successful run is "incomplete", not a zero rate. A zero rate says the
  // skill failed to fire; incomplete says we never got to find out.
  if (good.length === 0) {
    return { id: scenario.id, rate: null, incomplete: true, successful: 0, errored, inputFootprint: null, outputTokens: null, cost: null, judge: null }
  }

  // W2: a judged run costs a second model call per session. Summarising it here
  // is what makes that spend readable — previously the verdict was attached to
  // the run object and then dropped when the summary was written.
  const graded = good.filter(r => r.judge && !r.judge.judge_error)
  const judge = graded.length === 0
    ? null
    : {
        graded: graded.length,
        followedRate: graded.filter(r => r.judge.followed).length / graded.length,
        meanScore: mean(graded.map(r => r.judge.score ?? 0)),
        errors: good.filter(r => r.judge?.judge_error).length,
      }

  return {
    id: scenario.id,
    rate: good.filter(r => satisfied(scenario, r)).length / good.length,
    incomplete: false,
    successful: good.length,
    errored,
    inputFootprint: mean(good.map(r => r.usage?.cache_creation_input_tokens ?? 0)),
    outputTokens: mean(good.map(r => r.usage?.output_tokens ?? 0)),
    cost: mean(good.map(r => r.cost ?? 0)),
    judge,
  }
}

export function compare(candidate, baseline, thresholds) {
  const failures = []
  for (const [id, result] of Object.entries(candidate)) {
    const gate = { ...thresholds.defaults, ...(thresholds.scenarios?.[id] ?? {}) }

    if (result.incomplete) {
      failures.push(`${id}: incomplete — no successful runs`)
      continue
    }
    if (result.rate < gate.minFiringRate) {
      failures.push(`${id}: rate ${result.rate.toFixed(2)} below floor ${gate.minFiringRate}`)
    }
    // The relative gate needs something to compare against; with no baseline
    // only the absolute floor applies.
    const base = baseline?.[id]
    if (base && !base.incomplete && base.rate - result.rate > gate.maxRateRegression) {
      failures.push(`${id}: regressed ${base.rate.toFixed(2)} → ${result.rate.toFixed(2)}`)
    }
  }
  return { pass: failures.length === 0, failures }
}
