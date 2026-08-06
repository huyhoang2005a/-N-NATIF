import type { DomainEvent } from "@r2m/contracts";
import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
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
    case "AuthorVerificationSubmitted": {
      const reviewerIds = await listActivePlatformReviewerIds(db);
      await Promise.all(
        reviewerIds.map((recipientUserId) =>
          notify(db, {
            recipientUserId,
            type: "author_verification.requested",
            title: "New author verification request",
            message: `Author ${event.authorUserId} submitted a verification request.`,
            dedupeKey: `author-verification-requested:${event.verificationRequestId}`,
          }),
        ),
      );
      return;
    }
    case "AuthorVerified": {
      await notify(db, {
        recipientUserId: event.authorUserId,
        type: "author_verification.approved",
        title: "You are now a verified author",
        message: "Your author verification request was approved.",
        dedupeKey: `author-verification-decided:${event.verificationRequestId}`,
      });
      return;
    }
    case "AuthorVerificationRejected": {
      await notify(db, {
        recipientUserId: event.authorUserId,
        type: "author_verification.rejected",
        title: "Author verification was rejected",
        message: event.reason,
        dedupeKey: `author-verification-decided:${event.verificationRequestId}`,
      });
      return;
    }
    case "OrganizationRegistered":
    case "UserProfileUpdated":
    case "ResourceRegistered":
    case "ResourceVersionPublished":
    case "ResourceIngestionQueued":
    case "AnnotationCreated":
    case "AnnotationRevised":
    case "AnnotationRemoved":
    case "ResourceAccessGranted":
    case "ResourceAccessRevoked":
      // Phase 2 simplification (see plan B.0): no notification recipient/UI depends on
      // these yet — same "no reader-facing meaning" treatment as OrganizationRegistered.
      return;
    case "TechnologyCaseCreated":
    case "CaseStatusChanged":
    case "EvidenceLinked":
      // Phase 3 simplification (see plan PHẦN C): same "no notification yet" treatment
      // as most Phase 2 events — no reader-facing UI depends on these.
      return;
    case "AssessmentSubmitted":
    case "AssessmentApproved":
    case "CriticalGapRaised":
    case "RoadmapApproved":
      // Phase 4 simplification (see plan PHẦN D quyết định 9): không notification —
      // đúng tiền lệ Phase 2/3, chỉ giữ event cho audit/outbox, chưa có UI đọc.
      return;
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
