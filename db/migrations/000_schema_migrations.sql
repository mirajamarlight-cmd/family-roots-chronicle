-- Migration ledger. Applied first; subsequent files recorded by db-migrate.sh.
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
