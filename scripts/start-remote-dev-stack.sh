#!/usr/bin/env bash
set -euo pipefail

SESSION_NAME="portfolio-remote-dev"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

export PATH="$HOME/.local/flutter/bin:$HOME/.local/bin:$PATH"
unset npm_config_prefix NPM_CONFIG_PREFIX
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # Desktop launcher shells do not read interactive shell startup files.
  # Load nvm here so npm/codex are available before tmux windows are created.
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
fi

TMUX_PATH="$PATH"
DUCTOR_CMD="cd '$ROOT_DIR' && export PATH=\"$TMUX_PATH\" && npm run remote:ductor"
STALE_WINDOWS=(backend app flutter proxy tunnel)

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

window_exists() {
  local window_name="$1"
  tmux list-windows -t "$SESSION_NAME" -F '#{window_name}' 2>/dev/null | grep -Fxq "$window_name"
}

stop_stale_project_windows() {
  for window_name in "${STALE_WINDOWS[@]}"; do
    if window_exists "$window_name"; then
      tmux kill-window -t "$SESSION_NAME:$window_name"
    fi
  done
}

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "Session '$SESSION_NAME' is already running; switching to bot-only mode."
  if window_exists ductor; then
    tmux respawn-pane -k -t "$SESSION_NAME:ductor" "$DUCTOR_CMD"
  else
    tmux new-window -t "$SESSION_NAME" -n ductor "$DUCTOR_CMD"
  fi
  stop_stale_project_windows
else
  tmux new-session -d -s "$SESSION_NAME" -n ductor "$DUCTOR_CMD"
fi

cat <<EOF
Loo Telegram bot interface started in tmux session '$SESSION_NAME'.

Windows:
- ductor: Telegram/Codex control plane

Local portfolio, Flutter preview, preview proxy, and Cloudflare tunnel are no longer started by this launcher because those apps are deployed on Vercel.

Useful commands:
- tmux attach -t $SESSION_NAME
- npm run remote:stack:status
- npm run remote:stack:stop
EOF
