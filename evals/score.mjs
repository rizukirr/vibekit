// evals/score.mjs

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
