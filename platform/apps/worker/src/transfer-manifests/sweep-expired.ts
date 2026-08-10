import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { and, eq, isNotNull, lt } from "drizzle-orm";

/** Phase 6 Sprint 6.2 — same "no cron infra" template as
 * `case-initiations/sweep-expired.ts` (Phase 5), called on the same slower interval from
 * `main.ts`'s loop. Two independent things can expire: the manifest itself
 * (`transfer_manifest.expires_at`, the share-time default) and any individual grant that
 * got a more restrictive per-recipient `expires_at` override at add-recipient time (see
 * `TransferManifestService.share()`) — both re-assert their current status in the WHERE
 * clause (same race-guard pattern as the case-initiation sweep), so a manual revoke
 * racing this sweep can't be silently overwritten back to EXPIRED. */
export async function sweepExpiredTransferManifests(db: Database): Promise<number> {
  const expiredManifests = await db.query.transferManifest.findMany({
    where: and(eq(schema.transferManifest.status, "SHARED"), lt(schema.transferManifest.expiresAt, new Date())),
  });

  for (const manifest of expiredManifests) {
    await db
      .update(schema.transferManifest)
      .set({ status: "EXPIRED" })
      .where(and(eq(schema.transferManifest.id, manifest.id), eq(schema.transferManifest.status, "SHARED")));
  }

  const expiredGrants = await db.query.resourceAccessGrant.findMany({
    where: and(
      isNotNull(schema.resourceAccessGrant.sourceTransferManifestId),
      eq(schema.resourceAccessGrant.status, "ACTIVE"),
      lt(schema.resourceAccessGrant.expiresAt, new Date()),
    ),
  });

  for (const grant of expiredGrants) {
    await db
      .update(schema.resourceAccessGrant)
      .set({ status: "EXPIRED" })
      .where(and(eq(schema.resourceAccessGrant.id, grant.id), eq(schema.resourceAccessGrant.status, "ACTIVE")));
  }

  return expiredManifests.length + expiredGrants.length;
}
