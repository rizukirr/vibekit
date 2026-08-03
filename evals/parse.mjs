// evals/parse.mjs

// Pure: JSONL text in, facts out. No fs, no network — this is what lets the
// scoring rules be tested without spending money on sessions.
export function parseTranscript(text) {
  const skills = []
  const tools = []
  let usage = null
  let cost = null
  let subtype = null
  let isError = null
  let initSkills = []
  let toolIndex = 0

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
        if (block.type !== 'tool_use') continue
        const index = toolIndex++
        tools.push({ name: block.name, index })
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
    return { ok: false, error: 'no result event', skills, tools, usage, cost, subtype, initSkills }
  }

  return {
    ok: subtype === 'success' && isError !== true,
    error: null,
    skills,
    tools,
    usage,
    cost,
    subtype,
    initSkills,
  }
}
