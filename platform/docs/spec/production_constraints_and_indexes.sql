-- Research-to-Market V5
-- PostgreSQL constraints, indexes, validation triggers and RLS skeleton.
-- Apply after the ORM-generated base migration. Review enum/type names if the ORM
-- transforms DBML enum names.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS vector;

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

-- Tables with both updated_at and version.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organization',
    'research_need',
    'research_proposal',
    'resource',
    'case_initiation_request',
    'technology_case',
    'technology_profile',
    'evidence',
    'readiness_assessment',
    'gap_record',
    'roadmap',
    'roadmap_milestone',
    'roadmap_task',
    'transfer_manifest'
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
    'organization_member',
    'author_profile',
    'author_verification_request',
    'company_profile',
    'resource_ingestion_job',
    'annotation',
    'assessment_score',
    'content_flag'
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
-- CHECK CONSTRAINTS
-- ============================================================

ALTER TABLE verification_document
  ADD CONSTRAINT chk_verification_document_exactly_one_request
  CHECK (num_nonnulls(
    organization_verification_request_id,
    author_verification_request_id
  ) = 1);

ALTER TABLE need_statement_version
  ADD CONSTRAINT chk_need_timeframe_positive
  CHECK (timeframe_months IS NULL OR timeframe_months > 0);

ALTER TABLE research_proposal
  ADD CONSTRAINT chk_proposal_timeline_positive
  CHECK (timeline_months > 0);

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

ALTER TABLE recommendation_item
  ADD CONSTRAINT chk_recommendation_match_score
  CHECK (match_score >= 0 AND match_score <= 1);

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

ALTER TABLE transfer_recipient
  ADD CONSTRAINT chk_transfer_recipient_exactly_one_target
  CHECK (num_nonnulls(recipient_organization_id, recipient_user_id) = 1);

ALTER TABLE resource_access_grant
  ADD CONSTRAINT chk_resource_access_grant_exactly_one_target
  CHECK (num_nonnulls(recipient_organization_id, recipient_user_id) = 1);

ALTER TABLE content_flag
  ADD CONSTRAINT chk_content_flag_exactly_one_target
  CHECK (num_nonnulls(
    target_resource_id,
    target_annotation_id,
    target_technology_profile_id
  ) = 1),
  ADD CONSTRAINT chk_content_flag_target_matches_type
  CHECK (
    (target_type = 'RESOURCE' AND target_resource_id IS NOT NULL)
    OR (target_type = 'ANNOTATION' AND target_annotation_id IS NOT NULL)
    OR (target_type = 'TECHNOLOGY_PROFILE' AND target_technology_profile_id IS NOT NULL)
  );

ALTER TABLE case_origin
  ADD CONSTRAINT chk_case_origin_matches_type
  CHECK (
    (origin_type = 'MANUAL'
      AND recommendation_item_id IS NULL
      AND research_proposal_id IS NULL
      AND case_initiation_request_id IS NULL
      AND imported_source_reference IS NULL)
    OR
    (origin_type = 'DISCOVERY_RECOMMENDATION'
      AND recommendation_item_id IS NOT NULL
      AND case_initiation_request_id IS NOT NULL
      AND research_proposal_id IS NULL)
    OR
    (origin_type = 'RESEARCH_PROPOSAL'
      AND research_proposal_id IS NOT NULL
      AND recommendation_item_id IS NULL
      AND case_initiation_request_id IS NULL)
    OR
    (origin_type = 'IMPORT'
      AND imported_source_reference IS NOT NULL
      AND recommendation_item_id IS NULL
      AND research_proposal_id IS NULL
      AND case_initiation_request_id IS NULL)
  );

-- ============================================================
-- PARTIAL UNIQUE INDEXES AND HOT-PATH INDEXES
-- ============================================================

CREATE UNIQUE INDEX uq_one_active_org_owner
  ON organization_member (organization_id)
  WHERE role = 'ORG_OWNER' AND status = 'ACTIVE';

CREATE UNIQUE INDEX uq_one_active_case_owner
  ON case_member (technology_case_id)
  WHERE role = 'OWNER' AND status = 'ACTIVE';

CREATE UNIQUE INDEX uq_one_pending_author_verification
  ON author_verification_request (author_user_id)
  WHERE status IN ('PENDING', 'IN_REVIEW');

CREATE UNIQUE INDEX uq_one_pending_org_verification
  ON organization_verification_request (organization_id)
  WHERE status IN ('PENDING', 'IN_REVIEW');

