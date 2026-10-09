#!/usr/bin/env bash
# Apply portable migrations in order.
# Prefer DATABASE_URL + local psql, or DB_CONTAINER=name to exec into a running Postgres container.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="${DATABASE_MIGRATE_URL:-${DATABASE_URL:-}}"

apply_file() {
  local f="$1"
  echo "==> $(basename "$f")"
  if [[ -n "${DB_CONTAINER:-}" ]]; then
    docker cp "$f" "$DB_CONTAINER:/tmp/migrate.sql"
    docker exec "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/migrate.sql
  elif command -v psql >/dev/null 2>&1 && [[ -n "$URL" ]]; then
    psql "$URL" -v ON_ERROR_STOP=1 -f "$f"
  else
    echo "Need DB_CONTAINER=... or psql + DATABASE_URL" >&2
    exit 1
  fi
}

for f in "$ROOT"/db/migrations/*.sql; do
  apply_file "$f"
done

echo "Migrations applied."
