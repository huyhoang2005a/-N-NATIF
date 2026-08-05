-- R2M V5 — Phase 2 (Author & Resource) hand-written constraints/triggers/indexes,
-- layered on top of the drizzle-kit generated baseline. Mirrors the Phase 2 subset of
-- docs/spec/production_constraints_and_indexes.sql. Applied by src/migrate.ts, which
-- tracks each file in `_manual_migration` so it only runs once.
--
-- Scope: Verification (author), Resource Catalog & Evidence.
-- Reuses `set_updated_at_and_version()` / `set_updated_at_only()` created in
-- 0002_v5_constraints.sql — no need to redefine them here.

BEGIN;

-- ============================================================
-- CHECK CONSTRAINTS
-- ============================================================

ALTER TABLE verification_document
  ADD CONSTRAINT chk_verification_document_exactly_one_request
  CHECK (num_nonnulls(
    organization_verification_request_id,
    author_verification_request_id
  ) = 1);

ALTER TABLE resource_chunk
  ADD CONSTRAINT chk_resource_chunk_offsets
  CHECK (
    (offset_start IS NULL AND offset_end IS NULL)
    OR (offset_start >= 0 AND offset_end > offset_start)
  );

ALTER TABLE citation
  ADD CONSTRAINT chk_citation_offsets
  CHECK (
    (offset_start IS NULL AND offset_end IS NULL)
    OR (offset_start >= 0 AND offset_end > offset_start)
  );

ALTER TABLE annotation_revision
  ADD CONSTRAINT chk_annotation_revision_offsets
  CHECK (
    (offset_start IS NULL AND offset_end IS NULL)
    OR (offset_start >= 0 AND offset_end > offset_start)
  );

ALTER TABLE resource_access_grant
  ADD CONSTRAINT chk_resource_access_grant_exactly_one_target
  CHECK (num_nonnulls(recipient_organization_id, recipient_user_id) = 1);

-- ============================================================
-- TRIGGERS (reuse functions created in 0002_v5_constraints.sql)
-- ============================================================

CREATE TRIGGER trg_resource_updated_at_version
BEFORE UPDATE ON resource
FOR EACH ROW EXECUTE FUNCTION set_updated_at_and_version();

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'author_profile',
    'author_verification_request',
    'resource_ingestion_job',
    'annotation'
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

CREATE UNIQUE INDEX uq_one_pending_author_verification
  ON author_verification_request (author_user_id)
  WHERE status IN ('PENDING', 'IN_REVIEW');

CREATE INDEX idx_resource_search_title
  ON resource USING gin (to_tsvector('simple', title || ' ' || coalesce(description, '')));

CREATE INDEX idx_resource_chunk_search
  ON resource_chunk USING gin (to_tsvector('simple', content));

-- Create the vector index once there is enough real embedding data and a distance
-- metric/operator class has been chosen — not enabled in Phase 2 (see B.0.1, SUC-05).
-- CREATE INDEX idx_resource_chunk_embedding_hnsw
--   ON resource_chunk USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_active_access_grant_org
  ON resource_access_grant (recipient_organization_id, resource_id)
  WHERE status = 'ACTIVE';

CREATE INDEX idx_active_access_grant_user
  ON resource_access_grant (recipient_user_id, resource_id)
  WHERE status = 'ACTIVE';

COMMIT;