CREATE UNIQUE INDEX uq_notification_dedupe
  ON notification (recipient_user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX idx_resource_search_title
  ON resource USING gin (to_tsvector('simple', title || ' ' || coalesce(description, '')));

CREATE INDEX idx_resource_chunk_search
  ON resource_chunk USING gin (to_tsvector('simple', content));

-- Create the vector index after enough rows exist and after choosing the desired
-- distance metric/operator class. Example:
-- CREATE INDEX idx_resource_chunk_embedding_hnsw
--   ON resource_chunk USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_open_critical_gaps
  ON gap_record (technology_case_id, created_at)
  WHERE severity = 'CRITICAL' AND status IN ('OPEN', 'IN_PROGRESS');

CREATE INDEX idx_pending_outbox
  ON outbox_event (available_at, created_at)
  WHERE status IN ('PENDING', 'FAILED');

CREATE INDEX idx_active_access_grant_org
  ON resource_access_grant (recipient_organization_id, resource_id)
  WHERE status = 'ACTIVE';

CREATE INDEX idx_active_access_grant_user
  ON resource_access_grant (recipient_user_id, resource_id)
  WHERE status = 'ACTIVE';

-- ============================================================
-- BUSINESS VALIDATION FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION validate_case_member_organization()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM organization_member om
    WHERE om.organization_id = NEW.organization_id
      AND om.user_id = NEW.user_id
      AND om.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'CASE_MEMBER_NOT_ACTIVE_IN_ORGANIZATION';
  END IF;

  IF NEW.role = 'OWNER' AND NOT EXISTS (
    SELECT 1
    FROM technology_case tc
    WHERE tc.id = NEW.technology_case_id
      AND tc.owning_organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'CASE_OWNER_MUST_BELONG_TO_OWNING_ORGANIZATION';
  END IF;

  IF NEW.role = 'PARTNER_MEMBER' AND NOT EXISTS (
    SELECT 1
    FROM case_organization co
    WHERE co.technology_case_id = NEW.technology_case_id
      AND co.organization_id = NEW.organization_id
      AND co.role = 'PARTNER_COMPANY'
      AND co.left_at IS NULL
  ) THEN
    RAISE EXCEPTION 'PARTNER_MEMBER_REQUIRES_PARTNER_ORGANIZATION';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_case_member_organization
BEFORE INSERT OR UPDATE OF user_id, organization_id, role, status
ON case_member
FOR EACH ROW
WHEN (NEW.status = 'ACTIVE')
EXECUTE FUNCTION validate_case_member_organization();

CREATE OR REPLACE FUNCTION validate_case_owning_organization_row()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role = 'OWNING_ORGANIZATION' AND NOT EXISTS (
    SELECT 1
    FROM technology_case tc
    WHERE tc.id = NEW.technology_case_id
      AND tc.owning_organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'OWNING_ORGANIZATION_ROLE_MUST_MATCH_CASE_OWNER_ORG';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_case_owning_organization_row
BEFORE INSERT OR UPDATE OF organization_id, role
ON case_organization
FOR EACH ROW
EXECUTE FUNCTION validate_case_owning_organization_row();

CREATE OR REPLACE FUNCTION validate_assessment_score_range()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  criterion_row assessment_criterion%ROWTYPE;
  assessment_framework_id uuid;
BEGIN
  SELECT * INTO criterion_row
  FROM assessment_criterion
  WHERE id = NEW.criterion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ASSESSMENT_CRITERION_NOT_FOUND';
  END IF;

  SELECT framework_id INTO assessment_framework_id
  FROM readiness_assessment
  WHERE id = NEW.assessment_id;

  IF assessment_framework_id IS DISTINCT FROM criterion_row.framework_id THEN
    RAISE EXCEPTION 'ASSESSMENT_CRITERION_FRAMEWORK_MISMATCH';
  END IF;

  IF NEW.score < criterion_row.min_score OR NEW.score > criterion_row.max_score THEN
    RAISE EXCEPTION 'ASSESSMENT_SCORE_OUT_OF_RANGE';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_assessment_score_range
BEFORE INSERT OR UPDATE OF assessment_id, criterion_id, score
ON assessment_score
FOR EACH ROW
EXECUTE FUNCTION validate_assessment_score_range();

CREATE OR REPLACE FUNCTION validate_and_calculate_assessment_submission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  missing_evidence_count int;
  missing_citation_count int;
  score_count int;
  calculated_score numeric(10,4);
BEGIN
  IF NEW.status IN ('SUBMITTED', 'APPROVED')
     AND OLD.status IS DISTINCT FROM NEW.status THEN

    SELECT count(*) INTO score_count
    FROM assessment_score s
    WHERE s.assessment_id = NEW.id;

    IF score_count = 0 THEN
      RAISE EXCEPTION 'ASSESSMENT_HAS_NO_SCORES';
    END IF;

    SELECT count(*) INTO missing_evidence_count
    FROM assessment_score s
    JOIN assessment_criterion c ON c.id = s.criterion_id
    WHERE s.assessment_id = NEW.id
      AND c.requires_evidence
      AND NOT EXISTS (
        SELECT 1 FROM assessment_score_evidence se
        WHERE se.assessment_score_id = s.id
      );

    IF missing_evidence_count > 0 THEN
      RAISE EXCEPTION 'ASSESSMENT_SCORE_MISSING_EVIDENCE';
    END IF;

    SELECT count(*) INTO missing_citation_count
    FROM assessment_score s
    JOIN assessment_criterion c ON c.id = s.criterion_id
    WHERE s.assessment_id = NEW.id
      AND c.requires_citation
      AND NOT EXISTS (
        SELECT 1 FROM assessment_score_citation sc
        WHERE sc.assessment_score_id = s.id
      );

    IF missing_citation_count > 0 THEN
      RAISE EXCEPTION 'ASSESSMENT_SCORE_MISSING_CITATION';
    END IF;

    SELECT
      round(
        100 * sum((s.score - c.min_score) / nullif(c.max_score - c.min_score, 0) * c.weight)
        / nullif(sum(c.weight), 0),
        4
      )
    INTO calculated_score
    FROM assessment_score s
    JOIN assessment_criterion c ON c.id = s.criterion_id
    WHERE s.assessment_id = NEW.id;

    NEW.composite_score := calculated_score;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_assessment_submission
BEFORE UPDATE OF status
ON readiness_assessment
FOR EACH ROW
EXECUTE FUNCTION validate_and_calculate_assessment_submission();

CREATE OR REPLACE FUNCTION validate_evidence_has_citation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'ACTIVE' AND NOT EXISTS (
    SELECT 1 FROM evidence_citation ec WHERE ec.evidence_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'EVIDENCE_REQUIRES_CITATION';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_evidence_requires_citation
AFTER INSERT OR UPDATE OF status
ON evidence
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_evidence_has_citation();

CREATE OR REPLACE FUNCTION validate_recommendation_run_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM recommendation_item ri
      WHERE ri.recommendation_run_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'RECOMMENDATION_RUN_HAS_NO_ITEMS';
    END IF;

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

CREATE OR REPLACE FUNCTION prevent_milestone_dependency_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  predecessor_roadmap uuid;
  successor_roadmap uuid;
  cycle_exists boolean;
BEGIN
  SELECT roadmap_id INTO predecessor_roadmap
  FROM roadmap_milestone WHERE id = NEW.predecessor_milestone_id;

  SELECT roadmap_id INTO successor_roadmap
  FROM roadmap_milestone WHERE id = NEW.successor_milestone_id;

  IF predecessor_roadmap IS DISTINCT FROM successor_roadmap THEN
    RAISE EXCEPTION 'MILESTONE_DEPENDENCIES_MUST_BE_IN_SAME_ROADMAP';
  END IF;

  WITH RECURSIVE reachable(milestone_id) AS (
    SELECT md.successor_milestone_id
    FROM milestone_dependency md
    WHERE md.predecessor_milestone_id = NEW.successor_milestone_id
      AND (TG_OP <> 'UPDATE' OR md.id <> NEW.id)

    UNION

    SELECT md.successor_milestone_id
    FROM milestone_dependency md
    JOIN reachable r ON md.predecessor_milestone_id = r.milestone_id
    WHERE (TG_OP <> 'UPDATE' OR md.id <> NEW.id)
  )
  SELECT EXISTS (
    SELECT 1 FROM reachable
    WHERE milestone_id = NEW.predecessor_milestone_id
  ) INTO cycle_exists;

  IF cycle_exists THEN
    RAISE EXCEPTION 'MILESTONE_DEPENDENCY_CYCLE_DETECTED';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_milestone_dependency_cycle
BEFORE INSERT OR UPDATE OF predecessor_milestone_id, successor_milestone_id
ON milestone_dependency
FOR EACH ROW
EXECUTE FUNCTION prevent_milestone_dependency_cycle();

CREATE OR REPLACE FUNCTION validate_roadmap_approval()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  case_id uuid;
BEGIN
  IF NEW.status = 'APPROVED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT technology_case_id INTO case_id
    FROM roadmap
    WHERE id = NEW.id;

    IF EXISTS (
      SELECT 1
      FROM gap_record g
      WHERE g.technology_case_id = case_id
        AND g.severity = 'CRITICAL'
        AND g.status IN ('OPEN', 'IN_PROGRESS')
    ) THEN
      RAISE EXCEPTION 'ROADMAP_HAS_UNRESOLVED_CRITICAL_GAPS';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM roadmap_milestone rm WHERE rm.roadmap_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'ROADMAP_HAS_NO_MILESTONES';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_roadmap_approval
BEFORE UPDATE OF status
ON roadmap
FOR EACH ROW
EXECUTE FUNCTION validate_roadmap_approval();

CREATE OR REPLACE FUNCTION validate_transfer_manifest_share()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'SHARED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM transfer_manifest_item i
      WHERE i.transfer_manifest_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'TRANSFER_MANIFEST_HAS_NO_ITEMS';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM transfer_recipient r
      WHERE r.transfer_manifest_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'TRANSFER_MANIFEST_HAS_NO_RECIPIENTS';
    END IF;

    IF NEW.expires_at IS NOT NULL AND NEW.expires_at <= now() THEN
      RAISE EXCEPTION 'TRANSFER_MANIFEST_EXPIRATION_MUST_BE_FUTURE';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_transfer_manifest_share
BEFORE UPDATE OF status
ON transfer_manifest
FOR EACH ROW
EXECUTE FUNCTION validate_transfer_manifest_share();

-- ============================================================
-- ROW-LEVEL SECURITY SKELETON
-- ============================================================
-- At the start of every transaction, the API should execute:
--   SET LOCAL app.current_user_id = '<uuid>';
--   SET LOCAL app.current_org_id = '<uuid>';
-- Never accept these values directly from an unverified client payload.

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
