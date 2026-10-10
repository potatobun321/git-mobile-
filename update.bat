@echo off
REM .gitmobile - Upstream Engine Updater

echo.
echo   .gitmobile - Upstream Engine Updater
echo   ------------------------------------
echo.

git remote add upstream https://github.com/potatobun321/git-mobile-.git >nul 2>nul
git remote set-url upstream https://github.com/potatobun321/git-mobile-.git >nul 2>nul

echo   [1/2] Fetching latest upstream changes...
git fetch upstream master
if %errorlevel% neq 0 (
  echo   [Error] Failed to fetch upstream repository. Please check your internet connection.
  pause
  exit /b 1
)

echo   [2/2] Updating engine files (.gitmobile, startup.bat, startup.sh)...
git checkout upstream/master -- .gitmobile startup.bat startup.sh
if %errorlevel% neq 0 (
  echo   [Error] Failed to checkout engine files.
  pause
  exit /b 1
)

echo.
echo   [Success] .gitmobile engine updated to the latest upstream version!
echo   Your notes, papers, and personal git history remain intact.
echo.
pause
