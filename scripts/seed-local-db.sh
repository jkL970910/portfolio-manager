#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SQL_FILE="$ROOT_DIR/scripts/seed.sql"
DATABASE_URL="${DATABASE_URL:-postgresql://portfolio_manager:portfolio_manager@127.0.0.1:5432/portfolio_manager}"

psql "$DATABASE_URL" -f "$SQL_FILE"
