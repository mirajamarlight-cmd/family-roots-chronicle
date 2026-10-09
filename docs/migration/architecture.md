# Target architecture — Family Roots Chronicle

Status: Phase 1–3 complete (inspection + design). Supabase remains the live backend until cutover is approved.

## Current architecture (verified)

| Layer | Technology |
| ----- | ---------- |
| UI | React 19, TanStack Router (file routes), TanStack Query |
| App shell | TanStack Start + Vite 8 + Nitro (`NITRO_PRESET=node-server` for Coolify) |
| Backend today | Supabase: Auth + PostgREST + Realtime + Postgres RLS |
| Deploy | Coolify Docker (`Dockerfile`), domain `babafeqi.raafat.site` |
| LLM assistant | Gemini / Groq / OpenAI env keys (not Supabase) |

Data flow today:

```
Browser
  ├─ @supabase/supabase-js (publishable key) → PostgREST + Auth + Realtime
  └─ TanStack serverFns + Bearer JWT → user-scoped Supabase client
       └─ service-role client → backup replace / claims wipe
```

Entry points: `src/server.ts`, `src/start.ts`, `src/router.tsx`, `src/routes/**`.

## Target architecture

Keep TanStack Start. Move all database access and authorization into server-owned code. The browser never receives `DATABASE_URL` or password hashes.

```
Browser
  ├─ Auth UI → serverFns (cookie session)
  ├─ Family / join / admin UI → serverFns / API handlers
  └─ Optional light polling or SSE for live refresh
         │
         ▼
TanStack Start server
  ├─ Session cookie (httpOnly, Secure, SameSite=Lax)
  ├─ Explicit authz (requireUser / requireAdmin)
  └─ `postgres` driver → standard PostgreSQL
         │
         ▼
PostgreSQL
  ├─ app_users, sessions
  ├─ people, parent_child, marriages
  ├─ person_claims, person_submissions, user_roles
  └─ portable SQL functions/triggers (no auth.uid / supabase_realtime)
```

### Why this fit

- Same language and existing serverFn middleware pattern (`src/start.ts`, `auth-middleware.ts`).
- No second frontend framework.
- No PostgREST / Supabase Auth / Realtime product dependency.
- Matches Coolify `node-server` deploy already used.

### Roles

| Role | Meaning in this app (verified) |
| ---- | ------------------------------ |
| Anonymous | Public read of tree (`people`, `parent_child`, `marriages`) |
| Signed-in user | Join submissions; own claim/submission reads |
| Admin (`user_roles.role = 'admin'`) | Tree CRUD, approve/reject, backup, assistant tools |

There is no separate “moderator” or “authorized family member” role in schema or code — only `app_role: admin | user` plus claim linkage via `person_claims`.

### Photos / storage

- App code serves portraits from `people.photo_url` (static paths) or `/yonis.png` fallback (`src/lib/brand.ts`).
- Backup contains a private Storage bucket `person-photos` with **0 objects** and RLS policies, but **no** `@supabase/storage` usage in application TypeScript.
- Target: keep static `/public` paths; do not restore Supabase Storage into the new DB unless product later requires uploads.

### Realtime replacement

Verified subscriptions:

- `useFamily.ts` — `people`, `parent_child`, `person_submissions`, `person_claims`
- `useAdminSubmissions.ts` — `person_submissions`

Replacement (smallest): invalidate React Query on successful mutations + short polling while join/admin pages are open. LISTEN/NOTIFY optional later.

## Environment (target)

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | App runtime connection (least-privilege role) |
| `DATABASE_MIGRATE_URL` | Migration/admin connection (optional; falls back to `DATABASE_URL`) |
| `SESSION_SECRET` | Cookie signing / session tokens |
| `APP_ORIGIN` | Absolute origin for cookies / redirects |
| Existing LLM keys | Unchanged |

Supabase `SUPABASE_*` / `VITE_SUPABASE_*` stay until cutover so Lovable/Cloud keep working.

## Rollback

1. Keep Supabase project untouched during migration.
2. Feature flag / dual path: if `DATABASE_URL` unset or `DATA_BACKEND=supabase`, use existing clients.
3. Coolify: redeploy previous image + Supabase env vars.
4. Original backup file never modified.

## Unresolved

- Production Coolify Postgres instance credentials (not in repo).
- Whether cutover should force password reset vs migrate bcrypt hashes (hashes are bcrypt-compatible in the backup — migration preferred; reset is fallback).
- Whether Storage bucket `person-photos` will be used later (currently empty).
