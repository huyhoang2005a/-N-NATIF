-- R2M V5 — Phase 4 (Assessment, Gap, Roadmap) hand-written constraints/triggers/
-- indexes, layered on top of the drizzle-kit generated baseline. Mirrors the Phase 4
-- subset of docs/spec/production_constraints_and_indexes.sql. Applied by src/migrate.ts,
-- which tracks each file in `_manual_migration` so it only runs once.
--
-- Scope: Assessment & Gap, Roadmap.
-- Reuses `set_updated_at_and_version()` / `set_updated_at_only()` created in
-- 0002_v5_constraints.sql — no need to redefine them here.
--
-- NOT ported from the spec file (see plan PHẦN D, quyết định 6): the 3 PL/pgSQL business
-- validation triggers `validate_and_calculate_assessment_submission()` (composite score +
-- completeness), `prevent_milestone_dependency_cycle()` (cycle detection), and
-- `validate_roadmap_approval()` (critical-gap gate) — all enforced in
-- `AssessmentService`/`RoadmapService` instead (TypeScript, ported faithfully from this
-- same SQL as reference), consistent with the Phase 3 decision to keep multi-condition
-- business rules in the domain service and DB constraints simple. `01_workflow_theo_
-- phase.md` §4.7 itself only asks for **Unit** tests on these rules, which favours
-- app-layer logic over opaque SQL triggers. Row Level Security is also not enabled,
-- matching Phase 1-3 (app-layer authz only).

BEGIN;

-- ============================================================
-- CHECK CONSTRAINTS
-- ============================================================

ALTER TABLE assessment_criterion
  ADD CONSTRAINT chk_assessment_criterion_score_range
  CHECK (max_score > min_score AND weight > 0);

ALTER TABLE gap_record
  ADD CONSTRAINT chk_gap_resolution_fields
  CHECK (
    status NOT IN ('RESOLVED', 'ACCEPTED_RISK', 'CLOSED')
    OR (resolved_at IS NOT NULL AND resolved_by_user_id IS NOT NULL)
  );

ALTER TABLE roadmap_milestone
  ADD CONSTRAINT chk_milestone_dates
  CHECK (start_date IS NULL OR due_date IS NULL OR due_date >= start_date);

ALTER TABLE roadmap_task
  ADD CONSTRAINT chk_task_dates
  CHECK (start_date IS NULL OR due_date IS NULL OR due_date >= start_date);

ALTER TABLE milestone_dependency
  ADD CONSTRAINT chk_dependency_not_self
  CHECK (predecessor_milestone_id <> successor_milestone_id);

-- ============================================================
-- TRIGGERS (reuse functions created in 0002_v5_constraints.sql)
-- ============================================================

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'readiness_assessment',
    'gap_record',
    'roadmap',
    'roadmap_milestone',
    'roadmap_task'
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

CREATE TRIGGER trg_assessment_score_updated_at
BEFORE UPDATE ON assessment_score
FOR EACH ROW EXECUTE FUNCTION set_updated_at_only();

-- ============================================================
-- HOT-PATH INDEX (critical-gap gate query — mirrors spec file dòng 249-251)
-- ============================================================

CREATE INDEX idx_open_critical_gaps
  ON gap_record (technology_case_id, created_at)
  WHERE severity = 'CRITICAL' AND status IN ('OPEN', 'IN_PROGRESS');

COMMIT;
