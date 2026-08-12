# Backup & Restore Log

Records of actual backup/restore drills — per spec §7.7 ("Backup/restore test thành công,
có ghi log thời gian thực hiện"). Not a runbook (see `infra/scripts/backup-db.sh` for the
script itself) — this file is the evidence that it was actually run and worked.

## 2026-08-10 — first drill (Phase 7 Sprint 7.4)

**Backup:**
- Command: `infra/scripts/backup-db.sh`
- Method: `pg_dump` inside the `r2m-v5-local-postgres-1` container (plain SQL format,
  gzipped on the host side).
- Output: `backups/r2m_dev-20260810-173816.sql.gz` — 56 KB.
- Duration: a few seconds (dataset is small — local dev/demo data, not production volume).

**Restore drill:**
- Target: a fresh scratch database `r2m_dev_restore_test` on the SAME Postgres instance
  (`CREATE DATABASE r2m_dev_restore_test OWNER r2m;`), not overwriting `r2m_dev`.
- Command: `gunzip -c <dump> | docker exec -i r2m-v5-local-postgres-1 psql -U r2m -d
  r2m_dev_restore_test`.
- **Duration: 5 seconds.**
- Result: **success**, no errors in restore output.

**Verification performed:**
| Check | Source (`r2m_dev`) | Restored (`r2m_dev_restore_test`) | Match |
|---|---|---|---|
| `user_account` row count | 8 | 8 | ✅ |
| `organization` row count | 5 | 5 | ✅ |
| `technology_case` row count | 3 | 3 | ✅ |
| `resource` row count | 4 | 4 | ✅ |
| `_manual_migration` tracking table present, 11 rows (0002–0012) | — | ✅ present, 11 rows | ✅ |
| `r2m_app` role (Sprint 7.1 non-superuser runtime role) can connect and query the restored DB | — | `SELECT count(*) FROM resource` → 4, no permission error | ✅ |

The last check matters specifically because table-level `GRANT`s are per-database in
Postgres — confirms `pg_dump`/`psql` restore captured the Sprint 7.1 security hardening
(narrower `r2m_app` grants, `audit_log` UPDATE/DELETE revoked) along with the data, not
just the rows.

**Cleanup:** scratch database dropped after verification (`DROP DATABASE
r2m_dev_restore_test;`) — did not touch `r2m_dev`.

**Scope disclosed** (see `infra/scripts/backup-db.sh` header comment): this is a
single-machine local dev setup. The dump lives on the same disk as the database's own
docker volume — a real deployment needs it shipped off-machine immediately after this step.
MinIO (object storage) was **not** included in this drill — it's volume-backed, not
`pg_dump`-backed; backing it up means snapshotting the `r2m-minio-data` docker volume
directly (documented in the script, not automated/tested in this pass).
