# Cutover plan

## Principles

- Never modify or delete `/home/abdosh/Downloads/family-roots-connect-89_261009.backup`.
- Never delete or disable the Lovable/Supabase project until post-cutover soak is accepted.
- No automatic production cutover — requires explicit approval.
- Prefer disposable Docker Postgres for restore rehearsals.

## Stages

### Stage 0 — Inventory (done this session)

- [x] Repository Supabase inventory
- [x] `pg_restore -l` TOC
- [x] Disposable restore for columns, counts, auth hash format
- [x] Docs under `docs/migration/`

### Stage 1 — Portable schema + migrate scripts

- [x] Apply `db/migrations/*` to empty staging Postgres 17+ (`bun run db:self-check`)
- [x] Run `scripts/load-from-supabase-backup.sh` into staging (selective TOC)
- [x] Validate row counts and FK integrity (298/295/0/6/9/2/12; zero orphan links)
- [ ] Verify bcrypt login for a test admin in staging (no production)

### Stage 2 — Backend dual-run

- [x] `DATABASE_URL` server client + auth sessions (cookie `frc_session`)
- [x] Port read path (`fetchFamilyGraph`) behind `DATA_BACKEND=postgres|supabase`
- [x] Port mutations and join/admin (dual-run in lib + serverFns)
- [x] Replace Realtime with polling/invalidation when `DATA_BACKEND=postgres`
- [x] Keep Supabase path default until staging sign-off
- [x] Loader safeguards: `FRC_TARGET_KIND` + `FRC_CONFIRM=REPLACE_ALL_DATA` (`bun run db:safety-check`)

### Stage 3 — Staging acceptance checklist

- [ ] Public tree / search / relationship / statistics
- [ ] Sign-up, sign-in, sign-out, session expiry
- [ ] Join submit; claim picker privacy
- [ ] Admin approve/reject; person CRUD; sibling order
- [ ] Backup export/import merge+replace
- [ ] Family assistant tools (admin)
- [ ] Unauthorized access attempts (non-admin write, foreign claim read)
- [ ] Photo path fallback (`/yonis.png`) still works

### Stage 4 — Production data load (manual approval)

1. Take a **fresh** Supabase dump immediately before cutover (do not overwrite the Oct 9 file; store alongside with new timestamp).
2. Restore into production Postgres using the same selective script.
3. Diff counts vs dump inventory.
4. Smoke-test auth for admins.

### Stage 5 — Traffic cutover (manual approval)

1. Deploy app build with `DATA_BACKEND=postgres` and no required `VITE_SUPABASE_*` for runtime reads.
2. Keep Supabase project online read-only if possible for 7 days.
3. Monitor errors / join / admin.

### Stage 6 — Decommission (later, separate approval)

- Remove `@supabase/supabase-js` and `src/integrations/supabase/*`.
- Drop Coolify Supabase env vars.
- Optionally export/archive Supabase project.

## Selective restore procedure (staging)

Requires Docker with `postgres:18` image (dump format 1.16).

```bash
# 1) Start empty DB
docker run -d --name frc-staging -e POSTGRES_PASSWORD=staging -p 5433:5432 postgres:17-alpine

# 2) Apply portable migrations
psql "$DATABASE_MIGRATE_URL" -f db/migrations/001_extensions_and_users.sql
# ... remaining files in order

# 3) Load data from backup (script extracts public + auth.users → app_users)
./scripts/load-from-supabase-backup.sh \
  "/home/abdosh/Downloads/family-roots-connect-89_261009.backup" \
  "$DATABASE_MIGRATE_URL"
```

The load script must:

1. Restore `auth.users` into a temporary schema (or COPY filtered columns).
2. Insert into `app_users (id, email, password_hash, email_verified_at, created_at)`.
3. COPY/restore `people`, `parent_child`, `marriages`, `user_roles`, `person_claims`, `person_submissions` preserving IDs.
4. Never print password hashes or PII to logs.
5. Leave the original `.backup` file untouched.

## Validation queries (safe)

```sql
SELECT 'people' t, count(*) FROM people
UNION ALL SELECT 'parent_child', count(*) FROM parent_child
UNION ALL SELECT 'marriages', count(*) FROM marriages
UNION ALL SELECT 'person_claims', count(*) FROM person_claims
UNION ALL SELECT 'person_submissions', count(*) FROM person_submissions
UNION ALL SELECT 'user_roles', count(*) FROM user_roles
UNION ALL SELECT 'app_users', count(*) FROM app_users;

-- Expect (from Oct 9 backup): 298, 295, 0, 6, 9, 2, 12
```

FK / orphan checks:

```sql
SELECT count(*) FROM parent_child pc
LEFT JOIN people p ON p.id = pc.parent_id WHERE p.id IS NULL;
-- expect 0 (same for child_id, claims, etc.)
```

## Rollback

| Failure point | Action |
| ------------- | ------ |
| Staging restore fails | Destroy staging DB only; backup file intact |
| App bug after deploy | Redeploy previous Coolify image; set Supabase env; `DATA_BACKEND=supabase` |
| Data corruption suspicion | Restore fresh dump into new Postgres; point `DATABASE_URL` back after validation |

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Dump newer than repo migrations (or vice versa) | Diff functions after each dump; re-apply portable migrations |
| Bcrypt verify mismatch | Staging login test; password-reset fallback |
| Realtime UX regression | Polling interval tuned on join/admin pages |
| Storage photos added later on Supabase | Re-check `storage.objects` count before cutover |
| Accidental restore of vault/auth schemas | Selective script; never full `pg_restore` into app DB |

## Local development

1. Docker Postgres 17+ on localhost.
2. Copy `.env.example` → `.env`; set `DATABASE_URL`, `SESSION_SECRET`.
3. `bun run db:migrate` then optional `bun run db:load-backup -- /path/to.backup`.
4. Until dual-run is complete, Supabase env vars still required for the default path.

## Unresolved decisions requiring product input

1. Cutover window and who performs Coolify env switch.
2. Password-reset email provider (if hash migration abandoned).
3. Whether marriages UI should start loading `marriages` rows (schema ready; UI currently ignores).
