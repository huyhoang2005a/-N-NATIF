-- ============================================================
-- Resource-sourced case initiation requests (2026-08-19).
-- Until now `case_initiation_request` could only be created from a
-- `recommendation_item` (AI-matched resource ↔ research need). This adds the second,
-- simpler source: a company browsing a resource directly (no recommendation run
-- involved) can send the same kind of request straight from the resource/version.
-- `recommendation_item_id` becomes nullable and a nullable `resource_version_id` FK is
-- added; a CHECK constraint enforces exactly one of the two is ever set — same "exactly
-- one source FK" technique already used by `verification_document` and
-- `recommendation_run`'s context CHECK constraints.
-- ============================================================

BEGIN;

ALTER TABLE case_initiation_request ALTER COLUMN recommendation_item_id DROP NOT NULL;

ALTER TABLE case_initiation_request
  ADD COLUMN IF NOT EXISTS resource_version_id uuid REFERENCES resource_version(id);

ALTER TABLE case_initiation_request
  ADD CONSTRAINT chk_case_initiation_request_exactly_one_source CHECK (
    (recommendation_item_id IS NOT NULL AND resource_version_id IS NULL)
    OR (recommendation_item_id IS NULL AND resource_version_id IS NOT NULL)
  );

COMMIT;
