-- ============================================================
-- Phase 7 Sprint 7.1 — Row-Level Security (RLS) enablement script.
--
-- INTENTIONALLY NOT part of packages/database/manual-migrations/ — `pnpm migrate` will
-- NEVER run this file automatically. This is a deliberate scope decision (confirmed with
-- the user before writing this): enabling RLS today would require every one of this app's
-- ~8 bounded contexts to switch from a shared connection pool to a real
-- transaction-per-request pattern (so `SET LOCAL app.current_user_id` is scoped correctly
-- per request instead of leaking across pooled connections) — the single largest,
-- highest-blast-radius refactor in this codebase's history. That refactor is out of scope
-- for this pass; this file exists so RLS can be switched on for real once that work is
-- planned and done. See docs/ops/RUNBOOK_ENABLE_RLS.md for the full procedure.
--
-- Ported verbatim from docs/spec/production_constraints_and_indexes.sql (the spec's own
-- "ROW-LEVEL SECURITY SKELETON" section) — not re-authored, so it stays traceable to the
-- locked spec. Covers the 4 tables the spec explicitly calls "tenant-critical":
-- research_need, resource, technology_case, evidence.
--
-- Prerequisite: manual-migrations/0012_phase7_app_role_grants.sql already applied (creates
-- the non-superuser `r2m_app` role these policies apply to — RLS is a silent no-op for a
-- table's owner/a superuser, which is what the current app connection used to run as).
-- ============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS app_security;

CREATE OR REPLACE FUNCTION app_security.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.current_user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_security.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.current_org_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_security.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_account u
    WHERE u.id = app_security.current_user_id()
      AND u.platform_role = 'PLATFORM_ADMIN'
      AND u.status = 'ACTIVE'
  )
$$;

CREATE OR REPLACE FUNCTION app_security.is_active_org_member(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_member om
    WHERE om.organization_id = target_org_id
      AND om.user_id = app_security.current_user_id()
      AND om.status = 'ACTIVE'
  )
$$;

CREATE OR REPLACE FUNCTION app_security.is_active_case_member(target_case_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM case_member cm
    WHERE cm.technology_case_id = target_case_id
      AND cm.user_id = app_security.current_user_id()
      AND cm.status = 'ACTIVE'
  )
$$;

ALTER TABLE research_need ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource ENABLE ROW LEVEL SECURITY;
ALTER TABLE technology_case ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY research_need_select_policy ON research_need
FOR SELECT
USING (
  app_security.is_platform_admin()
  OR visibility = 'PUBLIC'
  OR app_security.is_active_org_member(company_organization_id)
);

CREATE POLICY research_need_write_policy ON research_need
FOR ALL
USING (
  app_security.is_platform_admin()
  OR app_security.is_active_org_member(company_organization_id)
)
WITH CHECK (
  app_security.is_platform_admin()
  OR app_security.is_active_org_member(company_organization_id)
);

CREATE POLICY resource_select_policy ON resource
FOR SELECT
USING (
  app_security.is_platform_admin()
  OR access_level = 'PUBLIC'
  OR app_security.is_active_org_member(owner_organization_id)
  OR EXISTS (
    SELECT 1 FROM resource_access_grant rag
    WHERE rag.resource_id = resource.id
      AND rag.status = 'ACTIVE'
      AND (rag.expires_at IS NULL OR rag.expires_at > now())
      AND (
        rag.recipient_user_id = app_security.current_user_id()
        OR rag.recipient_organization_id = app_security.current_org_id()
      )
  )
);

CREATE POLICY resource_write_policy ON resource
FOR ALL
USING (
  app_security.is_platform_admin()
  OR app_security.is_active_org_member(owner_organization_id)
)
WITH CHECK (
  app_security.is_platform_admin()
  OR app_security.is_active_org_member(owner_organization_id)
);

CREATE POLICY technology_case_select_policy ON technology_case
FOR SELECT
USING (
  app_security.is_platform_admin()
  OR app_security.is_active_case_member(id)
);

CREATE POLICY technology_case_write_policy ON technology_case
FOR ALL
USING (
  app_security.is_platform_admin()
  OR EXISTS (
    SELECT 1 FROM case_member cm
    WHERE cm.technology_case_id = technology_case.id
      AND cm.user_id = app_security.current_user_id()
      AND cm.status = 'ACTIVE'
      AND cm.role IN ('OWNER', 'TECHNICAL_MEMBER')
  )
)
WITH CHECK (
  app_security.is_platform_admin()
  OR app_security.is_active_org_member(owning_organization_id)
);

CREATE POLICY evidence_select_policy ON evidence
FOR SELECT
USING (
  app_security.is_platform_admin()
  OR app_security.is_active_case_member(technology_case_id)
);

CREATE POLICY evidence_write_policy ON evidence
FOR ALL
USING (
  app_security.is_platform_admin()
  OR EXISTS (
    SELECT 1 FROM case_member cm
    WHERE cm.technology_case_id = evidence.technology_case_id
      AND cm.user_id = app_security.current_user_id()
      AND cm.status = 'ACTIVE'
      AND cm.role IN ('OWNER', 'TECHNICAL_MEMBER', 'CASE_REVIEWER')
  )
)
WITH CHECK (
  app_security.is_platform_admin()
  OR EXISTS (
    SELECT 1 FROM case_member cm
    WHERE cm.technology_case_id = evidence.technology_case_id
      AND cm.user_id = app_security.current_user_id()
      AND cm.status = 'ACTIVE'
      AND cm.role IN ('OWNER', 'TECHNICAL_MEMBER', 'CASE_REVIEWER')
  )
);

COMMIT;

-- ============================================================
-- Rollback (run manually if RLS needs to be turned back off):
--
-- BEGIN;
-- DROP POLICY IF EXISTS research_need_select_policy ON research_need;
-- DROP POLICY IF EXISTS research_need_write_policy ON research_need;
-- DROP POLICY IF EXISTS resource_select_policy ON resource;
-- DROP POLICY IF EXISTS resource_write_policy ON resource;
-- DROP POLICY IF EXISTS technology_case_select_policy ON technology_case;
-- DROP POLICY IF EXISTS technology_case_write_policy ON technology_case;
-- DROP POLICY IF EXISTS evidence_select_policy ON evidence;
-- DROP POLICY IF EXISTS evidence_write_policy ON evidence;
-- ALTER TABLE research_need DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE resource DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE technology_case DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE evidence DISABLE ROW LEVEL SECURITY;
-- COMMIT;
-- ============================================================
