-- Least-privilege roles (run as superuser / migrate URL).
-- Runtime role: DML + execute only. Migrate role: DDL.
-- Safe to skip on managed Postgres if roles are provisioned externally.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'frc_app') THEN
    CREATE ROLE frc_app LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'frc_migrate') THEN
    CREATE ROLE frc_migrate LOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO frc_app, frc_migrate;

-- Runtime: no CREATE, no TRUNCATE by default privilege; table DML only.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM frc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO frc_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO frc_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO frc_app;

-- Migrate: full DDL/DML for schema changes and data load scripts.
GRANT ALL ON ALL TABLES IN SCHEMA public TO frc_migrate;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO frc_migrate;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO frc_migrate;
GRANT CREATE ON SCHEMA public TO frc_migrate;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO frc_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO frc_app;

-- frc_app must not own CREATE on schema
REVOKE CREATE ON SCHEMA public FROM frc_app;
