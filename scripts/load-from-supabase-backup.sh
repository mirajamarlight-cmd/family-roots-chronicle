#!/usr/bin/env bash
# Selective load from a Supabase custom-format dump into a DB that already has
# portable migrations applied. Never modifies the source .backup file.
#
# SAFETY: Truncates application tables. Defaults to refusing unknown/production targets.
#
# Staging example:
#   DB_CONTAINER=frc-staging-local FRC_TARGET_KIND=staging FRC_CONFIRM=REPLACE_ALL_DATA \
#     ./scripts/load-from-supabase-backup.sh /path/to.backup
#
# Disposable self-check (used by db-self-check.sh):
#   DB_CONTAINER=frc-selfcheck-$$ FRC_TARGET_KIND=disposable FRC_CONFIRM=REPLACE_ALL_DATA \
#     ./scripts/load-from-supabase-backup.sh /path/to.backup
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/db-safety.sh
source "$ROOT/scripts/lib/db-safety.sh"
frc_require_bash

BACKUP="${1:-}"
URL="${DATABASE_MIGRATE_URL:-${DATABASE_URL:-}}"

if [[ -z "$BACKUP" || ! -f "$BACKUP" ]]; then
  echo "Usage: $0 /path/to/backup.dump" >&2
  echo "Requires DB_CONTAINER (preferred) or DATABASE_URL, plus FRC_CONFIRM=REPLACE_ALL_DATA" >&2
  exit 1
fi
if [[ -z "${DB_CONTAINER:-}" && -z "$URL" ]]; then
  echo "Set DB_CONTAINER (preferred staging) or DATABASE_URL" >&2
  exit 1
fi

frc_assert_backup_readonly "$BACKUP"
frc_refuse_unknown_or_prod_for_destructive
frc_require_destructive_confirm
export FRC_ALLOW_DESTRUCTIVE=1
frc_require_allow_destructive_flag

PG_IMAGE="${PG_RESTORE_IMAGE:-postgres:18-alpine}"
TMP_NAME="frc-backup-extract-$$"

cleanup() {
  docker rm -f "$TMP_NAME" >/dev/null 2>&1 || true
  frc_assert_backup_unchanged "$BACKUP" || true
}
trap cleanup EXIT

echo "Starting disposable extract database ($PG_IMAGE) — source backup is read-only mounted via docker cp..."
docker run -d --name "$TMP_NAME" \
  -e POSTGRES_PASSWORD=extract \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  "$PG_IMAGE" >/dev/null

for i in $(seq 1 40); do
  docker exec "$TMP_NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

docker cp "$BACKUP" "$TMP_NAME:/backup.dump"
echo "Restoring dump into disposable extract DB (errors for vault/roles expected)..."
set +e
docker exec "$TMP_NAME" pg_restore -U postgres -d postgres --no-owner --no-acl /backup.dump >/dev/null 2>/tmp/frc-load-restore.err
set -e

docker exec "$TMP_NAME" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  "SELECT 1 FROM public.people LIMIT 1" >/dev/null

psql_target() {
  if [[ -n "${DB_CONTAINER:-}" ]]; then
    docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
  elif command -v psql >/dev/null 2>&1; then
    psql "$URL" -v ON_ERROR_STOP=1 "$@"
  else
    echo "Need DB_CONTAINER or local psql" >&2
    exit 1
  fi
}

# Prove target identity from inside the DB when possible
echo "Validating target database identity..."
TARGET_META="$(psql_target -tAc "SELECT current_database() || ' @ ' || inet_server_addr()::text || ' pid=' || pg_backend_pid()::text" | tr -d '[:space:]')"
echo "  connected: ${TARGET_META}"

echo "Loading into target (TRUNCATE + reload; triggers disabled for bulk import)..."
psql_target <<'SQL'
TRUNCATE public.sessions, public.person_submissions, public.person_claims,
         public.user_roles, public.marriages, public.parent_child, public.people,
         public.app_users CASCADE;
ALTER TABLE public.person_submissions DISABLE TRIGGER USER;
ALTER TABLE public.parent_child DISABLE TRIGGER USER;
ALTER TABLE public.people DISABLE TRIGGER USER;
ALTER TABLE public.app_users DISABLE TRIGGER USER;
SQL

