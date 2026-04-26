#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE_DIR="$ROOT_DIR/apps/mobile"
PORT="${1:-3001}"
API_BASE_URL="${PORTFOLIO_API_BASE_URL:-http://127.0.0.1:3000}"

if ! command -v flutter >/dev/null 2>&1; then
  echo 'flutter is not on PATH.' >&2
  echo 'Install Flutter or add it to PATH, then rerun npm run mobile:dev:web.' >&2
  exit 1
fi

if [ ! -f "$MOBILE_DIR/pubspec.yaml" ]; then
  echo "Flutter app not found at $MOBILE_DIR." >&2
  exit 1
fi

if [ ! -f "$MOBILE_DIR/web/index.html" ]; then
  echo 'Flutter web platform files are missing.' >&2
  echo 'Run from apps/mobile: flutter create --platforms=web,android .' >&2
  exit 1
fi

cd "$MOBILE_DIR"

echo '==> Resolving Flutter dependencies'
flutter pub get

echo "==> Starting Flutter mobile web preview on http://127.0.0.1:${PORT}"
exec flutter run \
  -d web-server \
  --web-hostname 0.0.0.0 \
  --web-port "$PORT" \
  --dart-define=PORTFOLIO_API_BASE_URL="$API_BASE_URL"
