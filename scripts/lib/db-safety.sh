#!/usr/bin/env bash
# Shared safeguards for destructive DB operations.
# shellcheck shell=bash

# Allowed target kinds for TRUNCATE / replace loads.
# - disposable: ephemeral Docker self-check containers (name frc-selfcheck-*)
# - staging: explicitly labeled staging DB (dbname or FRC_TARGET_KIND)
# - production: blocked unless FRC_I_UNDERSTAND_PRODUCTION_LOAD=YES (still requires typed confirm)
frc_require_bash() {
  if [[ -z "${BASH_VERSION:-}" ]]; then
    echo "These scripts require bash." >&2
    exit 1
  fi
}

frc_mask_url() {
  # postgres://user:pass@host:5432/db → postgres://user:***@host:5432/db
  local url="$1"
  echo "$url" | sed -E 's#(postgres(ql)?://[^:/@]+):[^@]+@#\1:***@#'
}

frc_parse_dbname_from_url() {
  local url="$1"
  # strip query; take path after host
  local path
  path="$(echo "$url" | sed -E 's#[?#].*##; s#^.*/##')"
  echo "$path"
}

frc_parse_host_from_url() {
  local url="$1"
  echo "$url" | sed -E 's#^postgres(ql)?://([^@]+@)?([^:/]+).*#\3#'
}

frc_is_disposable_container() {
  local name="${1:-}"
  [[ "$name" == frc-selfcheck-* || "$name" == frc-backup-extract-* || "$name" == frc-staging-* ]]
}

frc_assert_backup_readonly() {
  local backup="$1"
  if [[ ! -f "$backup" ]]; then
    echo "Backup not found: $backup" >&2
    exit 1
  fi
  if [[ ! -r "$backup" ]]; then
    echo "Backup is not readable: $backup" >&2
    exit 1
  fi
  # Refuse to proceed if caller tries to point "backup" at a writable pipe we might overwrite —
  # we never write to this path; assert it is a regular file.
  if [[ ! -f "$backup" || -L "$backup" ]]; then
    # symlinks OK if target is regular file
    if [[ -L "$backup" && ! -f "$backup" ]]; then
      echo "Backup path is not a regular file: $backup" >&2
      exit 1
    fi
  fi
  local before after
  before="$(stat -c '%i %s %Y' "$backup" 2>/dev/null || stat -f '%i %z %m' "$backup")"
  # exported for post-check
  FRC_BACKUP_FINGERPRINT="$before"
  export FRC_BACKUP_FINGERPRINT
}

frc_assert_backup_unchanged() {
  local backup="$1"
  local after
  after="$(stat -c '%i %s %Y' "$backup" 2>/dev/null || stat -f '%i %z %m' "$backup")"
  if [[ "$after" != "${FRC_BACKUP_FINGERPRINT:-}" ]]; then
    echo "FATAL: backup file fingerprint changed during run — aborting. Path: $backup" >&2
    exit 1
  fi
}

frc_resolve_target_kind() {
  # Sets FRC_RESOLVED_KIND and FRC_TARGET_IDENTITY (safe to print)
  local kind="${FRC_TARGET_KIND:-}"
  local dbname="" host="" identity=""

  if [[ -n "${DB_CONTAINER:-}" ]]; then
    identity="container:${DB_CONTAINER}"
    if frc_is_disposable_container "$DB_CONTAINER"; then
      kind="${kind:-disposable}"
    else
      kind="${kind:-unknown}"
    fi
  elif [[ -n "${DATABASE_MIGRATE_URL:-${DATABASE_URL:-}}" ]]; then
    local url="${DATABASE_MIGRATE_URL:-$DATABASE_URL}"
    dbname="$(frc_parse_dbname_from_url "$url")"
    host="$(frc_parse_host_from_url "$url")"
    identity="url:$(frc_mask_url "$url") db=${dbname} host=${host}"
    if [[ -z "$kind" ]]; then
      case "$dbname" in
        *staging*|*stage*|*selfcheck*|*test*|*dev*) kind="staging" ;;
        *prod*|*production*) kind="production" ;;
        postgres|family_roots|family-roots*) kind="unknown" ;;
        *) kind="unknown" ;;
      esac
    fi
  else
    echo "No DB_CONTAINER or DATABASE_URL — refusing to run." >&2
    exit 1
  fi

  FRC_RESOLVED_KIND="$kind"
  FRC_TARGET_IDENTITY="$identity"
  export FRC_RESOLVED_KIND FRC_TARGET_IDENTITY
}

frc_refuse_unknown_or_prod_for_destructive() {
  frc_resolve_target_kind
  echo "Target: ${FRC_TARGET_IDENTITY}"
  echo "Kind:   ${FRC_RESOLVED_KIND}"

  case "$FRC_RESOLVED_KIND" in
    disposable|staging)
      ;;
    production)
      if [[ "${FRC_I_UNDERSTAND_PRODUCTION_LOAD:-}" != "YES" ]]; then
        echo "Refusing production load. Set FRC_TARGET_KIND=staging (preferred) or, only if deliberate:" >&2
        echo "  FRC_TARGET_KIND=production FRC_I_UNDERSTAND_PRODUCTION_LOAD=YES FRC_CONFIRM=REPLACE_ALL_DATA" >&2
        exit 1
      fi
      ;;
    *)
      echo "Refusing load into unknown database identity." >&2
      echo "Set FRC_TARGET_KIND=staging|disposable explicitly after verifying the target." >&2
      echo "Default to a dedicated staging DB, e.g. DB_CONTAINER=frc-staging-local" >&2
      exit 1
      ;;
  esac
}

frc_require_destructive_confirm() {
  # Non-interactive: FRC_CONFIRM=REPLACE_ALL_DATA
  # Interactive: type REPLACE_ALL_DATA
  local expected="REPLACE_ALL_DATA"
  if [[ "${FRC_CONFIRM:-}" == "$expected" ]]; then
    echo "FRC_CONFIRM accepted for destructive load."
    return 0
  fi
  if [[ ! -t 0 ]]; then
    echo "Non-interactive shell: set FRC_CONFIRM=REPLACE_ALL_DATA to allow truncate/replace." >&2
    exit 1
  fi
  echo ""
  echo "WARNING: This will TRUNCATE application tables and reload from backup."
  echo "Target: ${FRC_TARGET_IDENTITY}"
  echo "Type ${expected} to continue:"
  local typed
  read -r typed
  if [[ "$typed" != "$expected" ]]; then
    echo "Confirmation mismatch — aborting (no data changed)." >&2
    exit 1
  fi
}

frc_require_allow_destructive_flag() {
  # Extra belt: scripts that truncate must set/export this after checks pass
  if [[ "${FRC_ALLOW_DESTRUCTIVE:-}" != "1" ]]; then
    echo "Internal error: FRC_ALLOW_DESTRUCTIVE not granted." >&2
    exit 1
  fi
}
