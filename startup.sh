#!/usr/bin/env bash
# ==============================================================================
# .gitmobile — Startup Script
# Works on Android (Termux), Linux, and macOS
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
GITMOBILE_DIR="$DIR/.gitmobile"

# 1. Termux on Android Detection & Auto-Installation
IS_TERMUX=false
if [ -d "/data/data/com.termux" ] || [ -n "$TERMUX_VERSION" ]; then
  IS_TERMUX=true
  MISSING_PKGS=""
  command -v node >/dev/null 2>&1 || MISSING_PKGS="$MISSING_PKGS nodejs"
  command -v git >/dev/null 2>&1 || MISSING_PKGS="$MISSING_PKGS git"
  command -v ssh >/dev/null 2>&1 || MISSING_PKGS="$MISSING_PKGS openssh"

  if [ -n "$MISSING_PKGS" ]; then
    echo "Installing missing packages:$MISSING_PKGS..."
    pkg update -y
    pkg install -y $MISSING_PKGS
  fi
fi

# 2. Runtime & Dependency Verification
RUNNER=""
if command -v node >/dev/null 2>&1; then
  RUNNER="node"
elif command -v deno >/dev/null 2>&1; then
  RUNNER="deno run -A"
else
  echo "[Error] Neither Node.js nor Deno found in PATH."
  echo "Please install Node.js from https://nodejs.org"
  exit 1
fi

# Ensure dependencies in .gitmobile
if [ ! -d "$GITMOBILE_DIR/node_modules" ]; then
  echo "Installing dependencies..."
  if [ "$RUNNER" = "node" ]; then
    (cd "$GITMOBILE_DIR" && npm install --omit=dev --silent)
  else
    (cd "$GITMOBILE_DIR" && deno install)
  fi
fi

# 3. SSH Setup for GitHub
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
touch "$HOME/.ssh/known_hosts"
chmod 644 "$HOME/.ssh/known_hosts"

if ! grep -q "github.com" "$HOME/.ssh/known_hosts" 2>/dev/null; then
  ssh-keyscan -t ed25519 github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null || true
fi

SSH_KEY="$HOME/.ssh/id_ed25519"
if [ ! -f "$SSH_KEY" ] && [ ! -f "$HOME/.ssh/id_rsa" ]; then
  ssh-keygen -t ed25519 -N "" -f "$SSH_KEY" -C "gitmobile" >/dev/null 2>&1
  chmod 600 "$SSH_KEY"
  chmod 644 "${SSH_KEY}.pub"
fi

PUB_KEY_FILE="${SSH_KEY}.pub"
if [ ! -f "$PUB_KEY_FILE" ] && [ -f "$HOME/.ssh/id_rsa.pub" ]; then
  PUB_KEY_FILE="$HOME/.ssh/id_rsa.pub"
fi

SSH_CHECK=$(ssh -T -o BatchMode=yes -o StrictHostKeyChecking=accept-new git@github.com 2>&1 || true)

if echo "$SSH_CHECK" | grep -q "Permission denied"; then
  echo ""
  echo "Action Required: Add SSH Key to GitHub"
  echo "--------------------------------------"
  echo "Copy the public key below and paste it into GitHub:"
  echo ""
  if [ -f "$PUB_KEY_FILE" ]; then
    echo "  $(cat "$PUB_KEY_FILE")"
  fi
  echo ""
  echo "Add key at: https://github.com/settings/ssh/new"
  echo ""
  read -p "Press ENTER after adding the key to GitHub to continue..." _
fi

# Configure Git automatic upstream tracking and identity
git config push.autoSetupRemote true 2>/dev/null || true
git config core.sshCommand "ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new" 2>/dev/null || true
if [ -z "$(git config user.name 2>/dev/null)" ]; then
  git config --global user.name "GitMobile User" 2>/dev/null || git config user.name "GitMobile User" 2>/dev/null || true
fi
if [ -z "$(git config user.email 2>/dev/null)" ]; then
  git config --global user.email "gitmobile@localhost" 2>/dev/null || git config user.email "gitmobile@localhost" 2>/dev/null || true
fi
git remote add upstream https://github.com/potatobun321/git-mobile-.git 2>/dev/null || true

# 4. Launch Server
if [ "$RUNNER" = "node" ]; then
  node "$GITMOBILE_DIR/server/index.js"
else
  deno run -A "$GITMOBILE_DIR/server/index.js"
fi
