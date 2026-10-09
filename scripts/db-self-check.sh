#!/usr/bin/env bash
# Apply migrations + selective load into a disposable Postgres; verify counts.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP="${1:-/home/abdosh/Downloads/family-roots-connect-89_261009.backup}"
NAME="frc-selfcheck-$$"
PG_IMAGE=postgres:18-alpine

if [[ ! -f "$BACKUP" ]]; then
  echo "Backup not found: $BACKUP" >&2
  exit 1
fi

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$NAME" \
  -e POSTGRES_PASSWORD=check \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  "$PG_IMAGE" >/dev/null

for i in $(seq 1 40); do
  docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

export DB_CONTAINER="$NAME"
"$ROOT/scripts/db-migrate.sh"
"$ROOT/scripts/load-from-supabase-backup.sh" "$BACKUP"

docker exec "$NAME" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  c int;
BEGIN
  SELECT count(*) INTO c FROM people; IF c <> 298 THEN RAISE EXCEPTION 'people=%', c; END IF;
  SELECT count(*) INTO c FROM parent_child; IF c <> 295 THEN RAISE EXCEPTION 'parent_child=%', c; END IF;
  SELECT count(*) INTO c FROM marriages; IF c <> 0 THEN RAISE EXCEPTION 'marriages=%', c; END IF;
  SELECT count(*) INTO c FROM person_claims; IF c <> 6 THEN RAISE EXCEPTION 'claims=%', c; END IF;
  SELECT count(*) INTO c FROM person_submissions; IF c <> 9 THEN RAISE EXCEPTION 'submissions=%', c; END IF;
  SELECT count(*) INTO c FROM user_roles; IF c <> 2 THEN RAISE EXCEPTION 'roles=%', c; END IF;
  SELECT count(*) INTO c FROM app_users; IF c <> 12 THEN RAISE EXCEPTION 'users=%', c; END IF;
  SELECT count(*) INTO c FROM parent_child pc LEFT JOIN people p ON p.id = pc.parent_id WHERE p.id IS NULL;
  IF c <> 0 THEN RAISE EXCEPTION 'orphan parents=%', c; END IF;
END $$;
SELECT 'db-self-check OK' AS status;
SQL
