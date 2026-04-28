#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-3000}"
URL="http://127.0.0.1:${PORT}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.local"
LOG_FILE="$STATE_DIR/cloudflared.log"
URL_FILE="$STATE_DIR/cloudflare-tunnel-url.txt"
SENT_MARKER="$STATE_DIR/cloudflare-tunnel-url.sent"
DUCTOR_CONFIG="$HOME/.ductor/config/config.json"

mkdir -p "$STATE_DIR"
: > "$LOG_FILE"
rm -f "$SENT_MARKER"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo 'cloudflared is not installed.' >&2
  echo 'Install it first, then rerun npm run preview:tunnel:cloudflare' >&2
  exit 1
fi

send_telegram_message() {
  local public_url="$1"

  if [ ! -f "$DUCTOR_CONFIG" ]; then
    return 0
  fi

  python3 - "$DUCTOR_CONFIG" "$public_url" <<'PY'
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

config_path = Path(sys.argv[1])
public_url = sys.argv[2]
config = json.loads(config_path.read_text())
token = config.get('telegram_token')
user_ids = config.get('allowed_user_ids') or []
if not token or not user_ids:
    raise SystemExit(0)
chat_id = user_ids[0]
message = (
    'Portfolio Remote Dev Status\n'
    '\n'
    'Stack: online\n'
    'Backend/API: http://127.0.0.1:3000\n'
    'Flutter preview: http://127.0.0.1:3001\n'
    'Mobile preview proxy: http://127.0.0.1:3010\n'
    f'Preview URL: {public_url}\n'
    'Project: ~/projects/portfolio-manager\n'
    'Tunnel file: ~/projects/portfolio-manager/.local/cloudflare-tunnel-url.txt\n'
    'tmux session: portfolio-remote-dev\n'
    '\n'
    'Useful checks:\n'
    '- npm run remote:stack:status\n'
    '- tmux attach -t portfolio-remote-dev'
)
payload = urllib.parse.urlencode({'chat_id': chat_id, 'text': message}).encode()
req = urllib.request.Request(f'https://api.telegram.org/bot{token}/sendMessage', data=payload)
with urllib.request.urlopen(req, timeout=20) as resp:
    resp.read()
PY
}

echo "==> Opening Cloudflare quick tunnel for ${URL}"
cloudflared tunnel --url "$URL" 2>&1 | tee "$LOG_FILE" | while IFS= read -r line; do
  echo "$line"
  if [ ! -f "$SENT_MARKER" ]; then
    public_url=$(printf '%s\n' "$line" | grep -oE 'https://[-a-zA-Z0-9]+\.trycloudflare\.com' | head -n 1 || true)
    if [ -n "$public_url" ]; then
      printf '%s\n' "$public_url" > "$URL_FILE"
      touch "$SENT_MARKER"
      echo "==> Saved tunnel URL to $URL_FILE"
      send_telegram_message "$public_url" || true
    fi
  fi
done
