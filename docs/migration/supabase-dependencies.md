# Supabase dependency map

Migration status values: `documented` | `schema-ported` | `code-in-progress` | `replaced` | `deferred` | `wont-port`

| Current dependency | Location in repository | Replacement | Migration status |
| ------------------ | ---------------------- | ----------- | ---------------- |
| `@supabase/supabase-js` package | `package.json` | Remove after cutover; use `postgres` + server auth | documented |
| Browser Supabase client | `src/integrations/supabase/client.ts` | ServerFns + cookie session; no browser DB credentials | documented |
| Service-role admin client | `src/integrations/supabase/client.server.ts` | `DATABASE_MIGRATE_URL` / privileged DB role used only on server | documented |
| JWT auth middleware | `src/integrations/supabase/auth-middleware.ts` | Session cookie middleware (`requireUser` / `requireAdmin`) | documented |
| Auth header attacher | `src/integrations/supabase/auth-attacher.ts`, `src/start.ts` | Cookie session attached automatically by server | documented |
| Lovable preview auth storage | `src/integrations/supabase/previewAuthStorage.ts` | Drop or no-op outside Lovable | documented |
| Generated DB types | `src/integrations/supabase/types.ts` | Hand-maintained / generated types for portable schema | documented |
| Email/password sign-in | `src/components/AuthSignInCard.tsx` | ServerFn login verifying bcrypt against `app_users` | documented |
| Sign-up | `AuthSignInCard.tsx` | ServerFn register → `app_users` (+ optional email confirm later) | documented |
| Sign-out | `ProfileMenu.tsx`, `AdminDashboardShell.tsx`, `admin/route.tsx`, `join.tsx` | Clear session cookie | documented |
| Session / `onAuthStateChange` | `src/hooks/useFamily.ts` | Session query via serverFn + React Query | documented |
| Admin role check | `useFamily.ts` (`user_roles`), `family-assistant-auth.middleware.ts` | Server `requireAdmin` reading `user_roles` | documented |
| `people` / `parent_child` reads | `src/lib/family.ts`, `family-graph.server.ts` | SQL via `postgres` on server | documented |
| Person CRUD / links | `useAdminPersonEditor.ts`, `relationships.ts`, assistant execute | Authorized serverFns + transactions | documented |
| Submissions + claims | `src/lib/submissions.ts`, `PersonContact.tsx`, join flow | ServerFns; port insert validation | documented |
| RPC `approve_submission` | `submissions.ts`, `family-assistant-execute.server.ts` | Portable SQL fn with `_actor_id` or app-layer transaction | documented |
| RPC `reject_submission` | same | same | documented |
| RPC `person_claim_index` | `submissions.ts` (cast `as never`; missing from generated types) | Portable SQL fn using session user id | documented |
| RPC `claim_admin` | types / SQL only; revoked for clients | Do not expose; provision admins via migrate SQL | wont-port |
| Realtime channels | `useFamily.ts`, `useAdminSubmissions.ts` | Mutation invalidation + polling (LISTEN/NOTIFY later) | documented |
| Backup export/import | `src/lib/backup.ts`, `backup.functions.ts` | Server SQL upsert/delete under admin session | documented |
| Family assistant DB tools | `family-assistant-*.server.ts` | Same tools against `postgres` client | documented |
| Env `SUPABASE_*` / `VITE_SUPABASE_*` | `.env.example`, `Dockerfile` | `DATABASE_URL`, `SESSION_SECRET`, `APP_ORIGIN` | documented |
| Supabase migrations folder | `supabase/migrations/*.sql` | `db/migrations/*.sql` (portable) | schema-ported |
| Custom backup data load | `/home/abdosh/Downloads/…backup` | `scripts/load-from-supabase-backup.sh` | schema-ported |
| RLS policies | migrations / backup | Server authorization mirroring hardened policies | documented |
| `auth.users` FKs | claims, submissions, roles | `app_users` with preserved UUIDs | documented |
| `auth.uid()` in SQL | approve/reject/triggers | `_actor_id` / `app.user_id` GUC | documented |
| `supabase_realtime` publication | migrations | Not ported | wont-port |
| Storage bucket `person-photos` | backup only (0 objects); policies in dump | Deferred; static `photo_url` / `/public` | deferred |
| Edge Functions | none found | n/a | wont-port |
| OAuth / phone / MFA | none in app; auth tables exist in dump | n/a for v1 | deferred |

## Authorization translation (RLS → server)

| Rule (hardened intent) | Server enforcement |
| ---------------------- | ------------------ |
| Anyone SELECT people / parent_child / marriages | Public serverFn or unauthenticated read allowed |
| Only admin INSERT/UPDATE/DELETE tree tables | `requireAdmin` before mutations |
| User SELECT own `user_roles` | Return role for current session only |
| User INSERT own pending submission | Force `user_id = session.userId`, `status = pending` |
| User/admin SELECT submissions | Filter by ownership unless admin |
| User/admin SELECT claims | Own row or admin; claim index for picker without leaking other UUIDs |
| Approve/reject | Admin only; call portable SQL or transactional TS |

## Auth migration feasibility

From backup inspection (counts only; no secrets printed):

- 12 email/password users, all bcrypt-format hashes, all email confirmed.
- Safe path: copy `id`, `email`, `encrypted_password` into `app_users` **only via a server-side migrate script**, never to the frontend.
- Fallback: force password reset if hash verification fails in staging tests.

## Remaining while Supabase is live

Until cutover, the application **still depends** on the existing Supabase backend for all production traffic. New `db/migrations` and server DB scaffolding must not remove Supabase clients yet.
