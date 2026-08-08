import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { and, eq, lt } from "drizzle-orm";
import { notify } from "../notify";

/** §3 Sprint 5.6 item 23: "Job định kỳ: quét case_initiation_request(PENDING) quá
 * expires_at → EXPIRED, notify công ty." No cron infra in this app (see `main.ts`'s
 * comment on the outbox poll loop) — called on a slower interval from the same process,
 * same "no new infra" principle as everything else in Phase 1-5. */
export async function sweepExpiredCaseInitiationRequests(db: Database): Promise<number> {
  const expired = await db.query.caseInitiationRequest.findMany({
    where: and(eq(schema.caseInitiationRequest.status, "PENDING"), lt(schema.caseInitiationRequest.expiresAt, new Date())),
  });

  for (const request of expired) {
    await db
      .update(schema.caseInitiationRequest)
      .set({ status: "EXPIRED", respondedAt: new Date() })
      .where(and(eq(schema.caseInitiationRequest.id, request.id), eq(schema.caseInitiationRequest.status, "PENDING")));

    await notify(db, {
      recipientUserId: request.requestedByUserId,
      scopeOrganizationId: request.requestingOrganizationId,
      type: "case_initiation.decided",
      title: "Your case initiation request expired",
      message: "The author did not respond before the request expired.",
      dedupeKey: `case-initiation-decided:${request.id}`,
    });
  }

  return expired.length;
}
