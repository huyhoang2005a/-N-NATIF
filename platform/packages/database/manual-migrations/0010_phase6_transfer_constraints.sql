-- ============================================================
-- Phase 6 Sprint 6.1 — Transfer Manifest. New feature, part of the locked spec (§9.7
-- Roadmap & Transfer bounded context, Transfer half). `transfer_recipient` uses the same
-- "exactly one recipient FK non-null" pattern as `resource_access_grant`
-- (0003_phase2_resource_constraints.sql) — plain CHECK here since (unlike content_vote/
-- content_save in the community feature) there's no need for a partial unique index on
-- top, just the non-null-count guard.
--
-- NOT ported from docs/spec/production_constraints_and_indexes.sql: the multi-condition
-- `validate_transfer_manifest_share()` PL/pgSQL trigger (≥1 item + ≥1 recipient + future
-- expiry before allowing SHARED) — enforced in `TransferManifestService` (TypeScript)
-- instead, same precedent as `validate_roadmap_approval()` in
-- 0005_phase4_assessment_gap_roadmap_constraints.sql. Row Level Security not enabled,
-- matching every earlier phase (app-layer authz only).
-- ============================================================

BEGIN;

ALTER TABLE transfer_recipient
  ADD CONSTRAINT chk_transfer_recipient_exactly_one_target
  CHECK (num_nonnulls(recipient_organization_id, recipient_user_id) = 1);

CREATE TRIGGER trg_transfer_manifest_updated_at_version
BEFORE UPDATE ON transfer_manifest
FOR EACH ROW EXECUTE FUNCTION set_updated_at_and_version();

COMMIT;
