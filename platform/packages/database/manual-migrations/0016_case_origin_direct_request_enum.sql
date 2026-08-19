-- Add the case_origin_type enum value used by resource-sourced case initiation requests
-- (2026-08-19). Must be its own migration — Postgres forbids using a newly-added enum
-- label in the same transaction that added it, so the CHECK constraint update that
-- actually references this value lives in the next migration (0017), applied separately
-- by src/migrate.ts (one pool.query() per file).

ALTER TYPE case_origin_type ADD VALUE IF NOT EXISTS 'DISCOVERY_DIRECT_REQUEST';
