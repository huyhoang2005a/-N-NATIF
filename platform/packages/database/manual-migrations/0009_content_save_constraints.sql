-- ============================================================
-- Community & networking layer — Đợt 2 (save/bookmark). Same "exactly one FK non-null"
-- pattern as `content_vote` in 0008_community_constraints.sql — CHECK + partial unique
-- indexes hand-written here, not in the Drizzle schema, same precedent.
-- ============================================================

ALTER TABLE content_save
  ADD CONSTRAINT chk_content_save_exactly_one_target
  CHECK (num_nonnulls(resource_id, research_need_id) = 1);

-- One save per saver per resource / per research_need. Partial (not plain composite
-- unique) for the same reason as content_vote: NULLs are distinct from each other in a
-- standard unique constraint, so a plain composite unique would never block a duplicate.
CREATE UNIQUE INDEX uq_content_save_saver_resource
  ON content_save (saver_user_id, resource_id)
  WHERE resource_id IS NOT NULL;

CREATE UNIQUE INDEX uq_content_save_saver_research_need
  ON content_save (saver_user_id, research_need_id)
  WHERE research_need_id IS NOT NULL;
