# retro checks: Implementation Plan

**Spec:** docs/specs/2026-11-23-retro-checks-design.md
**Goal:** The `hook (windows-latest)` CI job runs every unit test file except `tests/submission.test.mjs`, so a Windows-only test failure fails CI.
**Architecture:** One step added to the existing `hook` job in `.github/workflows/ci.yml`, guarded to the Windows leg, running `node --test` over the test files in PowerShell. `tests/ci.test.mjs` pins the step so it cannot be dropped silently.

## Global constraints
- No new dependency, in the package or on the CI runner.
- The step lives in the existing `hook` job's matrix, on the Windows leg only, so the ubuntu leg and `validate` are unchanged.
- The command is one any contributor can run on Windows from the repo root.
- Commits end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Task 1: the Windows unit-test step → verify: `node --test tests/ci.test.mjs` exits 0; the step's command, run from the worktree root in PowerShell, exits 0; the same command run in a temporary worktree at 3f800da exits non-zero

**Blocked by:** none

**Files:**
- Modify: `.github/workflows/ci.yml` (append after line 51)
- Modify: `tests/ci.test.mjs` (append one test)

- [ ] Step 1: Append to `.github/workflows/ci.yml`, after line 51 (`        run: npm run check:hook`), keeping the file's two-space indentation:

```yaml

      # The unit tests once ran only on ubuntu, so Windows-only failures (CRLF
      # frontmatter, backslash paths) reached main. The submission tests need
      # zip and unzip, which this runner lacks, and they run on ubuntu in validate.
      - name: Unit tests on Windows, without the zip-dependent submission tests
        if: runner.os == 'Windows'
        shell: pwsh
        run: node --test (Get-ChildItem tests/*.test.mjs | Where-Object Name -ne 'submission.test.mjs' | ForEach-Object FullName)
```

- [ ] Step 2: Append to `tests/ci.test.mjs`:

```js

test('the hook job runs the unit tests on windows, without the submission tests', () => {
  assert.match(workflow, /if: runner\.os == 'Windows'/)
  assert.match(workflow, /node --test \(Get-ChildItem tests\/\*\.test\.mjs \| Where-Object Name -ne 'submission\.test\.mjs' \| ForEach-Object FullName\)/)
})
```

- [ ] Step 3: Run `node --test tests/ci.test.mjs`
- [ ] Step 4: From the worktree root in PowerShell, run `node --test (Get-ChildItem tests/*.test.mjs | Where-Object Name -ne 'submission.test.mjs' | ForEach-Object FullName)` and record its exit status.
- [ ] Step 5: Run `git worktree add --detach C:\Users\rizki\AppData\Local\Temp\claude\9c6dcc25bed50afc\6372b2f8-fbb4-486d-bb8b-88c065b1de4b\scratchpad\wt-retro-base 3f800da`, run the same command from that folder in PowerShell, record its exit status and whether its output names the test `the guard covers every skill plus all three generated docs` as failing (spec goal 2), then run `git worktree remove --force C:\Users\rizki\AppData\Local\Temp\claude\9c6dcc25bed50afc\6372b2f8-fbb4-486d-bb8b-88c065b1de4b\scratchpad\wt-retro-base`.
- [ ] Step 6: Commit `.github/workflows/ci.yml` and `tests/ci.test.mjs`: `ci: run the unit tests on the windows-latest hook job`

### Task 2: the step runs green in CI → verify: in the newest CI run for pull request #74, the `hook (windows-latest)` job log contains the step name written in Task 1 Step 1, and the job concludes `success`

**Blocked by:** Task 1

**Files:** none changed except the index entries under `docs/`

- [ ] Step 1: Run `git rm -r -q --cached --ignore-unmatch docs` and commit `chore: keep specs and plans out of the PR`. The files stay on disk.
- [ ] Step 2: After the user's approval, run `git push origin repl-run/windows-start-skills`, which updates draft pull request #74.
- [ ] Step 3: Run `gh run list --branch repl-run/windows-start-skills --workflow CI --limit 1` and wait for that run to finish.
- [ ] Step 4: Run `gh run view <the run id from Step 3> --json jobs` and read the `hook (windows-latest)` conclusion, then `gh run view <the run id> --log` and confirm the step name appears in that job's log.
