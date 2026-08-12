import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { deleteVerificationObject } from "../file-safety/s3-object";
import { logger } from "../logger";

/** Phase 7 Sprint 7.4 — deletes both the storage object and the `verification_document`
 * row once `retentionUntil` (set manually via `POST /platform/verification-documents/:id/
 * retention`, never auto-computed — see that endpoint's comment) has passed. Same
 * no-cron-infra, slow-interval-in-the-same-poll-loop pattern as every other sweep in this
 * app (`case-initiations/sweep-expired.ts`, `transfer-manifests/sweep-expired.ts`). */
export async function sweepExpiredVerificationDocuments(db: Database): Promise<number> {
  const expired = await db.query.verificationDocument.findMany({
    where: and(isNotNull(schema.verificationDocument.retentionUntil), lt(schema.verificationDocument.retentionUntil, new Date())),
  });

  for (const document of expired) {
    try {
      await deleteVerificationObject(document.storageObjectKey);
    } catch (error) {
      logger.error({ err: error, documentId: document.id }, "sweepExpiredVerificationDocuments: failed to delete storage object");
      continue; // don't delete the DB row if the object delete failed — retry next sweep
    }
    await db.delete(schema.verificationDocument).where(eq(schema.verificationDocument.id, document.id));
  }

  return expired.length;
}
