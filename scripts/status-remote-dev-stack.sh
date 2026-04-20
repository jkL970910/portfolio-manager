#!/usr/bin/env bash
set -euo pipefail

SESSION_NAME="portfolio-remote-dev"

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "Session '$SESSION_NAME' is running."
  tmux list-windows -t "$SESSION_NAME"
else
  echo "Session '$SESSION_NAME' is not running."
fi