@echo off
REM .gitmobile - Windows Startup Script

REM 1. Check for runtime (node or deno)
set RUNNER=none
where node >nul 2>nul
if %errorlevel% equ 0 (
  set RUNNER=node
  goto found_runner
)

where deno >nul 2>nul
if %errorlevel% equ 0 (
  set RUNNER=deno
  goto found_runner
)

:found_runner
if "%RUNNER%"=="none" (
  echo [Error] Neither Node.js nor Deno found in PATH.
  echo Please install Node.js from https://nodejs.org or Deno from https://deno.com
  pause
  exit /b 1
)

REM 2. Ensure dependencies are installed if missing
if not exist "%~dp0.gitmobile\node_modules" (
  echo Installing dependencies...
  if "%RUNNER%"=="node" (
    pushd "%~dp0.gitmobile"
    call npm install --omit=dev --silent
    popd
  ) else (
    pushd "%~dp0.gitmobile"
    deno install
    popd
  )
)

REM 3. Configure Git auto-upstream, non-blocking SSH, and upstream remote
git config push.autoSetupRemote true >nul 2>nul
git config core.sshCommand "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new" >nul 2>nul
git remote add upstream https://github.com/potatobun321/git-mobile-.git >nul 2>nul

REM 4. Launch Server
if "%RUNNER%"=="node" (
  node "%~dp0.gitmobile\server\index.js"
) else (
  deno run -A "%~dp0.gitmobile\server\index.js"
)

pause
