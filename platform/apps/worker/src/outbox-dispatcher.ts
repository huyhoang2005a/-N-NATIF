import type { DomainEvent } from "@r2m/contracts";
import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import type { EmailSender } from "@r2m/domain";
import { and, eq, inArray, lte } from "drizzle-orm";
import {
  authorApprovedTemplate,
  authorRejectedTemplate,
  organizationApprovedTemplate,
  organizationRejectedTemplate,
  verifyEmailTemplate,
} from "./email/templates";
import { scanResourceUpload } from "./file-safety/scan-resource-upload";
import { logger } from "./logger";
import {
  findActiveOrgOwnerUserId,
  findContentOwnerUserId,
  findUserEmail,
  listActiveOrgOwnersAndAdmins,
  listActivePlatformReviewerIds,
  notify,
} from "./notify";
import { generateRecommendationRun } from "./recommendation/generate-recommendation-run";
import { withLinkedSpan } from "./trace-context";

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_ATTEMPTS = 5;
// Phase 7 Sprint 7.2 — spec §7.5 ("mọi background job phải có chiến lược retry + dead-letter")
// and architecture plan line ~1631 ("retry exponential backoff, max attempts và dead-letter
// state") — previously a failed row was retried on the very next 2s poll tick regardless of
// why it failed, hammering a possibly-still-broken downstream (e.g. Resend down) every 2s.
const BACKOFF_BASE_MS = 5000;
const BACKOFF_MAX_MS = 10 * 60 * 1000;

function computeBackoffDelayMs(attemptCount: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** (attemptCount - 1), BACKOFF_MAX_MS);
}

/**
 * Turns a domain event into an in-app notification. Events with no reader-facing meaning
 * (OrganizationRegistered, UserProfileUpdated) are acknowledged without producing one —
 * "no notification" is a valid, deliberate outcome, not a missing case.
 */
