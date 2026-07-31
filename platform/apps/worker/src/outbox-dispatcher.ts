import type { DomainEvent } from "@r2m/contracts";
import type { Database } from "@r2m/db";
import { schema } from "@r2m/db";
import { and, eq, inArray, lte } from "drizzle-orm";
import { findActiveOrgOwnerUserId, listActivePlatformReviewerIds, notify } from "./notify";

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_ATTEMPTS = 5;

/**
 * Turns a domain event into an in-app notification. Events with no reader-facing meaning
 * (OrganizationRegistered, UserProfileUpdated) are acknowledged without producing one —
 * "no notification" is a valid, deliberate outcome, not a missing case.
 */
async function handleEvent(db: Database, event: DomainEvent): Promise<void> {
  switch (event.type) {
    case "OrganizationVerificationRequested": {
      const reviewerIds = await listActivePlatformReviewerIds(db);
      await Promise.all(
        reviewerIds.map((recipientUserId) =>
          notify(db, {
            recipientUserId,
            type: "organization_verification.requested",
            title: "New organization verification request",
            message: `Organization ${event.organizationId} submitted a verification request.`,
            dedupeKey: `org-verification-requested:${event.verificationRequestId}`,
          }),
        ),
      );
      return;
    }
    case "OrganizationActivated": {
      const ownerId = await findActiveOrgOwnerUserId(db, event.organizationId);
      if (ownerId) {
        await notify(db, {
          recipientUserId: ownerId,
          scopeOrganizationId: event.organizationId,
          type: "organization_verification.approved",
          title: "Your organization was verified",
          message: "Your organization is now ACTIVE.",
          dedupeKey: `org-verification-decided:${event.verificationRequestId}`,
        });
      }
      return;
    }
    case "OrganizationVerificationRejected": {
      const ownerId = await findActiveOrgOwnerUserId(db, event.organizationId);
      if (ownerId) {
        await notify(db, {
          recipientUserId: ownerId,
          scopeOrganizationId: event.organizationId,
          type: "organization_verification.rejected",
          title: "Organization verification was rejected",
          message: event.reason,
          dedupeKey: `org-verification-decided:${event.verificationRequestId}`,
        });
      }
      return;
    }
    case "OrganizationMemberInvited": {
      await notify(db, {
        recipientUserId: event.invitedUserId,
        scopeOrganizationId: event.organizationId,
        type: "organization_member.invited",
        title: "You were invited to an organization",
        message: `You were invited as ${event.role}.`,
        dedupeKey: `org-member-invited:${event.memberId}`,
      });
      return;
    }
    case "OrganizationMemberRoleChanged": {
      const member = await db.query.organizationMember.findFirst({
        where: eq(schema.organizationMember.id, event.memberId),
      });
      if (member) {
        await notify(db, {
          recipientUserId: member.userId,
          scopeOrganizationId: event.organizationId,
          type: "organization_member.role_changed",
          title: "Your organization role changed",
          message: `Your role changed from ${event.previousRole} to ${event.newRole}.`,
        });
      }
      return;
    }
    case "OrganizationRegistered":
    case "UserProfileUpdated":
      return; // intentionally no notification
    default: {
      const _exhaustive: never = event;
      throw new Error(`Unhandled domain event type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export interface DispatchResult {
  processed: number;
  failed: number;
}

/** Polls `outbox_event` and delivers PENDING/FAILED rows whose available_at has passed. */
export async function dispatchPendingEvents(
  db: Database,
  options: { batchSize?: number; maxAttempts?: number } = {},
): Promise<DispatchResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  const rows = await db.query.outboxEvent.findMany({
    where: and(
      inArray(schema.outboxEvent.status, ["PENDING", "FAILED"]),
      lte(schema.outboxEvent.availableAt, new Date()),
    ),
    limit: batchSize,
  });

  let processed = 0;
  let failed = 0;

  for (const row of rows) {
    await db
      .update(schema.outboxEvent)
      .set({ status: "PROCESSING" })
      .where(eq(schema.outboxEvent.id, row.id));

    try {
      await handleEvent(db, row.payload as DomainEvent);
      await db
        .update(schema.outboxEvent)
        .set({ status: "PUBLISHED", publishedAt: new Date() })
        .where(eq(schema.outboxEvent.id, row.id));
      processed += 1;
    } catch (error) {
      const attemptCount = row.attemptCount + 1;
      const nextStatus = attemptCount >= maxAttempts ? "DEAD_LETTER" : "FAILED";
      await db
        .update(schema.outboxEvent)
        .set({
          status: nextStatus,
          attemptCount,
          lastError: error instanceof Error ? error.message : String(error),
        })
        .where(eq(schema.outboxEvent.id, row.id));
      failed += 1;
    }
  }

  return { processed, failed };
}
