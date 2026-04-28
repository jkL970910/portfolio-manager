#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE_DIR="$ROOT_DIR/apps/mobile"
PORT="${1:-3001}"
API_BASE_URL="${LOO_API_BASE_URL:-${PORTFOLIO_API_BASE_URL:-}}"

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
if [ -n "$API_BASE_URL" ]; then
  echo "==> Using explicit API base URL: $API_BASE_URL"
fi

if [ "${FLUTTER_MOBILE_DEV_SERVER:-}" != "1" ]; then
  build_args=(build web --release)
  if [ -n "$API_BASE_URL" ]; then
    build_args+=(--dart-define=LOO_API_BASE_URL="$API_BASE_URL")
  fi

  echo '==> Building Flutter mobile web release bundle'
  flutter "${build_args[@]}"

  echo "==> Serving Flutter mobile web release bundle on http://127.0.0.1:${PORT}"
  cd "$ROOT_DIR"
  exec env FLUTTER_WEB_PORT="$PORT" node ./scripts/serve-flutter-web.mjs
fi

echo '==> FLUTTER_MOBILE_DEV_SERVER=1 detected; using Flutter debug web server'
args=(
  run
  -d web-server \
  --web-hostname 0.0.0.0 \
  --web-port "$PORT"
)

if [ -n "$API_BASE_URL" ]; then
  args+=(--dart-define=LOO_API_BASE_URL="$API_BASE_URL")
fi

exec flutter "${args[@]}"
