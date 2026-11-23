# fix generator crlf: Implementation Plan

**Spec:** docs/specs/2026-11-23-fix-generator-crlf-design.md
**Goal:** `npm run check` reports no drift on a checkout whose files have CRLF line endings.
**Architecture:** `fsReader` in `lib/build.mjs` is the one place the generator reads files from disk: the drift comparison, the generated-region splice and the manifest all go through it. Normalising CRLF to LF there fixes the stale list (`lib/build.mjs:72`) and the orphan list (`lib/build.mjs:115`) at once, without touching either line.

## Global constraints
- Run limits: at most 3 verify rounds, at most $0 on paid runs.
- No interface change.
- No behaviour change other than the one the cause names.
- Commit messages carry no `Co-Authored-By` line.

### Task 1: read files as LF in fsReader, with the guard test → verify: `node --test tests/build.test.mjs` exits 0 and `npm run check` exits 0, both run in the run worktree `C:\Users\rizki\Projects\vibekit\.vibe-worktrees\fix-generator-crlf`

**Blocked by:** none

**Files:**
- Modify: `lib/build.mjs:79-87`
- Modify: `tests/build.test.mjs:4-7` (imports), and append one test

- [ ] Step 1: In `tests/build.test.mjs`, replace lines 4-7

```js
import { writeFileSync, mkdirSync, cpSync } from 'node:fs'
import { join } from 'node:path'
import { build, mergeEmitters, applyRegions, planChanges, mergeContributions, MANIFEST } from '../lib/build.mjs'
import { makeSkillsDir, skillFile, MODEL } from './helpers.mjs'
```

with

```js
import { writeFileSync, mkdirSync, cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build, mergeEmitters, applyRegions, planChanges, mergeContributions, fsReader, MANIFEST } from '../lib/build.mjs'
import { makeSkillsDir, skillFile, MODEL } from './helpers.mjs'
```

- [ ] Step 2: Append to `tests/build.test.mjs`:

```js

// A Windows clone made before .gitattributes keeps CRLF files on disk. The
// generator reported every one of them stale and every manifest entry as an
// orphan, because it read disk text raw.
test('a checkout with CRLF line endings reports no drift', async () => {
  const root = mkdtempSync(join(tmpdir(), 'vibekit-crlf-'))
  try {
    const { files } = await build(process.cwd())
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text.replace(/\n/g, '\r\n'))
    }
    const { write, remove } = await build(process.cwd(), fsReader(root))
    assert.deepEqual(write, [], 'a CRLF copy of generated output must not be stale')
    assert.deepEqual(remove, [], 'a CRLF manifest must not turn its entries into orphans')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
```

- [ ] Step 3: Run `node --test tests/build.test.mjs` and record that the new test fails (the guard fails before the fix). Do not change `lib/build.mjs` before this run.
- [ ] Step 4: In `lib/build.mjs`, replace lines 79-87

```js
// Default filesystem reader. Returns null for a missing file rather than
// throwing, because "absent" and "different" are the same case to planChanges.
export function fsReader(root) {
  return {
    read(path) {
      try { return readFileSync(join(root, path), 'utf8') } catch { return null }
    },
  }
}
```

with

```js
// Default filesystem reader. Returns null for a missing file rather than
// throwing, because "absent" and "different" are the same case to planChanges.
// It reads CRLF as LF: a Windows clone made before .gitattributes keeps CRLF
// files, and git stores them as LF anyway, so line endings are never drift.
export function fsReader(root) {
  return {
    read(path) {
      try { return readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n') } catch { return null }
    },
  }
}
```

- [ ] Step 5: Run `node --test tests/build.test.mjs` and `npm run check` from the run worktree.
- [ ] Step 6: Run `node --test` over every `tests/*.test.mjs` except `tests/submission.test.mjs` (in PowerShell: `node --test (Get-ChildItem tests/*.test.mjs | Where-Object Name -ne 'submission.test.mjs' | ForEach-Object FullName)`).
- [ ] Step 7: Commit `lib/build.mjs` and `tests/build.test.mjs`: `fix(build): read CRLF files as LF so an old Windows clone reports no drift`

### Task 2: the failing command in the CRLF checkout → verify: `npm run check` exits 0 in `C:\Users\rizki\Projects\vibekit` while that checkout is detached at the run branch's HEAD, and `git ls-files --eol` there still lists at least 1 entry with `w/crlf`

**Blocked by:** Task 1

**Files:** none changed. This task only measures, in the main checkout, which still has CRLF files from before `.gitattributes`.

- [ ] Step 1: In `C:\Users\rizki\Projects\vibekit`, confirm `git status --porcelain --untracked-files=no` prints nothing, and record `git branch --show-current`.
- [ ] Step 2: Run `git switch --detach repl-run/fix-generator-crlf`. Git rewrites only the files that differ from the current branch, so the CRLF generated files stay CRLF.
- [ ] Step 3: Run `git ls-files --eol` and count the entries with `w/crlf`, then run `npm run check` and record its exit status and output.
- [ ] Step 4: Run `git switch fix/generator-crlf` to put the main checkout back on its branch, and confirm `git status --porcelain --untracked-files=no` prints nothing.

### Task 3: the full suite in CI → verify: the newest CI run for this branch's pull request concludes `success` on every job

**Blocked by:** Task 1, Task 2

**Files:** none changed except the index entries under `docs/`

The full suite includes `tests/submission.test.mjs`, which needs `zip` and `unzip` and runs only on ubuntu in `validate`. CI runs only on pull requests and pushes to `main` and `v2`.

- [ ] Step 1: Run `git rm -r -q --cached --ignore-unmatch docs` and commit `chore: keep specs and plans out of the PR`. The files stay on disk.
- [ ] Step 2: After the user's approval, push the run branch to `origin` as `fix/generator-crlf` (`git push origin repl-run/fix-generator-crlf:fix/generator-crlf`) and open a pull request against `main` with `gh pr create --head fix/generator-crlf`. The body carries no `Co-Authored-By` line.
- [ ] Step 3: Run `gh run list --branch fix/generator-crlf --workflow CI --limit 1` and wait for that run to finish.
- [ ] Step 4: Run `gh run view <the run id from Step 3> --json jobs` and read every job's conclusion.
