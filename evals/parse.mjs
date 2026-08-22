// evals/parse.mjs

// The tools that hand work to a fresh context. A name not on this list is not a
// dispatch, and a dispatch this list misses is invisible to every expectation
// built on it, which is why the scoring tests carry a negative case.
const DISPATCH_TOOLS = new Set(['Task', 'Agent'])
const PROMPT_CAP = 4000

// Pure: JSONL text in, facts out. No fs, no network: this is what lets the
// scoring rules be tested without spending money on sessions.
export function parseTranscript(text) {
  const skills = []
  const tools = []
  const dispatches = []
  let usage = null
  let cost = null
  let subtype = null
  let isError = null
  let initSkills = []
  let toolIndex = 0
  // The last thing the agent said. A session that fires a skill and then
  // produces no artefact is either stalling or correctly stopping to ask, and
  // nothing else in this parse can tell those apart.
  let finalText = ''

  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue // partial or non-JSON lines are ignored; the result event decides ok
    }

    if (event.type === 'system' && event.subtype === 'init') {
      initSkills = event.skills ?? []
    } else if (event.type === 'assistant') {
      for (const block of event.message?.content ?? []) {
        if (block.type === 'text' && block.text?.trim()) finalText = block.text
        if (block.type !== 'tool_use') continue
        const index = toolIndex++
        tools.push({ name: block.name, index })
        if (DISPATCH_TOOLS.has(block.name)) {
          const prompt = String(block.input?.prompt ?? '')
          dispatches.push({
            name: block.name,
            index,
            model: block.input?.model ?? null,
            prompt: prompt.slice(0, PROMPT_CAP),
            // Kept so a truncated prompt cannot make an "omits" assertion pass
            // on text that was merely cut off.
            promptLength: prompt.length,
          })
        }
        if (block.name === 'Skill') {
          skills.push({ name: block.input?.skill, index })
        }
      }
    } else if (event.type === 'result') {
      subtype = event.subtype
      isError = event.is_error
      usage = event.usage ?? null
      cost = event.total_cost_usd ?? null
    }
  }

  // A session that produced no result event did not complete. Treating that as
  // "the skill did not fire" would let an API failure masquerade as a
  // behavioural regression, so it is an error instead.
  if (subtype === null) {
    return { ok: false, error: 'no result event', skills, tools, dispatches, usage, cost, subtype, initSkills, finalText }
  }

  return {
    ok: subtype === 'success' && isError !== true,
    error: null,
    skills,
    tools,
    dispatches,
    usage,
    cost,
    subtype,
    initSkills,
    finalText,
  }
}
