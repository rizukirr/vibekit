: << 'CMDBLOCK'
@echo off
REM Cross-platform wrapper for hook scripts.
REM Usage: run-hook.cmd <script-name> [args...]

if "%~1"=="" (
    echo run-hook.cmd: missing script name >&2
    exit /b 1
)

set "HOOK_DIR=%~dp0"

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
CMDBLOCK

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_NAME="$1"
shift
exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
