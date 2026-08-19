-- Extends chk_case_origin_matches_type (from 0007_phase5_discovery_constraints.sql) with
-- the DISCOVERY_DIRECT_REQUEST branch: a case_origin row for a resource-sourced case
-- initiation request (2026-08-19) has no recommendation_item_id (no recommendation run
-- was involved) but does have case_initiation_request_id set, same as
-- DISCOVERY_RECOMMENDATION's case_initiation_request_id requirement. Split into its own
-- migration because the new enum label added in 0016 cannot be referenced in the same
-- transaction that created it.

BEGIN;

ALTER TABLE case_origin DROP CONSTRAINT chk_case_origin_matches_type;
ALTER TABLE case_origin
  ADD CONSTRAINT chk_case_origin_matches_type
  CHECK (
    (origin_type = 'MANUAL' AND imported_source_reference IS NULL
      AND recommendation_item_id IS NULL AND research_proposal_id IS NULL AND case_initiation_request_id IS NULL)
    OR (origin_type = 'IMPORT' AND imported_source_reference IS NOT NULL
      AND recommendation_item_id IS NULL AND research_proposal_id IS NULL AND case_initiation_request_id IS NULL)
    OR (origin_type = 'RESEARCH_PROPOSAL' AND research_proposal_id IS NOT NULL
      AND recommendation_item_id IS NULL AND case_initiation_request_id IS NULL AND imported_source_reference IS NULL)
    OR (origin_type = 'DISCOVERY_RECOMMENDATION' AND recommendation_item_id IS NOT NULL AND case_initiation_request_id IS NOT NULL
      AND research_proposal_id IS NULL AND imported_source_reference IS NULL)
    OR (origin_type = 'DISCOVERY_DIRECT_REQUEST' AND recommendation_item_id IS NULL AND case_initiation_request_id IS NOT NULL
      AND research_proposal_id IS NULL AND imported_source_reference IS NULL)
  );

COMMIT;
