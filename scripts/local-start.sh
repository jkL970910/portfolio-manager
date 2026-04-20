#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_LOCAL="$ROOT_DIR/.env.local"
SEED_STAMP_DIR="$ROOT_DIR/.local"
SEED_STAMP="$SEED_STAMP_DIR/seeded.flag"
DEFAULT_DATABASE_URL='postgresql://portfolio_manager@127.0.0.1:5434/portfolio_manager'

cd "$ROOT_DIR"

if [ ! -d node_modules ]; then
  echo '==> Installing npm dependencies'
  npm install
else
  echo '==> npm dependencies already installed'
fi

if [ ! -f "$ENV_LOCAL" ]; then
  cp "$ROOT_DIR/.env.example" "$ENV_LOCAL"
  python3 - <<'PY'
from pathlib import Path
path = Path('.env.local')
text = path.read_text()
text = text.replace('postgresql://portfolio_manager@127.0.0.1:5433/portfolio_manager', 'postgresql://portfolio_manager:portfolio_manager@127.0.0.1:5432/portfolio_manager')
text = text.replace('replace-me-before-production', 'replace-with-a-random-secret')
path.write_text(text)
PY
  echo '==> Created .env.local for WSL/Linux runtime'
else
  echo '==> Using existing .env.local'
fi

if [ -z "${DATABASE_URL:-}" ] && [ -f "$ENV_LOCAL" ]; then
  env_database_url="$(
    python3 - "$ENV_LOCAL" <<'PY'
import sys
from pathlib import Path

for line in Path(sys.argv[1]).read_text(encoding="utf-8-sig").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    if key.strip() == "DATABASE_URL":
        print(value.strip().strip('"').strip("'"))
        break
PY
  )"
  if [ -n "$env_database_url" ]; then
    export DATABASE_URL="$env_database_url"
  fi
fi

export DATABASE_URL="${DATABASE_URL:-$DEFAULT_DATABASE_URL}"

if ! pg_isready -d "$DATABASE_URL" >/dev/null 2>&1; then
  echo '==> Starting project PostgreSQL'
  bash "$ROOT_DIR/scripts/start-local-postgres.sh"
fi

echo '==> Pushing Drizzle schema'
npm run db:push

mkdir -p "$SEED_STAMP_DIR"
if [ ! -f "$SEED_STAMP" ]; then
  echo '==> Seeding local database'
  npm run db:seed:linux
  date -Iseconds > "$SEED_STAMP"
else
  echo '==> Seed already applied; skipping db:seed:linux'
fi

echo '==> Starting Next.js dev server'
npm run dev
