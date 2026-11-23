---
name: quick
description: "Use before any implementation work: features, fixes, behavior changes. Checks the size first, then thinks the design through silently, builds in one go and proves it works by running it. Asks the user to move big work to the normal flow or repl."
trigger: About to start creative or implementation work, before code is written
gate: hard
command: true
---

# quick

The default path. One intent in, the change designed, built and proven in one go, with no documents in between.

## 0. Modifiers

`lazy`, `terse` and `plain` are injected in full at session start, alongside this skill. **If the full text of any of them is not in your context, load it before anything else**, the way this runtime loads skills. Their description lines are not their content: you have not read a skill until its text is in front of you. They stay on for the rest of the session, and every line `quick` prints follows them.

## 1. Gate

Check these facts about the request before any edit:

- It needs a dependency that is not already installed.
- It touches a schema, a migration, or the shape of stored data.
- It touches auth, payments, permissions, or any other trust boundary.
- It spans more files than you can hold in one reading.
- The intent reads two ways.
- It asks for more than 3 separate things a user could see or use.

An item you cannot decide counts as tripped. A wasted question costs less than a wrong run.

None tripped: go to step 2.

Any tripped: stop before any edit and ask the user, in this shape:

> This needs a full run: <the item, in plain words>. Done in one go, <what could go wrong, in plain words, for example: nobody checks the design between the parts, so the result may not be what you meant>. Pick one: the normal flow (I ask you a few questions, write a spec and a plan, then build), or `repl` (I plan alone, show you a summary, then build without stopping). Or say "quick anyway" to keep going here.

Write it in words a 12-year-old would follow, with no file paths, function names or jargon unless the user used them first.

On the normal flow, invoke `brainstorm` with the intent. On `repl`, invoke `repl` with the intent. On "quick anyway", go to step 2. "Quick anyway" never waives `lazy`'s never-simplify-away list or `decide`'s one-way doors.

## 2. Think it through silently

Invoke `decide`. Then do brainstorm's thinking without the user and without files: trace every file the change touches, form the one challenge to the framing, and pick the laziest approach on `lazy`'s ladder that meets the request. Every question brainstorm would ask, you answer by `decide`.

No spec file, no plan file, no subagents, no decision log.

Print one line and keep going without waiting:

> Reading: <goal>. Smallest change: <change>.

## 3. Build in units

Build one thing a user could see or use at a time, at most 3. After each one, run its check before starting the next. A failed check stops the build at that unit.

## 4. Prove it

Find the one fact the change relies on, and prove it by running something: a test, a script that calls the real code, or the app itself. "It compiles" and "I read it" do not count.

Non-trivial logic leaves one runnable check behind, and you run it.

If nothing can run, say so, and do not claim the work is done.

## 5. Failures

A failed check goes to `debug`, as it always does. Approve its report once its refuter has run, then fix.

After two failed fixes that share an assumption, stop. Name the assumption, say what is done and what was checked, and offer the normal flow.

A `decide` one-way door met mid-build stops the run the same way, naming the door.

A stopped run leaves its unfinished edits in the working tree. Never revert them.

## The close

End with one line, picking the one evidence value that applies:

> Ran: <check> (<result>). Evidence: ran it | reproduced in app | could not run.
