#!/usr/bin/env bash
# Apply portable migrations in order using schema_migrations ledger.
# Prefer DB_CONTAINER=name, or psql + DATABASE_MIGRATE_URL / DATABASE_URL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="${DATABASE_MIGRATE_URL:-${DATABASE_URL:-}}"

psql_exec() {
  if [[ -n "${DB_CONTAINER:-}" ]]; then
    docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
  elif command -v psql >/dev/null 2>&1 && [[ -n "$URL" ]]; then
    psql "$URL" -v ON_ERROR_STOP=1 "$@"
  else
    echo "Need DB_CONTAINER=... or psql + DATABASE_URL" >&2
    exit 1
  fi
}

apply_file() {
  local f="$1"
  local id
  id="$(basename "$f" .sql)"

  # Ensure ledger exists (000 or bootstrap)
  if [[ "$id" != "000_schema_migrations" ]]; then
    local applied
    applied="$(psql_exec -tAc "SELECT 1 FROM schema_migrations WHERE id = '${id}'" 2>/dev/null | tr -d '[:space:]' || true)"
    if [[ "$applied" == "1" ]]; then
      echo "==> $id (skip, already applied)"
      return 0
    fi
  else
    # 000 may run repeatedly — CREATE TABLE IF NOT EXISTS
    :
  fi

  echo "==> $id"
  if [[ -n "${DB_CONTAINER:-}" ]]; then
    docker cp "$f" "$DB_CONTAINER:/tmp/migrate.sql"
    docker exec "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/migrate.sql
  else
    psql "$URL" -v ON_ERROR_STOP=1 -f "$f"
  fi

  if [[ "$id" != "000_schema_migrations" ]]; then
    psql_exec -c "INSERT INTO schema_migrations (id) VALUES ('${id}') ON CONFLICT DO NOTHING;"
  else
    psql_exec -c "INSERT INTO schema_migrations (id) VALUES ('000_schema_migrations') ON CONFLICT DO NOTHING;"
  fi
}

# Always apply 000 first if present
for f in "$ROOT"/db/migrations/*.sql; do
  apply_file "$f"
done

echo "Migrations applied (ledger: schema_migrations)."
