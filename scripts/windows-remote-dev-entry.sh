#!/usr/bin/env bash
set -uo pipefail

SESSION_NAME="portfolio-remote-dev"
PROJECT_DIR="$HOME/projects/portfolio-manager"

export PATH="$HOME/.local/flutter/bin:$HOME/.local/bin:$PATH"

unset npm_config_prefix NPM_CONFIG_PREFIX
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # Desktop launcher shells do not read interactive shell startup files.
  # Load nvm here so npm/codex are available when launched from Windows.
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
fi

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Project directory not found: $PROJECT_DIR" >&2
  echo "Check that WSL can see the repo at ~/projects/portfolio-manager." >&2
  read -r -p "Press Enter to close..."
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

echo "==> Starting Loo Telegram bot interface"
if ! npm run remote:stack:start; then
  echo
  echo "Telegram bot interface failed to start."
  echo "Run this in WSL for more details:"
  echo "  cd $PROJECT_DIR && npm run remote:stack:status"
  echo
  read -r -p "Press Enter to close..."
  exit 1
fi

echo
echo "==> Attaching to tmux session '$SESSION_NAME'"
echo "Detach without stopping services: Ctrl-b then d"
echo

if ! tmux attach -t "$SESSION_NAME"; then
  echo
  echo "tmux attach failed. The Telegram bot may still be running."
  echo "Try from WSL:"
  echo "  tmux attach -t $SESSION_NAME"
  echo "  npm run remote:stack:status"
  echo
  read -r -p "Press Enter to close..."
  exit 1
fi
