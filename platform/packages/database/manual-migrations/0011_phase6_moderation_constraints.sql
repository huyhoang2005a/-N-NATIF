-- ============================================================
-- Phase 6 Sprint 6.3 — Content Moderation. Part of the locked spec (§9.7 Platform
-- Operations bounded context, moderation half). Mirrors docs/spec/
-- production_constraints_and_indexes.sql lines ~174-186 exactly (both CHECK constraints
-- ported verbatim — these are simple single-condition constraints, unlike
-- `validate_transfer_manifest_share()` which stayed in TypeScript).
-- ============================================================

BEGIN;

ALTER TABLE content_flag
  ADD CONSTRAINT chk_content_flag_exactly_one_target
  CHECK (num_nonnulls(target_resource_id, target_annotation_id, target_technology_profile_id) = 1),
  ADD CONSTRAINT chk_content_flag_target_matches_type
  CHECK (
    (target_type = 'RESOURCE' AND target_resource_id IS NOT NULL)
    OR (target_type = 'ANNOTATION' AND target_annotation_id IS NOT NULL)
    OR (target_type = 'TECHNOLOGY_PROFILE' AND target_technology_profile_id IS NOT NULL)
  );

CREATE TRIGGER trg_content_flag_updated_at
BEFORE UPDATE ON content_flag
FOR EACH ROW EXECUTE FUNCTION set_updated_at_only();

COMMIT;
