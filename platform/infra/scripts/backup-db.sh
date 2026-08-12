#!/usr/bin/env bash
# Phase 7 Sprint 7.4 — database backup. Runs pg_dump *inside* the postgres container via
# `docker exec` rather than requiring pg_dump installed on the host (this repo's dev setup
# never assumes a local Postgres client toolchain — matches how migrate/seed always go
# through the containerized instance too).
#
# Disclosed scope limit: this is a single-machine local dev setup. A "backup" here is a
# pg_dump artifact written to ./backups/ on the same disk as the database container's
# volume — not replicated off-machine. Real deployments need the dump shipped to separate
# storage (S3/off-site) immediately after this step; that's an infra decision for wherever
# this is actually deployed, not something this script can decide.
#
# MinIO (object storage for resource/verification files) is NOT dumped by this script —
# it's volume-backed (`r2m-minio-data`, see infra/docker/docker-compose.yml), so backing it
# up means backing up that docker volume directly, e.g.:
#   docker run --rm -v r2m-v5-local_r2m-minio-data:/data -v "$(pwd)/backups":/backup \
#     alpine tar czf /backup/minio-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
# Not automated here (no restore drill was run against it in this pass — see
# docs/ops/BACKUP_RESTORE_LOG.md for what was actually verified).

set -euo pipefail

CONTAINER="r2m-v5-local-postgres-1"
DB_USER="r2m"
DB_NAME="r2m_dev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/../../backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$BACKUP_DIR/r2m_dev-$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[backup-db] dumping $DB_NAME from $CONTAINER -> $OUT_FILE"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --format=plain | gzip > "$OUT_FILE"

SIZE=$(du -h "$OUT_FILE" | cut -f1)
echo "[backup-db] done: $OUT_FILE ($SIZE)"
