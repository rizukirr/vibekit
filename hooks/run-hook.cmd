: << 'CMDBLOCK'
@echo off
REM Cross-platform polyglot wrapper for hook scripts.
REM On Windows: cmd.exe runs the batch portion, which finds and calls bash.
REM On Unix: the shell interprets this as a script (: is a no-op in bash).
REM
REM Hook scripts use extensionless filenames (e.g. "session-start" not
REM "session-start.sh") so Claude Code's Windows auto-detection -- which
REM prepends "bash" to any command containing .sh -- doesn't interfere.
REM
REM Usage: run-hook.cmd <script-name> [args...]

if "%~1"=="" (
    echo run-hook.cmd: missing script name >&2
    exit /b 1
)

set "HOOK_DIR=%~dp0"
set "HOOK_SCRIPT=%~1"

REM Forward every argument after the first, preserving the caller's quoting.
REM cmd has no "$@" equivalent: %* still includes %1, and shift does not
REM affect %*, so split %* on its first token and keep the remainder.
set "HOOK_ARGS="
for /f "tokens=1,*" %%a in ("%*") do set "HOOK_ARGS=%%b"

REM Bare `exit /b` propagates the real errorlevel. `exit /b %ERRORLEVEL%`
REM would not: cmd expands %ERRORLEVEL% when it parses the whole
REM parenthesised block, before any line inside it has run.

REM Try Git for Windows bash in standard locations
if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" "%HOOK_DIR%%HOOK_SCRIPT%" %HOOK_ARGS%
    exit /b
)
if exist "C:\Program Files (x86)\Git\bin\bash.exe" (
    "C:\Program Files (x86)\Git\bin\bash.exe" "%HOOK_DIR%%HOOK_SCRIPT%" %HOOK_ARGS%
    exit /b
)

REM Try bash on PATH (e.g. user-installed Git Bash, MSYS2, Cygwin)
where bash >nul 2>nul
if %ERRORLEVEL% equ 0 (
    bash "%HOOK_DIR%%HOOK_SCRIPT%" %HOOK_ARGS%
    exit /b
)

REM No bash found - exit silently rather than error
REM (plugin still works, just without SessionStart context injection)
exit /b 0
CMDBLOCK

# Unix: run the named script directly.
# The guard mirrors the batch half above; without it an argument-less call
# execs the hooks directory itself and dies with "Is a directory".
if [ $# -eq 0 ]; then
  echo "run-hook.cmd: missing script name" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_NAME="$1"
shift
exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