transfer() {
  local src_sql="$1"
  local dest_copy="$2"
  local label="$3"
  local tmpcsv
  tmpcsv="$(mktemp)"
  docker exec "$TMP_NAME" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -c "\copy ($src_sql) TO STDOUT WITH (FORMAT csv, NULL 'NULL')" >"$tmpcsv"
  local rows
  rows="$(wc -l <"$tmpcsv" | tr -d ' ')"
  if [[ -n "${DB_CONTAINER:-}" ]]; then
    docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
      -c "\copy $dest_copy FROM STDIN WITH (FORMAT csv, NULL 'NULL')" <"$tmpcsv"
  else
    psql "$URL" -v ON_ERROR_STOP=1 \
      -c "\copy $dest_copy FROM STDIN WITH (FORMAT csv, NULL 'NULL')" <"$tmpcsv"
  fi
  rm -f "$tmpcsv"
  echo "  loaded $label: $rows rows"
}

transfer \
  "SELECT id, lower(email::text), encrypted_password, email_confirmed_at, created_at, COALESCE(updated_at, created_at) FROM auth.users WHERE email IS NOT NULL AND encrypted_password IS NOT NULL AND encrypted_password <> ''" \
  "public.app_users (id, email, password_hash, email_verified_at, created_at, updated_at)" \
  "app_users"

transfer \
  "SELECT id, first_name, middle_name, last_name, display_name, gender, birth_date, death_date, photo_url, notes, created_at, updated_at, is_deceased FROM public.people" \
  "public.people (id, first_name, middle_name, last_name, display_name, gender, birth_date, death_date, photo_url, notes, created_at, updated_at, is_deceased)" \
  "people"

transfer \
  "SELECT id, parent_id, child_id, relationship_type, created_at, child_order FROM public.parent_child" \
  "public.parent_child (id, parent_id, child_id, relationship_type, created_at, child_order)" \
  "parent_child"

transfer \
  "SELECT id, person1_id, person2_id, marriage_date, notes, created_at FROM public.marriages" \
  "public.marriages (id, person1_id, person2_id, marriage_date, notes, created_at)" \
  "marriages"

transfer \
  "SELECT id, user_id, role, created_at FROM public.user_roles" \
  "public.user_roles (id, user_id, role, created_at)" \
  "user_roles"

transfer \
  "SELECT user_id, person_id, address, phone, email, created_at FROM public.person_claims" \
  "public.person_claims (user_id, person_id, address, phone, email, created_at)" \
  "person_claims"

transfer \
  "SELECT id, user_id, kind, status, person_id, parent_id, link_side, first_name, middle_name, last_name, birth_date, address, phone, email, notes, other_parent_name, created_at, reviewed_at, added_parent_first_name, added_parent_middle_name, added_parent_last_name, added_parent_birth_date, added_parent_death_date, added_parent_of, other_parent_first_name, other_parent_middle_name, other_parent_last_name, other_parent_birth_date, other_parent_death_date FROM public.person_submissions" \
  "public.person_submissions (id, user_id, kind, status, person_id, parent_id, link_side, first_name, middle_name, last_name, birth_date, address, phone, email, notes, other_parent_name, created_at, reviewed_at, added_parent_first_name, added_parent_middle_name, added_parent_last_name, added_parent_birth_date, added_parent_death_date, added_parent_of, other_parent_first_name, other_parent_middle_name, other_parent_last_name, other_parent_birth_date, other_parent_death_date)" \
  "person_submissions"

psql_target <<'SQL'
ALTER TABLE public.person_submissions ENABLE TRIGGER USER;
ALTER TABLE public.parent_child ENABLE TRIGGER USER;
ALTER TABLE public.people ENABLE TRIGGER USER;
ALTER TABLE public.app_users ENABLE TRIGGER USER;

SELECT 'people' AS t, count(*)::int AS n FROM public.people
UNION ALL SELECT 'parent_child', count(*)::int FROM public.parent_child
UNION ALL SELECT 'marriages', count(*)::int FROM public.marriages
UNION ALL SELECT 'person_claims', count(*)::int FROM public.person_claims
UNION ALL SELECT 'person_submissions', count(*)::int FROM public.person_submissions
UNION ALL SELECT 'user_roles', count(*)::int FROM public.user_roles
UNION ALL SELECT 'app_users', count(*)::int FROM public.app_users
ORDER BY 1;

SELECT count(*)::int AS orphan_parent_links
FROM public.parent_child pc
LEFT JOIN public.people p ON p.id = pc.parent_id
WHERE p.id IS NULL;

SELECT count(*)::int AS orphan_child_links
FROM public.parent_child pc
LEFT JOIN public.people p ON p.id = pc.child_id
WHERE p.id IS NULL;
SQL

frc_assert_backup_unchanged "$BACKUP"
echo "Load complete. Source backup unchanged (fingerprint verified)."
echo "Expected Oct 9 inventory: people=298 parent_child=295 marriages=0 claims=6 submissions=9 roles=2 users=12"
