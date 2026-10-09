# Schema inventory

Sources:

1. Repository migrations in `supabase/migrations/` (15 SQL files).
2. Generated types in `src/integrations/supabase/types.ts`.
3. Custom-format backup `family-roots-connect-89_261009.backup` inspected via Docker `postgres:18` (`pg_restore -l` + disposable restore). **Original backup was not modified.**

## Backup file metadata

| Property | Value |
| -------- | ----- |
| Path | `/home/abdosh/Downloads/family-roots-connect-89_261009.backup` |
| Format | PostgreSQL custom (`PGDMP`), dump version **1.16-0**, zstd |
| Size | ~475 KB |
| Archive created | 2026-10-09 14:38:02 UTC |
| Dumped from | PostgreSQL **17.6** |
| Dumped by | pg_dump **18.6** |
| TOC entries | 715 |
| Compatibility note | `pg_restore` from PostgreSQL **≤16** rejects this dump; use **17+** (18 verified) |

Full TOC copy: `docs/migration/backup-toc.txt`  
Public schema DDL extracted from disposable restore: `docs/migration/public-schema-from-backup.sql` (still contains `auth.uid()` — reference only).

## Schemas in backup (do not restore wholesale)

`auth`, `extensions`, `graphql`, `graphql_public`, `pgbouncer`, `realtime`, `storage`, `supabase_migrations`, `vault`, `public`

Extensions: `pg_stat_statements`, `pgcrypto`, `uuid-ossp`, `supabase_vault` (unavailable on stock Postgres — restore errors expected).

## Application tables in `public` (complete list from backup)

Exactly **six** tables. No `_seed_paths` in the backup (seed helper from early migration only).

### Row counts (disposable restore, 2026-10-09 inspection)

| Table | Rows |
| ----- | ---- |
| `people` | 298 |
| `parent_child` | 295 |
| `marriages` | 0 |
| `person_claims` | 6 |
| `person_submissions` | 9 (8 approved, 1 rejected) |
| `user_roles` | 2 (both `admin`) |
| `auth.users` (Supabase) | 12 (email provider; all have bcrypt-like password hashes; all email_confirmed) |
| `storage.objects` | 0 |
| `storage.buckets` | 2 (`person-photos`, `database_export_09_10_26`) — both private |

`people.photo_url`: **0** non-null values in backup data.

### Column definitions (verified from restore)

**people:** `id`, `first_name`, `middle_name`, `last_name`, `display_name`, `gender` (default `'male'`), `birth_date`, `death_date`, `photo_url`, `notes`, `created_at`, `updated_at`, `is_deceased` (default false)

**parent_child:** `id`, `parent_id`, `child_id`, `relationship_type` (default `'biological'`), `created_at`, `child_order` (smallint, nullable)

**marriages:** `id`, `person1_id`, `person2_id`, `marriage_date`, `notes`, `created_at`

**person_claims:** `user_id` PK → `auth.users`, `person_id` UNIQUE → `people`, `address`, `phone`, `email`, `created_at`

**person_submissions:** full join workflow columns including `added_parent_*` and `other_parent_*` (29 columns)

**user_roles:** `id`, `user_id` → `auth.users`, `role` (`app_role`), `created_at`, UNIQUE `(user_id, role)`

### Functions present in backup

`approve_submission`, `reject_submission`, `has_role`, `claim_admin`, `person_submissions_before_insert`, `set_updated_at`

### Functions in repo migrations but **absent** from backup

| Object | Repo migration | Notes |
| ------ | -------------- | ----- |
| `person_claim_index()` | `20260829130000_harden_join_security.sql` | Used by app (`submissions.ts`) |
| `validate_parent_child_integrity` trigger | same | Max 2 parents, cycle check |
| `confirm_auth_user_on_insert` | `20260828210000_…` | Supabase `auth.users` only — do not port |

### Policies in backup vs later repo harden

Backup still includes policy **"Anyone can read claimed contact"** on `person_claims`. Repo later restricted claims to owner/admin and added `person_claim_index`. **Target authz follows the hardened repo semantics**, not the older public-claims policy.

Storage policies for bucket `person-photos` exist in backup; app TS does not call Storage APIs.

### Indexes / constraints (public)

- PK/unique/check as in `public-schema-from-backup.sql`
- Indexes: `idx_people_display_name`, `idx_pc_parent`, `idx_pc_child`, `idx_person_submissions_status`, `one_pending_submission_per_user`, `one_pending_edit_per_person`
- Triggers in backup: `people_updated_at`, `person_submissions_before_insert`

## Target portable schema decisions

1. Replace FKs to `auth.users` with FKs to `app_users(id)` (preserve UUIDs from Supabase so claims/roles/submissions keep identity).
2. Do **not** create `auth`, `storage`, `realtime`, `vault`, or Supabase roles (`anon`, `authenticated`, `service_role`).
3. Drop RLS as the primary security model; enforce the same rules in the TanStack server. Optional future: Postgres RLS with `SET LOCAL app.user_id`.
4. Rewrite SQL functions that call `auth.uid()` to take `_actor_id uuid` (or read `current_setting('app.user_id')`) and only call them from the server.
5. Add `person_claim_index` + `validate_parent_child_integrity` from repo migrations.
6. Do not port `claim_admin` for authenticated self-bootstrap (revoked in harden migration); admins provisioned via SQL/migrate role.
7. Extensions needed on stock Postgres: `pgcrypto` (for `gen_random_uuid()` if not built-in — PG13+ has it in core on many builds; prefer `gen_random_uuid()` from pgcrypto or PG core).

## Data relationships (integrity checks)

Verified FK graph:

- `parent_child` → `people` (parent, child)
- `marriages` → `people` (person1, person2)
- `person_claims.person_id` → `people`; `user_id` → auth/app users
- `person_submissions` → `people` (optional person/parent/added_parent_of); `user_id` → auth/app users
- `user_roles.user_id` → auth/app users

Live graph loader (`fetchFamilyGraph`) does **not** load `marriages` today (passes empty list) — table still exported/imported by backup UI.

## Unresolved

- Whether production Supabase has drifted past this backup since 2026-10-09 14:38 UTC.
- Exact Coolify Postgres major version to provision (17+ recommended to match dump source).
