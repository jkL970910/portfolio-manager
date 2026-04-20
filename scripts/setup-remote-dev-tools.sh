#!/usr/bin/env bash
set -euo pipefail

mkdir -p "$HOME/.local/bin"
if ! grep -Fqx 'export PATH="$HOME/.local/bin:$PATH"' "$HOME/.bashrc" 2>/dev/null; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
fi

npm install -g @openai/codex --prefix "$HOME/.local"
if pipx list | grep -q 'ductor'; then
  pipx upgrade ductor
else
  pipx install ductor
fi
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o "$HOME/.local/bin/cloudflared"
chmod +x "$HOME/.local/bin/cloudflared"

export PATH="$HOME/.local/bin:$PATH"

codex --version
ductor --help >/dev/null
cloudflared --version