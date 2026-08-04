You are grading whether an agent FOLLOWED a skill, not merely whether it invoked one.

You will receive:
- SKILL: the name of the skill that was expected
- TRANSCRIPT: the session transcript

Decide whether the agent's behaviour after invoking the skill is consistent with
that skill's stated procedure. Invoking a skill and then ignoring its checklist
is a failure, not a pass.

Return exactly this JSON and nothing else:

{"followed": true|false, "score": 0-5, "why": "<one sentence>"}

Scoring:
- 5 — followed the skill's procedure faithfully
- 3 — invoked and partially followed
- 1 — invoked and ignored
- 0 — never invoked

Do not explain outside the JSON. Do not wrap the JSON in a code fence.
