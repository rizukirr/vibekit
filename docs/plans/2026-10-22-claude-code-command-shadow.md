# claude-code command shadow: Implementation Plan

**Spec:** docs/specs/2026-10-22-claude-code-command-shadow-design.md
**Goal:** The Claude Code emitter stops writing `commands/<name>.md`, so `Skill("vibekit:<name>")` delivers the skill's body for `quick`, `vibe` and every later `command: true` skill.
**Architecture:** One deletion in `runtimes/claude-code.mjs` with a comment in its place, one guard test replacing three wrapper tests in `tests/claude-code.test.mjs`, and `npm run generate` removing the two generated wrappers. The codex emitter and its `.toml` wrappers are untouched.

## Global constraints
- Every edited string obeys `plain`'s rules, which `npm test` checks.
- Generated files are regenerated with `npm run generate`, never hand-edited.

### Task 1: stop emitting markdown commands on Claude Code → verify: `npm run check && npm test && test ! -e commands/quick.md && test ! -e commands/vibe.md && test -e commands/quick.toml && test -e commands/vibe.toml && ! grep -q commandFile runtimes/claude-code.mjs && grep -Eq '^ *//.*(shadow|hides)' runtimes/claude-code.mjs && B=$(mktemp -d) && git archive main | tar -x -C "$B" && cp tests/claude-code.test.mjs "$B/tests/" && ! (cd "$B" && node --test tests/claude-code.test.mjs >/dev/null 2>&1); s=$?; rm -rf "$B"; exit $s`

The last part of the clause runs the new test file against the emitter on `main` and requires it to fail there: a guard that cannot fail is not a guard.

**Files:**
- Modify: `runtimes/claude-code.mjs:19-31`
- Modify: `runtimes/claude-code.mjs:69-71`
- Modify: `tests/claude-code.test.mjs:5`
- Modify: `tests/claude-code.test.mjs:32-50`
- Delete: `commands/quick.md`
- Delete: `commands/vibe.md`
- Modify: `.vibekit-manifest`

- [x] Step 1: In `runtimes/claude-code.mjs`, delete the whole `function commandFile(skill) { ... }` block (lines 19 to 31) and the blank line after it.
- [x] Step 2: In the same file, replace these lines inside `emit`:

```js
  for (const skill of skills.filter(s => s.command)) {
    files[`commands/${skill.name}.md`] = commandFile(skill)
  }
```

with:

```js
  // No commands/<name>.md, even for a command skill: a plugin command named
  // like a skill is what Skill("vibekit:<name>") returns, so a wrapper hides
  // the skill's body. Plugin skills are already slash commands here.
```

- [x] Step 3: In `tests/claude-code.test.mjs`, delete line 5, `import { parseFrontmatter } from '../lib/frontmatter.mjs'`.
- [x] Step 4: In the same file, replace the three tests named `emits one markdown command per command-enabled skill and no others`, `the command file carries the skill description as frontmatter` and `the command file description survives parseFrontmatter and round-trips to the skill description` with this one test:

```js
test('emits no markdown command, because a plugin command hides the skill of the same name', () => {
  assert.ok(MODEL.skills.some(s => s.command))
  const files = emit(MODEL)
  assert.deepEqual(Object.keys(files).filter(p => /^commands\/.*\.md$/.test(p)), [])
})
```

- [x] Step 5: Run `npm run generate`
- [x] Step 6: Run `npm run check && npm test`
- [x] Step 7: Commit every path in this task's Files block (the deletions with `git rm` or `git add -A` on those paths) with the message `fix(claude-code): stop emitting command wrappers that hide skill bodies`
