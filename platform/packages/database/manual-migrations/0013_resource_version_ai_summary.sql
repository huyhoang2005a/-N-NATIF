-- ============================================================
-- Activity-feed document experience (2026-08-19) — adds a cache column for the AI summary
-- of a resource version's extracted text (`resource_chunk`, populated by the ingestion
-- pipeline built in an earlier session — see [[r2m_p0_embedding_pipeline]]). Generated once
-- via Gemini on first request (`POST /resources/:id/versions/:versionId/summarize`) and
-- reused on every later view, same "compute once, cache on the row" idea as
-- `resource_version.content_hash_sha256`. Nullable: never generated, Gemini not configured,
-- or the version has no extracted chunks yet.
-- ============================================================

BEGIN;

ALTER TABLE resource_version ADD COLUMN IF NOT EXISTS ai_summary text;

COMMIT;
