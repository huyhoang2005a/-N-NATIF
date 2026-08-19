-- ============================================================
-- "Ẩn khỏi màn hình" for decided proposals on the company-received side (2026-08-19).
-- Nullable, company-side-only declutter flag — never affects the proposer's own view of
-- their submitted proposals. See packages/database/src/schema/company-discovery.ts's
-- `dismissedAt` comment for the full rationale.
-- ============================================================

BEGIN;

ALTER TABLE research_proposal ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

COMMIT;
