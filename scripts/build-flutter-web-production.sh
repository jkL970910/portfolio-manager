#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE_DIR="$ROOT_DIR/apps/mobile"
API_BASE_URL="${LOO_API_BASE_URL:-${PORTFOLIO_API_BASE_URL:-}}"
BASE_HREF="${FLUTTER_WEB_BASE_HREF:-/}"

if ! command -v flutter >/dev/null 2>&1; then
  echo 'flutter is not on PATH.' >&2
  echo 'Install Flutter or build mobile web on a machine where Flutter is available.' >&2
  exit 1
fi

if [ ! -f "$MOBILE_DIR/pubspec.yaml" ]; then
  echo "Flutter app not found at $MOBILE_DIR." >&2
  exit 1
fi

build_args=(build web --release --base-href "$BASE_HREF")
if [ -n "$API_BASE_URL" ]; then
  build_args+=(--dart-define=LOO_API_BASE_URL="$API_BASE_URL")
fi

cd "$MOBILE_DIR"
flutter pub get
flutter "${build_args[@]}"

cat <<EOF
Flutter Web production build completed:
  output: $MOBILE_DIR/build/web
  api:    ${API_BASE_URL:-same-origin runtime origin}
  base:   $BASE_HREF

For Cloudflare Pages direct upload:
  wrangler pages deploy "$MOBILE_DIR/build/web" --project-name portfolio-manager-mobile
EOF
