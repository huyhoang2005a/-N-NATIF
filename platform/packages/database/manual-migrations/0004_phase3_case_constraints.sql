-- R2M V5 — Phase 3 (Technology Case & Evidence) hand-written constraints/triggers/
-- indexes, layered on top of the drizzle-kit generated baseline. Mirrors the Phase 3
-- subset of docs/spec/production_constraints_and_indexes.sql. Applied by src/migrate.ts,
-- which tracks each file in `_manual_migration` so it only runs once.
--
-- Scope: Technology Case, Evidence/Citation.
-- Reuses `set_updated_at_and_version()` / `set_updated_at_only()` created in
-- 0002_v5_constraints.sql — no need to redefine them here.
--
-- NOT ported from the spec file (see plan PHẦN C, quyết định 4): the 2 PL/pgSQL business
-- validation triggers `validate_case_member_organization()` /
-- `validate_case_owning_organization_row()` (owner-must-belong-to-owning-org,
-- partner-member-org-must-be-linked) — enforced in `TechnologyCaseService` instead,
-- consistent with how Phase 1-2 keep multi-condition business rules in the domain
-- service and DB constraints simple (exactly-one, offset-range, uniqueness). Row Level
-- Security is also not enabled, matching Phase 1-2 (app-layer authz only).

BEGIN;

-- ============================================================
-- CHECK CONSTRAINTS
-- ============================================================

-- `case_origin` only has 2 usable branches in Phase 3 — `recommendation_item_id` /
-- `research_proposal_id` / `case_initiation_request_id` columns don't exist yet (FK to
-- Phase 5 tables, see schema file comment). Extend this constraint additively in
-- Phase 5 alongside the new columns.
ALTER TABLE case_origin
  ADD CONSTRAINT chk_case_origin_matches_type
  CHECK (
    (origin_type = 'MANUAL' AND imported_source_reference IS NULL)
    OR (origin_type = 'IMPORT' AND imported_source_reference IS NOT NULL)
  );

-- ============================================================
-- TRIGGERS (reuse functions created in 0002_v5_constraints.sql)
-- ============================================================

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'technology_case',
    'technology_profile',
    'evidence'
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

CREATE TRIGGER trg_case_member_updated_at
BEFORE UPDATE ON case_member
FOR EACH ROW EXECUTE FUNCTION set_updated_at_only();

-- ============================================================
-- PARTIAL UNIQUE INDEXES
-- ============================================================

CREATE UNIQUE INDEX uq_one_active_case_owner
  ON case_member (technology_case_id)
  WHERE role = 'OWNER' AND status = 'ACTIVE';

-- ============================================================
-- EVIDENCE REQUIRES CITATION (deferred constraint trigger — dual layer with the
-- application check in EvidenceService, per breakdown Sprint 3.3 item 14: "constraint +
-- application check"). DEFERRABLE INITIALLY DEFERRED so it only fires at COMMIT, after
-- both `evidence` and `evidence_citation` rows have been inserted in the same
-- transaction — an immediate AFTER INSERT trigger would fail before the citation link
-- exists. First constraint trigger in this repo; mirrors
-- production_constraints_and_indexes.sql almost verbatim (function renamed with a
-- r2m_ prefix to make it obvious this isn't the literal spec-file copy).
-- ============================================================

CREATE OR REPLACE FUNCTION r2m_validate_evidence_has_citation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'ACTIVE' AND NOT EXISTS (
    SELECT 1 FROM evidence_citation ec WHERE ec.evidence_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'CASE_EVIDENCE_REQUIRES_CITATION';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_evidence_requires_citation
AFTER INSERT OR UPDATE OF status ON evidence
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION r2m_validate_evidence_has_citation();

COMMIT;
