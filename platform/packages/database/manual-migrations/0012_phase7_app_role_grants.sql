-- ============================================================
-- Phase 7 Sprint 7.1 — Data access security. Creates a non-superuser runtime role
-- (`r2m_app`) for apps/api + apps/worker, distinct from the migration-owner role (`r2m`,
-- currently a superuser that bypasses RLS entirely — confirmed via
-- `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname='r2m'` before writing this).
-- Two purposes, both real today even before RLS is ever enabled (see docs/ops/
-- RUNBOOK_ENABLE_RLS.md for that separate, not-yet-applied step):
--   1. `audit_log` grant is deliberately narrower than every other table (SELECT+INSERT
--      only, no UPDATE/DELETE) — satisfies the DoD "Audit không thể bị sửa bởi user thông
--      thường" (mục 17) without needing RLS. Confirmed via grep that no app code path ever
--      calls `.update(schema.auditLog...)` or `.delete(schema.auditLog...)`.
--   2. `r2m_app` is the role RLS policies (when enabled later per the runbook) will apply
--      to — RLS policies are no-ops for a table's owner/superuser, so this role has to
--      exist and be in real use as the app's runtime connection first regardless of
--      whether RLS itself is on.
-- Dev-local credential, same convention as the already-committed `r2m`/`r2m` and
-- `r2m`/`r2m-secret` (MinIO) in .env/docker-compose.yml — not a real secret. Production
-- deployment must set a real generated password (see docs/ops/SECRET_ROTATION_RUNBOOK.md).
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'r2m_app') THEN
    CREATE ROLE r2m_app WITH LOGIN PASSWORD 'r2m_app_secret' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE r2m_dev TO r2m_app;
GRANT USAGE ON SCHEMA public TO r2m_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO r2m_app;
REVOKE UPDATE, DELETE ON audit_log FROM r2m_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO r2m_app;

-- Every table/sequence created by future migrations (run as `r2m`) is automatically
-- granted to `r2m_app` too, so this file doesn't need to be revisited each phase.
ALTER DEFAULT PRIVILEGES FOR ROLE r2m IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO r2m_app;
ALTER DEFAULT PRIVILEGES FOR ROLE r2m IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO r2m_app;

COMMIT;
