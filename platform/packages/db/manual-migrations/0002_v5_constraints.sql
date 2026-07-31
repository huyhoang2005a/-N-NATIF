-- R2M V5 — hand-written constraints/triggers/indexes layered on top of the drizzle-kit
-- generated baseline (packages/db/migrations). Mirrors the Phase 1 subset of
-- docs/spec/production_constraints_and_indexes.sql. Applied by src/migrate.ts, which
-- tracks each file in `_manual_migration` so it only runs once.
--
-- Scope: Identity & Organization, Verification (organization-only), Platform Operations.
-- Phase 2+ adds more of production_constraints_and_indexes.sql in a new numbered file
-- alongside the schema it depends on (author_verification_request, resource, ...).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================
-- GENERIC updated_at + optimistic version trigger
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at_and_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND NEW.version IS NOT NULL THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organization_updated_at_version
BEFORE UPDATE ON organization
FOR EACH ROW EXECUTE FUNCTION set_updated_at_and_version();

CREATE OR REPLACE FUNCTION set_updated_at_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'user_account',
    'user_profile',
    'organization_verification_request',
    'organization_member'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I '
      'FOR EACH ROW EXECUTE FUNCTION set_updated_at_only()',
      table_name,
      table_name
    );
  END LOOP;
END;
$$;

-- ============================================================
-- PARTIAL UNIQUE INDEXES AND HOT-PATH INDEXES
-- ============================================================

CREATE UNIQUE INDEX uq_one_active_org_owner
  ON organization_member (organization_id)
  WHERE role = 'ORG_OWNER' AND status = 'ACTIVE';

CREATE UNIQUE INDEX uq_one_pending_org_verification
  ON organization_verification_request (organization_id)
  WHERE status IN ('PENDING', 'IN_REVIEW');

CREATE UNIQUE INDEX uq_notification_dedupe
  ON notification (recipient_user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX idx_pending_outbox
  ON outbox_event (available_at, created_at)
  WHERE status IN ('PENDING', 'FAILED');

COMMIT;
