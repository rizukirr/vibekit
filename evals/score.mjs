// evals/score.mjs

const VERIFY = '→ verify:'
// Heading level is cosmetic and agents pick their own.
const TASK_HEADER = /^#{2,4}\s+Task\s+\d+/

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
  // Exit status, in the phrasings plans actually use. Measured: five
  // agent-written plans produced "exit status 0" and "exit status of `cmd` is
  // 0", and a pattern demanding digits immediately after "exit" rejected every
  // one — three false positives and no true ones. Widening here can only admit
  // clauses that were always predicates; a quoted string still fails on the
  // quote, and a stale count still fails as a bare number.
  /\bexits?\b[^.\n]*?\b\d+/gi,
  /\b(?:status|http|returns)\s+\d{3}\b/gi,
  new RegExp(`\\b(?:${THRESHOLD})\\s+(?:\\d+|${WORD})\\b`, 'gi'),
]

const BARE_WORD_NUMBER = new RegExp(`\\b(?:${WORD})\\b`, 'i')

// Fenced code is documentation, not a clause. A plan that teaches this rule
// quotes a bad clause to show what one looks like, and the checker must not
// count that as the plan committing the defect. Fence depth is tracked so a
// ````markdown block wrapping ``` blocks closes at the right level.
export function verifyClauses(text) {
  const out = []
  let depth = 0
  for (const line of text.split('\n')) {
    const fence = line.match(/^\s*(`{3,})/)
    if (fence) {
      if (depth === 0) depth = fence[1].length
      else if (fence[1].length >= depth) depth = 0
      continue
    }
    if (depth > 0) continue
    // A clause lives in a task header — that is where the skill's template puts
    // it. Anything else mentioning the marker is prose about the rule, and a
    // plan that documents its own compliance ("one of the three permitted
    // forms") was flagged for the word three. Documentation is not a clause.
    if (TASK_HEADER.test(line) && line.includes(VERIFY)) {
      out.push(line.slice(line.indexOf(VERIFY) + VERIFY.length))
    }
  }
  return out
}

export function isPredicate(clause) {
  // A code span is what you run; prose is what you claim. Predicted output is a
  // claim, so the span comes out before anything is judged. Tolerating
  // backticks was not enough — an agent-written clause held
  // `node -e "...assert.strictEqual(pkg.type,'module')"` and was rejected for
  // quotes that belonged to the command, not to a predicted transcript.
  const prose = clause.replace(/`[^`]*`/g, ' ')
  if (/["']/.test(prose)) return false
  let rest = prose
  for (const re of ALLOWED_NUMERIC) rest = rest.replace(re, '')
  return !/\d/.test(rest) && !BARE_WORD_NUMBER.test(rest)
}

// Every key the scorer implements. A key not on this list is a typo or an
// expectation nobody built, and either way the scenario would score 1.00 while
// asserting nothing. Throwing is correct: a silent pass is the worse failure.
const KNOWN_EXPECTATIONS = new Set([
  'skill', 'before', 'after', 'skillAbsent',
  'transcriptContains', 'transcriptMatches', 'finalTextMatches', 'finalTextOmits',
  'fileMatching', 'onlyNewFilesMatching',
  'verifyClauses', 'tasksHaveVerify',
  'dispatchModelNamed', 'dispatchPromptMatches', 'dispatchPromptOmits',
  'anyDispatchMatches',
])

// Returns null when the run satisfies the scenario, else a short string naming
// the expectation that failed. A bare rate says one run in five broke a rule
// without saying which, and "which" is the whole question when a rule is under
// test. Reporting the reason cannot change a rate — every return here maps to
// the boolean the previous version returned — so this is observability, not an
// adjustment.
function unsatisfiedReason(scenario, run) {
  const expect = scenario.expect ?? {}
  for (const key of Object.keys(expect)) {
    if (!KNOWN_EXPECTATIONS.has(key)) {
      throw new Error(`unknown expectation '${key}' in scenario '${scenario.id}'`)
    }
  }
  if (expect.skill !== undefined) {
    const hit = run.skills.find(s => s.name === expect.skill)
    if (!hit) return `skill ${expect.skill} never fired`
    for (const forbidden of expect.before ?? []) {
      const earlier = run.tools.find(t => t.name === forbidden && t.index < hit.index)
      if (earlier) return `${forbidden} used before ${expect.skill}`
    }
    // `after` is `before`'s mirror over skills: each named skill must already
    // have fired. Without it a delegation scenario cannot tell "brainstorm
    // delegated to lazy" from "lazy fired on its own trigger" — both leave a
    // lazy invocation in the transcript, and only one of them is the thing
    // under test.
    for (const required of expect.after ?? []) {
      const earlier = run.skills.find(s => s.name === required && s.index < hit.index)
      if (!earlier) return `${required} did not fire before ${expect.skill}`
    }
  }
  // The mirror of `skill`, for a claim a trigger table can state but nothing
  // enforces: this skill did not fire. Accepts one name or several, since a
  // scenario asserting one door stayed shut usually means every door of its
  // kind. Pair it with `skill` in the scenario — on its own it is satisfied by
  // a session that did nothing at all.
  for (const name of [].concat(expect.skillAbsent ?? [])) {
    if (run.skills.find(s => s.name === name)) return `skill ${name} fired`
  }
  if (expect.transcriptContains !== undefined && !run.contains?.(expect.transcriptContains)) {
    return `transcript missing ${JSON.stringify(expect.transcriptContains)}`
  }

  if (expect.transcriptMatches !== undefined) {
    const re = new RegExp(expect.transcriptMatches)
    if (!re.test(run.raw ?? '')) return `transcript did not match /${expect.transcriptMatches}/`
  }

  if (expect.finalTextMatches !== undefined) {
    const re = new RegExp(expect.finalTextMatches)
    if (!re.test(run.finalText ?? '')) {
      return `final message did not match /${expect.finalTextMatches}/`
    }
  }

  // The mirror of finalTextMatches, for asserting a session did NOT claim
  // something. Safe without the truncation guard dispatchPromptOmits needs:
  // finalText is stored whole, only dispatch prompts are capped.
  if (expect.finalTextOmits !== undefined) {
    const re = new RegExp(expect.finalTextOmits)
    if (re.test(run.finalText ?? '')) {
      return `final message contained /${expect.finalTextOmits}/`
    }
  }

  // Expectations over how work was handed to a fresh context. Each requires at
  // least one dispatch: a session that dispatched nothing must fail rather than
  // pass over an empty list.
  const dispatches = run.dispatches ?? []
  const needsDispatch =
    expect.dispatchModelNamed !== undefined ||
    expect.dispatchPromptMatches !== undefined ||
    expect.dispatchPromptOmits !== undefined ||
    expect.anyDispatchMatches !== undefined
  if (needsDispatch && dispatches.length === 0) return 'no dispatch was made'

  if (expect.dispatchModelNamed) {
    const bare = dispatches.find(d => !d.model)
    if (bare) return `dispatch ${bare.index} named no model`
  }

  if (expect.dispatchPromptMatches !== undefined) {
    const re = new RegExp(expect.dispatchPromptMatches)
    const miss = dispatches.find(d => !re.test(d.prompt ?? ''))
    if (miss) return `dispatch ${miss.index} did not match /${expect.dispatchPromptMatches}/`
  }

  // The existential form. dispatchPromptMatches asks that every dispatch be the
  // thing; this asks that one of them was. A skill dispatching a refuter beside
  // ordinary exploration needs the second question, not the first.
  if (expect.anyDispatchMatches !== undefined) {
    const re = new RegExp(expect.anyDispatchMatches)
    if (!dispatches.some(d => re.test(d.prompt ?? ''))) {
      return `no dispatch matched /${expect.anyDispatchMatches}/`
    }
  }

  if (expect.dispatchPromptOmits !== undefined) {
    const re = new RegExp(expect.dispatchPromptOmits)
    for (const d of dispatches) {
      // A capped prompt is not evidence of absence.
      if ((d.promptLength ?? 0) > (d.prompt ?? '').length) {
        return `dispatch ${d.index} prompt was truncated; omission cannot be established`
      }
      if (re.test(d.prompt ?? '')) return `dispatch ${d.index} contained /${expect.dispatchPromptOmits}/`
    }
  }

  // Expectations over what the session wrote, not what it said. `plan`'s
  // observable criteria are properties of a file on disk, and a transcript
  // cannot carry them.
  const produced = run.files ?? {}
  const seeded = run.seeded ?? {}

  if (expect.fileMatching !== undefined) {
    const re = new RegExp(expect.fileMatching)
    if (!Object.keys(produced).some(p => re.test(p))) {
      return `no produced file matched ${expect.fileMatching} (produced: ${Object.keys(produced).join(', ') || 'nothing'})`
    }
  }

  if (expect.onlyNewFilesMatching !== undefined) {
    const re = new RegExp(expect.onlyNewFilesMatching)
    for (const [path, contents] of Object.entries(produced)) {
      // A modified seed counts as writing outside the allowed path, since the
      // approved artefact is the one thing a planning skill must not edit.
      if (path in seeded) {
        if (seeded[path] !== contents) return `seeded file modified: ${path}`
        continue
      }
      if (!re.test(path)) return `wrote outside ${expect.onlyNewFilesMatching}: ${path}`
    }
  }

  // Seeded files are excluded throughout: they are the fixture, not the work,
  // and a spec that discusses verify clauses in prose would otherwise fail a
  // check aimed at the plan the session wrote.
  const written = Object.entries(produced).filter(([path]) => !(path in seeded))

  if (expect.verifyClauses === 'predicate') {
    for (const [path, contents] of written) {
      const bad = verifyClauses(contents).find(c => !isPredicate(c))
      if (bad !== undefined) return `non-predicate clause in ${path}: ${bad.trim()}`
    }
  }

  if (expect.tasksHaveVerify) {
    for (const [path, contents] of written) {
      // A real plan came back with `## Task 1:` while this check matched only
      // `###`, so it found no headers at all and passed vacuously. A check that
      // cannot fail is not a check.
      const bad = contents
        .split('\n')
        .filter(line => TASK_HEADER.test(line))
        .find(line => !line.includes(VERIFY))
      if (bad !== undefined) return `task header without a verify clause in ${path}: ${bad.trim()}`
    }
  }
  return null
}

const satisfied = (scenario, run) => unsatisfiedReason(scenario, run) === null

// Enough to hold a plan; short enough that a runaway file cannot bloat the
// committed results.
const ARTIFACT_CAP = 20000

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
    // Kept so a sub-1.00 rate names what broke instead of only how often.
    failures: good.map(r => unsatisfiedReason(scenario, r)).filter(Boolean),
    // The reason names the rule; the artefact shows the text that broke it.
    // Without this a false positive can only ever be argued about, because the
    // session directory is gone by the time anyone asks. Failing runs only,
    // seeded fixtures excluded, each file capped.
    failedArtifacts: good
      .filter(r => unsatisfiedReason(scenario, r) !== null)
      .map(r => Object.fromEntries(
        Object.entries(r.files ?? {})
          .filter(([path]) => !(path in (r.seeded ?? {})))
          .map(([path, contents]) => [path, contents.slice(0, ARTIFACT_CAP)]),
      )),
    // When the artefact is missing entirely there is nothing to store above,
    // and the last thing the agent said is the only evidence of whether it
    // stalled or correctly stopped to ask.
    failedFinalText: good
      .filter(r => unsatisfiedReason(scenario, r) !== null)
      .map(r => (r.finalText ?? '').slice(0, ARTIFACT_CAP)),
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
