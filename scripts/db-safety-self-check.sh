#!/usr/bin/env bash
# Prove destructive loader refuses unsafe targets and wrong confirmation.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP="${1:-/home/abdosh/Downloads/family-roots-connect-89_261009.backup}"
FAILS=0

expect_fail() {
  local label="$1"
  shift
  echo "== expect fail: $label"
  if "$@" >/tmp/frc-safety-out.txt 2>/tmp/frc-safety-err.txt; then
    echo "FAIL: expected refusal for: $label" >&2
    cat /tmp/frc-safety-err.txt >&2 || true
    FAILS=$((FAILS + 1))
  else
    echo "OK refused: $label"
  fi
}

# 1) No target
expect_fail "no target" \
  env -u DB_CONTAINER -u DATABASE_URL -u DATABASE_MIGRATE_URL \
  bash "$ROOT/scripts/load-from-supabase-backup.sh" "$BACKUP"

# 2) Unknown URL without kind
expect_fail "unknown url" \
  env -u DB_CONTAINER FRC_CONFIRM=REPLACE_ALL_DATA \
  DATABASE_URL="postgres://u:p@127.0.0.1:5432/postgres" \
  bash "$ROOT/scripts/load-from-supabase-backup.sh" "$BACKUP"

# 3) Staging kind but missing confirm (non-interactive)
expect_fail "missing confirm" \
  env -u DB_CONTAINER FRC_TARGET_KIND=staging \
  DATABASE_URL="postgres://u:p@127.0.0.1:5432/family_roots_staging" \
  bash "$ROOT/scripts/load-from-supabase-backup.sh" "$BACKUP"

# 4) Production without override
expect_fail "production blocked" \
  env -u DB_CONTAINER FRC_TARGET_KIND=production FRC_CONFIRM=REPLACE_ALL_DATA \
  DATABASE_URL="postgres://u:p@127.0.0.1:5432/family_roots_prod" \
  bash "$ROOT/scripts/load-from-supabase-backup.sh" "$BACKUP"

# 5) Wrong container name treated as unknown without kind
expect_fail "unknown container" \
  env -u DATABASE_URL DB_CONTAINER=something-else FRC_CONFIRM=REPLACE_ALL_DATA \
  bash "$ROOT/scripts/load-from-supabase-backup.sh" "$BACKUP"

if [[ "$FAILS" -ne 0 ]]; then
  echo "db-safety-self-check: $FAILS failure(s)" >&2
  exit 1
fi
echo "db-safety-self-check: all refusal cases OK"