async function handleEvent(db: Database, event: DomainEvent, emailSender: EmailSender): Promise<void> {
  switch (event.type) {
    case "EmailVerificationRequested": {
      const { subject, html } = verifyEmailTemplate(event.token, event.expiresAt);
      await emailSender.send({ to: event.email, subject, html });
      return;
    }
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
        const email = await findUserEmail(db, ownerId);
        if (email) {
          const { subject, html } = organizationApprovedTemplate();
          await emailSender.send({ to: email, subject, html });
        }
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
        const email = await findUserEmail(db, ownerId);
        if (email) {
          const { subject, html } = organizationRejectedTemplate(event.reason);
          await emailSender.send({ to: email, subject, html });
        }
      }
      return;
    }
    case "OrganizationJoinRequested": {
      const recipientIds = await listActiveOrgOwnersAndAdmins(db, event.organizationId);
      await Promise.all(
        recipientIds.map((recipientUserId) =>
          notify(db, {
            recipientUserId,
            scopeOrganizationId: event.organizationId,
            type: "organization_join_request.requested",
            title: "New request to join your organization",
            message: `A new user requested to join your organization.`,
            dedupeKey: `org-join-requested:${event.memberId}`,
          }),
        ),
      );
      return;
    }
    case "OrganizationJoinRequestDecided": {
      await notify(db, {
        recipientUserId: event.userId,
        scopeOrganizationId: event.organizationId,
        type: event.decision === "APPROVED" ? "organization_join_request.approved" : "organization_join_request.rejected",
        title: event.decision === "APPROVED" ? "Your join request was approved" : "Your join request was rejected",
        message:
          event.decision === "APPROVED"
            ? "You are now an active member of the organization."
            : "The organization did not approve your join request.",
        dedupeKey: `org-join-decided:${event.memberId}`,
      });
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
      const email = await findUserEmail(db, event.authorUserId);
      if (email) {
        const { subject, html } = authorApprovedTemplate();
        await emailSender.send({ to: email, subject, html });
      }
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
      const email = await findUserEmail(db, event.authorUserId);
      if (email) {
        const { subject, html } = authorRejectedTemplate(event.reason);
        await emailSender.send({ to: email, subject, html });
      }
      return;
    }
    case "ResourceIngestionQueued": {
      // Phase 7 Sprint 7.4 — real MIME sniff + malware scan, replacing the Phase 2 no-op.
      await scanResourceUpload(db, event.resourceVersionId, event.ingestionJobId);
      return;
    }
    case "OrganizationRegistered":
    case "UserProfileUpdated":
    case "ResourceRegistered":
    case "ResourceVersionPublished":
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
    case "RecommendationRunRequested": {
      await generateRecommendationRun(db, event.recommendationRunId);
      return;
    }
    case "RecommendationRunCompleted":
      // Same "no notification yet" treatment as TechnologyCaseCreated/RoadmapApproved —
      // no reader-facing UI depends on this event itself; the company reads results via
      // `GET /recommendation-runs/:id/items`, not a notification.
      return;
    case "CaseInitiationRequested": {
      await notify(db, {
        recipientUserId: event.targetAuthorUserId,
        type: "case_initiation.requested",
        title: "New case initiation request",
        message: `An organization wants to initiate a technology case from your resource.`,
        dedupeKey: `case-initiation-requested:${event.caseInitiationRequestId}`,
      });
      return;
    }
    case "CaseInitiationRequestDecided": {
      const title =
        event.decision === "ACCEPTED"
          ? "Your case initiation request was accepted"
          : event.decision === "DECLINED"
            ? "Your case initiation request was declined"
            : "Your case initiation request expired";
      await notify(db, {
        recipientUserId: event.requestedByUserId,
        scopeOrganizationId: event.requestingOrganizationId,
        type: "case_initiation.decided",
        title,
        message: title,
        dedupeKey: `case-initiation-decided:${event.caseInitiationRequestId}`,
      });
      return;
    }
    case "AuthorFollowed": {
      await notify(db, {
        recipientUserId: event.followedAuthorUserId,
        type: "author.followed",
        title: "You have a new follower",
        message: "Someone started following your author profile.",
        dedupeKey: `author-followed:${event.followerUserId}:${event.followedAuthorUserId}`,
      });
      return;
    }
    case "OrganizationFollowed": {
      const recipientIds = await listActiveOrgOwnersAndAdmins(db, event.followedOrganizationId);
      await Promise.all(
        recipientIds.map((recipientUserId) =>
          notify(db, {
            recipientUserId,
            scopeOrganizationId: event.followedOrganizationId,
            type: "organization.followed",
            title: "Your organization has a new follower",
            message: "Someone started following your organization's public profile.",
            dedupeKey: `org-followed:${event.followerUserId}:${event.followedOrganizationId}`,
          }),
        ),
      );
      return;
    }
    case "TransferManifestCreated":
      // Phase 6 Sprint 6.1 — audit-trail only, same "no notification yet" treatment as
      // TechnologyCaseCreated. Only TransferManifestShared (Sprint 6.2) notifies anyone.
      return;
    case "TransferManifestShared": {
      const orgRecipientNotifies = event.recipientOrganizationIds.map(async (organizationId) => {
        const recipientIds = await listActiveOrgOwnersAndAdmins(db, organizationId);
        await Promise.all(
          recipientIds.map((recipientUserId) =>
            notify(db, {
              recipientUserId,
              scopeOrganizationId: organizationId,
              type: "transfer_manifest.shared",
              title: "Your organization was granted access to a technology transfer package",
              message: "A technology case owner shared a transfer package with your organization.",
              dedupeKey: `transfer-manifest-shared:${event.transferManifestId}:org:${organizationId}`,
            }),
          ),
        );
      });
      const userRecipientNotifies = event.recipientUserIds.map((recipientUserId) =>
        notify(db, {
          recipientUserId,
          type: "transfer_manifest.shared",
          title: "You were granted access to a technology transfer package",
          message: "A technology case owner shared a transfer package with you.",
          dedupeKey: `transfer-manifest-shared:${event.transferManifestId}:user:${recipientUserId}`,
        }),
      );
      await Promise.all([...orgRecipientNotifies, ...userRecipientNotifies]);
      return;
    }
    case "TransferAccessRevoked":
      // Phase 6 Sprint 6.2 — no reader-facing notification requirement in UC-TRF-01 for
      // revoke (only share notifies); audit-trail only, same as TransferManifestCreated.
      return;
    case "ContentFlagCreated": {
      const reviewerIds = await listActivePlatformReviewerIds(db);
      await Promise.all(
        reviewerIds.map((recipientUserId) =>
          notify(db, {
            recipientUserId,
            type: "content_flag.requested",
            title: "New content flag to review",
            message: `A ${event.targetType.toLowerCase()} was flagged and needs review.`,
            dedupeKey: `content-flag-requested:${event.contentFlagId}`,
          }),
        ),
      );
      return;
    }
    case "ModerationDecisionRecorded": {
      const ownerUserId = await findContentOwnerUserId(db, event);
      const title = "A content flag you're involved in was resolved";
      const recipientIds = [...new Set([event.reporterUserId, ...(ownerUserId ? [ownerUserId] : [])])];
      await Promise.all(
        recipientIds.map((recipientUserId) =>
          notify(db, {
            recipientUserId,
            type: "content_flag.decided",
            title,
            message: `Decision: ${event.action}.`,
            dedupeKey: `content-flag-decided:${event.contentFlagId}:${recipientUserId}`,
          }),
        ),
      );
      return;
    }
    default: {
      const _exhaustive: never = event;
      throw new Error(`Unhandled domain event type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export interface DispatchResult {
  processed: number;
  failed: number;
  deadLetter: number;
}

/** Phase 7 Sprint 7.3 — `now() - oldest still-pending row's available_at`, 0 if the queue
 * is empty. Feeds `outbox_dispatch_lag_seconds` (NFR-05: outbox lag p95<=30s). */
export async function computeOutboxLagSeconds(db: Database): Promise<number> {
  const oldest = await db.query.outboxEvent.findFirst({
    where: inArray(schema.outboxEvent.status, ["PENDING", "FAILED"]),
    orderBy: (event, { asc }) => [asc(event.availableAt)],
  });
  if (!oldest) return 0;
  return Math.max(0, (Date.now() - oldest.availableAt.getTime()) / 1000);
}

/** Polls `outbox_event` and delivers PENDING/FAILED rows whose available_at has passed. */
export async function dispatchPendingEvents(
  db: Database,
  emailSender: EmailSender,
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
  let deadLetter = 0;

  for (const row of rows) {
    await db
      .update(schema.outboxEvent)
      .set({ status: "PROCESSING" })
      .where(eq(schema.outboxEvent.id, row.id));

    // Phase 7 Sprint 7.3 — correlates this log line back to the API request that produced
    // the event, when the caller passed `context` to `OutboxService.append()`.
    if (row.requestId) {
      logger.info({ requestId: row.requestId, eventType: row.eventType, outboxEventId: row.id }, "processing outbox event");
    }

    try {
      await withLinkedSpan(row.traceparent, `outbox.handle ${row.eventType}`, () => handleEvent(db, row.payload as DomainEvent, emailSender));
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
          // DEAD_LETTER rows are done retrying — availableAt no longer matters for them,
          // left as-is rather than pushed further out.
          ...(nextStatus === "FAILED" ? { availableAt: new Date(Date.now() + computeBackoffDelayMs(attemptCount)) } : {}),
        })
        .where(eq(schema.outboxEvent.id, row.id));
      if (nextStatus === "DEAD_LETTER") {
        deadLetter += 1;
      } else {
        failed += 1;
      }
    }
  }

  return { processed, failed, deadLetter };
}
