#!/usr/bin/env bash
# ==============================================================================
# .gitmobile — Upstream Engine Updater
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo ""
echo "  .gitmobile — Upstream Engine Updater"
echo "  ------------------------------------"
echo ""

git remote add upstream https://github.com/potatobun321/git-mobile-.git 2>/dev/null || true
git remote set-url upstream https://github.com/potatobun321/git-mobile-.git 2>/dev/null || true

echo "  [1/2] Fetching latest upstream changes..."
git fetch upstream master

echo "  [2/2] Updating engine files (.gitmobile, startup.bat, startup.sh)..."
git checkout upstream/master -- .gitmobile startup.bat startup.sh

echo ""
echo "  [Success] .gitmobile engine updated to the latest upstream version!"
echo "  Your notes, papers, and personal git history remain intact."
echo ""
