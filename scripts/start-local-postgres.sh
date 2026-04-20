#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.local/postgres-wsl"
DATA_DIR="$STATE_DIR/data"
RUN_DIR="$STATE_DIR/run"
LOG_FILE="$STATE_DIR/postgres.log"
PORT="${PORT:-5434}"
USER_NAME="${POSTGRES_USER:-portfolio_manager}"
DB_NAME="${POSTGRES_DB:-portfolio_manager}"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"

PG_CTL="$PG_BIN/pg_ctl"
INITDB="$PG_BIN/initdb"
CREATEDB="$PG_BIN/createdb"
PG_ISREADY="$PG_BIN/pg_isready"

for bin in "$PG_CTL" "$INITDB" "$CREATEDB" "$PG_ISREADY"; do
  if [ ! -x "$bin" ]; then
    echo "Required PostgreSQL binary not found: $bin" >&2
    exit 1
  fi
done

mkdir -p "$STATE_DIR" "$RUN_DIR"

if [ ! -f "$DATA_DIR/PG_VERSION" ]; then
  "$INITDB" -D "$DATA_DIR" -U "$USER_NAME" --auth-local=trust --auth-host=trust --encoding=UTF8 --locale=C
  {
    echo
    echo "port = $PORT"
    echo "listen_addresses = '127.0.0.1'"
    echo "unix_socket_directories = '$RUN_DIR'"
  } >> "$DATA_DIR/postgresql.conf"
fi

if ! "$PG_CTL" -D "$DATA_DIR" status >/dev/null 2>&1; then
  if [ -f "$DATA_DIR/postmaster.pid" ]; then
    pid="$(sed -n '1p' "$DATA_DIR/postmaster.pid" || true)"
    if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$DATA_DIR/postmaster.pid"
    fi
  fi
  "$PG_CTL" -D "$DATA_DIR" -l "$LOG_FILE" -o "-p $PORT -h 127.0.0.1 -k $RUN_DIR" start
fi

for _ in $(seq 1 20); do
  if "$PG_ISREADY" -h 127.0.0.1 -p "$PORT" -U "$USER_NAME" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! "$PG_ISREADY" -h 127.0.0.1 -p "$PORT" -U "$USER_NAME" >/dev/null 2>&1; then
  echo "PostgreSQL did not become ready on 127.0.0.1:$PORT" >&2
  exit 1
fi

if ! "$CREATEDB" -h 127.0.0.1 -p "$PORT" -U "$USER_NAME" "$DB_NAME" >/dev/null 2>&1; then
  true
fi

echo "Local PostgreSQL is ready on 127.0.0.1:$PORT with database '$DB_NAME'."
