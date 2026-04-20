#!/usr/bin/env bash
set -euo pipefail

SESSION_NAME="portfolio-remote-dev"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_CMD="cd '$ROOT_DIR' && export PATH=\"\$HOME/.local/bin:\$PATH\" && npm run local:start:linux"
DUCTOR_CMD="cd '$ROOT_DIR' && export PATH=\"\$HOME/.local/bin:\$PATH\" && npm run remote:ductor"
TUNNEL_CMD="cd '$ROOT_DIR' && export PATH=\"\$HOME/.local/bin:\$PATH\" && npm run preview:tunnel:cloudflare"

if ! command -v tmux >/dev/null 2>&1; then
  echo 'tmux is required but not installed.' >&2
  exit 1
fi

if ! command -v codex >/dev/null 2>&1; then
  echo 'codex CLI is not on PATH. Run: export PATH="$HOME/.local/bin:$PATH"' >&2
  exit 1
fi

if ! command -v ductor >/dev/null 2>&1; then
  echo 'ductor is not on PATH. Run: export PATH="$HOME/.local/bin:$PATH"' >&2
  exit 1
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  echo 'cloudflared is not on PATH. Run: export PATH="$HOME/.local/bin:$PATH"' >&2
  exit 1
fi

window_exists() {
  local window_name="$1"
  tmux list-windows -t "$SESSION_NAME" -F '#{window_name}' 2>/dev/null | grep -Fxq "$window_name"
}

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "Session '$SESSION_NAME' is already running; ensuring required windows exist."
  if ! window_exists app; then
    tmux new-window -t "$SESSION_NAME" -n app "$APP_CMD"
  fi
  if ! window_exists ductor; then
    tmux new-window -t "$SESSION_NAME" -n ductor "$DUCTOR_CMD"
  fi
  if ! window_exists tunnel; then
    tmux new-window -t "$SESSION_NAME" -n tunnel "$TUNNEL_CMD"
  fi
else
  tmux new-session -d -s "$SESSION_NAME" -n app "$APP_CMD"
  tmux new-window -t "$SESSION_NAME" -n ductor "$DUCTOR_CMD"
  tmux new-window -t "$SESSION_NAME" -n tunnel "$TUNNEL_CMD"
fi

cat <<EOF
Remote dev stack started in tmux session '$SESSION_NAME'.

Windows:
- 0: app
- 1: ductor
- 2: tunnel

Useful commands:
- tmux attach -t $SESSION_NAME
- npm run remote:stack:status
- npm run remote:stack:stop
EOF
