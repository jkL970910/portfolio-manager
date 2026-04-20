#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v ductor >/dev/null 2>&1; then
  echo 'ductor is not installed.' >&2
  echo 'Install it first, then rerun npm run remote:ductor' >&2
  exit 1
fi

if ! command -v codex >/dev/null 2>&1; then
  echo 'codex CLI is not installed or not on PATH.' >&2
  echo 'Install it first, then rerun npm run remote:ductor' >&2
  exit 1
fi

cd "$ROOT_DIR"
echo "==> Starting ductor from $ROOT_DIR"
exec ductor