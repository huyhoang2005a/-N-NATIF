-- ============================================================
-- Community & networking layer — Đợt 1 (upvote). New feature, not part of the locked
-- spec (explicitly authorized). `content_vote` uses the same "exactly one FK non-null"
-- pattern as `case_origin`/`verification_document` — CHECK + partial unique indexes are
-- hand-written here rather than in the Drizzle schema, matching that precedent exactly.
-- ============================================================

ALTER TABLE content_vote
  ADD CONSTRAINT chk_content_vote_exactly_one_target
  CHECK (num_nonnulls(resource_id, research_need_id) = 1);

-- One vote per voter per resource / per research_need. Partial (not a plain composite
-- unique) because the other FK column is always NULL on any given row, and NULLs are
-- distinct from each other in a standard unique constraint — a plain composite unique
-- would never actually block a duplicate vote.
CREATE UNIQUE INDEX uq_content_vote_voter_resource
  ON content_vote (voter_user_id, resource_id)
  WHERE resource_id IS NOT NULL;

CREATE UNIQUE INDEX uq_content_vote_voter_research_need
  ON content_vote (voter_user_id, research_need_id)
  WHERE research_need_id IS NOT NULL;
