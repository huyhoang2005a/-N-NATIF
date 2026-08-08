-- R2M V5 — Phase 5 (Company & Discovery) hand-written constraints/triggers/indexes,
-- layered on top of the drizzle-kit generated baseline. Applied by src/migrate.ts, which
-- tracks each file in `_manual_migration` so it only runs once.
--
-- Scope: Company Profile, Research Need, Research Proposal, Recommendation (FOCUSED +
-- FEED, Sprint 5.5 extension), Case Initiation.
-- Reuses `set_updated_at_and_version()` / `set_updated_at_only()` created in
-- 0002_v5_constraints.sql — no need to redefine them here.
--
-- Extends `chk_case_origin_matches_type` from 0004_phase3_case_constraints.sql (that
-- file's own comment flagged this as expected: "Extend this constraint additively in
-- Phase 5 alongside the new columns") — DROP + re-ADD is the only way to change a CHECK
-- constraint's definition in Postgres, there is no ALTER CHECK.
--
-- The `validate_recommendation_run_completion` trigger in
-- docs/spec/production_constraints_and_indexes.sql could never have been applied before
-- this migration (`recommendation_run` did not exist in any prior manual migration —
-- confirmed via grep), so this is its first real creation, not a modification of live
-- behavior. Written here already relaxed as decided: a run may COMPLETE with zero items
-- (UC-DIS-03 alt-flow — "no results" is a valid terminal state, not an error), the only
-- hard invariant kept is "every ACTIVE item must have a citation".

BEGIN;

-- ============================================================
-- CHECK CONSTRAINTS
-- ============================================================

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
  );

-- Feed extension (Sprint 5.5, mục 2.2 kế hoạch) — exactly-one-FK-non-null pattern, same
-- technique as `verification_document`'s "exactly one request FK" constraint.
ALTER TABLE recommendation_run
  ADD CONSTRAINT chk_recommendation_run_context_matches_type
  CHECK (
    (run_type = 'FOCUSED' AND research_need_id IS NOT NULL AND need_statement_version_id IS NOT NULL AND company_organization_id IS NULL)
    OR
    (run_type = 'FEED' AND research_need_id IS NULL AND need_statement_version_id IS NULL AND company_organization_id IS NOT NULL)
  );

-- ============================================================
-- UNIQUE INDEXES (business invariant: at most 1 in-flight run per context)
-- ============================================================

-- DISCOVERY_RUN_ALREADY_IN_PROGRESS — same "at most 1 open X" pattern as
-- uq_one_pending_org_verification / uq_one_pending_author_verification (0002/0003).
CREATE UNIQUE INDEX uq_one_active_focused_run_per_need
  ON recommendation_run (research_need_id)
  WHERE run_type = 'FOCUSED' AND status IN ('QUEUED', 'RUNNING');

CREATE UNIQUE INDEX uq_one_active_feed_run_per_company
  ON recommendation_run (company_organization_id)
  WHERE run_type = 'FEED' AND status IN ('QUEUED', 'RUNNING');

-- ============================================================
-- TRIGGERS (reuse functions created in 0002_v5_constraints.sql)
-- ============================================================

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'research_need',
    'research_proposal',
    'case_initiation_request'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at_version BEFORE UPDATE ON %I '
      'FOR EACH ROW EXECUTE FUNCTION set_updated_at_and_version()',
      table_name,
      table_name
    );
  END LOOP;
END;
$$;

CREATE TRIGGER trg_company_profile_updated_at
BEFORE UPDATE ON company_profile
FOR EACH ROW EXECUTE FUNCTION set_updated_at_only();

-- ============================================================
-- BUSINESS VALIDATION TRIGGER (relaxed per UC-DIS-03 alt-flow — see header note)
-- ============================================================

CREATE OR REPLACE FUNCTION validate_recommendation_run_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF EXISTS (
      SELECT 1
      FROM recommendation_item ri
      WHERE ri.recommendation_run_id = NEW.id
        AND ri.status = 'ACTIVE'
        AND NOT EXISTS (
          SELECT 1 FROM recommendation_citation rc
          WHERE rc.recommendation_item_id = ri.id
        )
    ) THEN
      RAISE EXCEPTION 'RECOMMENDATION_ITEM_MISSING_CITATION';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_recommendation_run_completion
BEFORE UPDATE OF status
ON recommendation_run
FOR EACH ROW
EXECUTE FUNCTION validate_recommendation_run_completion();

-- ============================================================
-- FULL-TEXT SEARCH (already exists from Phase 2 — idx_resource_chunk_search — nothing
-- to add here; recommendation scoring in the worker reuses that index directly.)
-- ============================================================

COMMIT;
