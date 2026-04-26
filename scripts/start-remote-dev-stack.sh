#!/usr/bin/env bash
set -euo pipefail

SESSION_NAME="portfolio-remote-dev"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

export PATH="$HOME/.local/flutter/bin:$HOME/.local/bin:$PATH"
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # Desktop launcher shells do not read interactive shell startup files.
  # Load nvm here so npm/codex are available before tmux windows are created.
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
fi

TMUX_PATH="$PATH"
BACKEND_CMD="cd '$ROOT_DIR' && export PATH=\"$TMUX_PATH\" && npm run local:start:linux"
FLUTTER_CMD="cd '$ROOT_DIR' && export PATH=\"$TMUX_PATH\" && npm run mobile:dev:web"
DUCTOR_CMD="cd '$ROOT_DIR' && export PATH=\"$TMUX_PATH\" && npm run remote:ductor"
TUNNEL_CMD="cd '$ROOT_DIR' && export PATH=\"$TMUX_PATH\" && npm run preview:tunnel:cloudflare -- 3001"

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
  if window_exists app && ! window_exists backend; then
    tmux rename-window -t "$SESSION_NAME:app" backend
  fi
  if ! window_exists backend; then
    tmux new-window -t "$SESSION_NAME" -n backend "$BACKEND_CMD"
  fi
  if ! window_exists flutter; then
    tmux new-window -t "$SESSION_NAME" -n flutter "$FLUTTER_CMD"
  fi
  if window_exists ductor; then
    tmux respawn-pane -k -t "$SESSION_NAME:ductor" "$DUCTOR_CMD"
  else
    tmux new-window -t "$SESSION_NAME" -n ductor "$DUCTOR_CMD"
  fi
  if window_exists tunnel; then
    tmux respawn-pane -k -t "$SESSION_NAME:tunnel" "$TUNNEL_CMD"
  else
    tmux new-window -t "$SESSION_NAME" -n tunnel "$TUNNEL_CMD"
  fi
else
  tmux new-session -d -s "$SESSION_NAME" -n backend "$BACKEND_CMD"
  tmux new-window -t "$SESSION_NAME" -n flutter "$FLUTTER_CMD"
  tmux new-window -t "$SESSION_NAME" -n ductor "$DUCTOR_CMD"
  tmux new-window -t "$SESSION_NAME" -n tunnel "$TUNNEL_CMD"
fi

cat <<EOF
Remote dev stack started in tmux session '$SESSION_NAME'.

Windows:
- backend: Next.js API/web host on port 3000
- flutter: Flutter mobile web preview on port 3001
- ductor: Telegram/Codex control plane
- tunnel: Cloudflare quick tunnel to the Flutter preview

Useful commands:
- tmux attach -t $SESSION_NAME
- npm run remote:stack:status
- npm run remote:stack:stop
EOF
