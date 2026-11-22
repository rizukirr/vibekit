# retro checks: Implementation Plan

**Spec:** docs/specs/2026-11-22-retro-checks-design.md
**Goal:** A test fails whenever the batch half of `hooks/run-hook.cmd` exits from inside an `if (...)` block, and the wrapper passes it.
**Architecture:** A small text scan in `tests/hook.test.mjs` tracks block depth over the lines before `CMDBLOCK` and reports any `exit /b` at depth above zero. A second test runs the scan on the wrapper as it was at 3c66c5d, inlined as a fixture, to prove the scan can fail. The missing-script-name branch moves to a label so the wrapper passes.

## Global constraints
- No new dependency.
- Every edited string obeys `plain`'s rules.
- The missing-script-name branch keeps its message and its exit status of 1.

### Task 1: block-exit scan and the wrapper that passes it → verify: `npm test` exits 0, `npm run check` exits 0, `grep -c '^:noscript$' hooks/run-hook.cmd` prints at least 1, and `grep -c 'exitsInsideBlocks' tests/hook.test.mjs` prints at least 1

**Files:**
- Modify: `hooks/run-hook.cmd:6-9` and the line before `CMDBLOCK`
- Modify: `tests/hook.test.mjs` (append at the end)

- [ ] Step 1: In `hooks/run-hook.cmd`, replace lines 6 to 9, which read

```bat
if "%~1"=="" (
    echo run-hook.cmd: missing script name >&2
    exit /b 1
)
```

with the single line

```bat
if "%~1"=="" goto noscript
```

- [ ] Step 2: In `hooks/run-hook.cmd`, directly before the line `CMDBLOCK`, insert:

```bat

:noscript
echo run-hook.cmd: missing script name >&2
exit /b 1
```

Keep every other line unchanged and keep LF line endings.

- [ ] Step 3: Append to the end of `tests/hook.test.mjs`:

```js
// A batch file run through cmd /c that exits from inside an if (...) block
// reports 0, whatever the exit code. Windows CI measured it in run 44934455053.
function exitsInsideBlocks(text) {
  const lines = text.split(/\r?\n/)
  const end = lines.indexOf('CMDBLOCK')
  const found = []
  let depth = 0
  for (const [index, raw] of lines.slice(0, end === -1 ? lines.length : end).entries()) {
    const line = raw.trim()
    if (depth > 0 && /^exit \/b\b/i.test(line)) found.push(index + 1)
    if (line.endsWith('(')) depth++
    else if (line === ')') depth--
  }
  return found
}

// The wrapper's batch half at 3c66c5d, which lost every exit code on Windows.
const BLOCK_EXIT_WRAPPER = String.raw`: << 'CMDBLOCK'
@echo off
if "%~1"=="" (
    echo run-hook.cmd: missing script name >&2
    exit /b 1
)
set "HOOK_DIR=%~dp0"
if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b
)
exit /b 0
CMDBLOCK`

test('the batch half of run-hook.cmd never exits from inside an if block', () => {
  assert.deepEqual(exitsInsideBlocks(readFileSync('hooks/run-hook.cmd', 'utf8')), [])
})

test('the block-exit scan catches the wrapper that lost exit codes on Windows', () => {
  assert.ok(exitsInsideBlocks(BLOCK_EXIT_WRAPPER).length > 0)
})
```

- [ ] Step 4: Run `npm run check`
- [ ] Step 5: Run `npm test`
- [ ] Step 6: Commit `test(hooks): no exit from inside a batch if block`
