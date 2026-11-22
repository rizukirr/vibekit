# fix edit-gate windows: Implementation Plan

**Spec:** docs/specs/2026-11-22-fix-edit-gate-windows-design.md
**Goal:** Make the edit gate's exit status and full skill list survive the Windows batch wrapper.
**Architecture:** Remove the temporary diagnostics first. Then make each `exit /b` in `hooks/run-hook.cmd` return the bash status at run time, and join the skill list with `+`, which cmd.exe does not treat as an argument separator.

## Global constraints
- No interface change.
- No behaviour change other than the one the cause names.
- Generated files are regenerated with `npm run generate`, never hand-edited.
- Every edited string obeys `plain`'s rules, which `npm test` checks.

Note: the spec's Cause cites run-hook.cmd lines 14, 18 and 23. Read at HEAD 2afcb5a, the three `exit /b %ERRORLEVEL%` lines are 15, 19 and 25. This plan uses the observed lines.

### Task 1: revert the diagnostic commit → verify: `git grep -q DIAG -- hooks/edit-gate tests/hook.test.mjs` exits 1 and `npm test` exits 0

**Files:**
- Modify: `hooks/edit-gate` (revert of commit 9b22e98)
- Modify: `tests/hook.test.mjs` (revert of commit 9b22e98)

- [x] Step 1: Run `git revert --no-edit 9b22e98`
- [x] Step 2: Run `git grep -q DIAG -- hooks/edit-gate tests/hook.test.mjs`
- [x] Step 3: Run `npm test`

### Task 2: exit status and skill list survive cmd.exe → verify: `npm run check` exits 0, `npm test` exits 0, `grep -c 'exit /b %ERRORLEVEL%' hooks/run-hook.cmd` prints 0, and `grep -c 'edit-gate brainstorm+' hooks/hooks.json` prints at least 1

**Files:**
- Modify: `hooks/run-hook.cmd:15,19,25`
- Modify: `hooks/edit-gate:3,33`
- Modify: `runtimes/claude-code.mjs:51-54,59`
- Modify: `tests/hook.test.mjs:54`
- Modify: `tests/claude-code.test.mjs:36`
- Regenerate: `hooks/hooks.json` and any other file `npm run generate` writes

- [x] Step 1: In `hooks/run-hook.cmd`, replace each of the three lines `    exit /b %ERRORLEVEL%` (at lines 15, 19 and 25) with `    exit /b`. A bare `exit /b` returns the errorlevel of the command that just ran, which is read at run time, while `%ERRORLEVEL%` inside a parenthesised block is read when cmd.exe parses the block.
- [x] Step 2: In `hooks/edit-gate`, change line 3 from `# until a working vibekit skill has run. $1 is the comma-joined skill list.` to `# until a working vibekit skill has run. $1 is the skill list, joined with +.`
- [x] Step 3: In `hooks/edit-gate`, change `names=$(printf '%s' "${1:-}" | tr ',' '|')` to `names=$(printf '%s' "${1:-}" | tr '+' '|')`
- [x] Step 4: In `runtimes/claude-code.mjs`, replace the comment lines

```js
        // The edit gate. Its list is every skill that counts as entering the
        // pipeline: each hard gate and each command, so a new skill joins or
        // stays out by its own frontmatter. One comma-joined argument, because
        // run-hook.cmd forwards at most 8 arguments on Windows.
```

with

```js
        // The edit gate. Its list is every skill that counts as entering the
        // pipeline: each hard gate and each command, so a new skill joins or
        // stays out by its own frontmatter. One argument joined with +,
        // because run-hook.cmd forwards at most 8 arguments on Windows and
        // cmd.exe splits an argument at a comma.
```

- [x] Step 5: In `runtimes/claude-code.mjs`, in the `edit-gate` command template, change `.sort().join(',')` to `.sort().join('+')`.
- [x] Step 6: In `tests/hook.test.mjs`, change `const GATE_LIST = 'brainstorm,quick'` to `const GATE_LIST = 'brainstorm+quick'`. Keep `quick` second: the test "edit-gate allows an edit after a Skill call to a working skill" only passes on Windows when the whole list reaches the script.
- [x] Step 7: In `tests/claude-code.test.mjs`, change `.split(' edit-gate ')[1].split(',')` to `.split(' edit-gate ')[1].split('+')`.
- [x] Step 8: Run `npm run generate`
- [x] Step 9: Run `npm run check`
- [x] Step 10: Run `npm test`
- [x] Step 11: Commit `fix(hooks): edit-gate exit status and skill list survive cmd.exe`

### Task 3: exit outside any parenthesised block → verify: `git grep -q DIAG -- tests/hook.test.mjs` exits 1, `grep -c '^:git64$' hooks/run-hook.cmd` prints at least 1, `npm run check` exits 0, and `npm test` exits 0

Amended after Task 2: Windows CI run 44934455053 measured that a batch file exiting from inside an `if (...)` block returns 0 under cmd /c with either bare `exit /b` or `exit /b %ERRORLEVEL%`, while `goto` to a label followed by `exit /b %ERRORLEVEL%` outside any block returns the real code.

**Files:**
- Modify: `tests/hook.test.mjs` (revert of commit c7ec5f6)
- Modify: `hooks/run-hook.cmd:13-28`

- [x] Step 1: Run `git revert --no-edit c7ec5f6`
- [x] Step 2: In `hooks/run-hook.cmd`, replace lines 13 to 28, which run from the line `if exist "C:\Program Files\Git\bin\bash.exe" (` through the line `exit /b 0`, with exactly:

```bat
if exist "C:\Program Files\Git\bin\bash.exe" goto git64
if exist "C:\Program Files (x86)\Git\bin\bash.exe" goto git32
where bash >nul 2>nul
if %ERRORLEVEL% equ 0 goto pathbash

REM No bash found - exit silently rather than error.
exit /b 0

REM Each call exits outside any parenthesised block. A batch file that exits
REM from inside an if (...) block returns 0 under cmd /c, whatever bash returned.
:git64
"C:\Program Files\Git\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

:git32
"C:\Program Files (x86)\Git\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%

:pathbash
bash "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
exit /b %ERRORLEVEL%
```

Keep lines 1 to 12 and the lines from `CMDBLOCK` on unchanged, and keep LF line endings.
- [x] Step 3: Run `npm run check`
- [x] Step 4: Run `npm test`
- [x] Step 5: Commit `fix(hooks): run-hook.cmd exits outside its if blocks`
