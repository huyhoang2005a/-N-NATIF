import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { and, eq } from "drizzle-orm";

export async function notify(
  db: Database,
  input: {
    recipientUserId: string;
    scopeOrganizationId?: string;
    type: string;
    title: string;
    message: string;
    dedupeKey?: string;
  },
): Promise<void> {
  // `onConflictDoNothing` matters for retry-safety: a case in `handleEvent` typically does
  // notify() THEN an email send — if the email send throws, the outbox row is retried and
  // this same notify() call runs again with the same dedupeKey. Without this, the retry's
  // plain INSERT hits `uq_notification_dedupe` (recipient_user_id, dedupe_key) and throws,
  // which masks the real (email-send) failure and burns all retry attempts into
  // DEAD_LETTER on a duplicate-key error instead of the actual problem.
  await db.insert(schema.notification).values({
    recipientUserId: input.recipientUserId,
    scopeOrganizationId: input.scopeOrganizationId ?? null,
    type: input.type,
    title: input.title,
    message: input.message,
    dedupeKey: input.dedupeKey ?? null,
  }).onConflictDoNothing();
}

export async function findActiveOrgOwnerUserId(
  db: Database,
  organizationId: string,
): Promise<string | undefined> {
  const owner = await db.query.organizationMember.findFirst({
    where: and(
      eq(schema.organizationMember.organizationId, organizationId),
      eq(schema.organizationMember.role, "ORG_OWNER"),
      eq(schema.organizationMember.status, "ACTIVE"),
    ),
  });
  return owner?.userId;
}

export async function findUserEmail(db: Database, userId: string): Promise<string | undefined> {
  const user = await db.query.userAccount.findFirst({ where: eq(schema.userAccount.id, userId) });
  return user?.primaryEmail;
}

export async function listActiveOrgOwnersAndAdmins(db: Database, organizationId: string): Promise<string[]> {
  const members = await db.query.organizationMember.findMany({
    where: and(eq(schema.organizationMember.organizationId, organizationId), eq(schema.organizationMember.status, "ACTIVE")),
  });
  return members
    .filter((member) => member.role === "ORG_OWNER" || member.role === "ORG_ADMIN")
    .map((member) => member.userId);
}

export async function listActivePlatformReviewerIds(db: Database): Promise<string[]> {
  const reviewers = await db.query.userAccount.findMany({
    where: eq(schema.userAccount.status, "ACTIVE"),
  });
  return reviewers
    .filter((user) => user.platformRole === "PLATFORM_REVIEWER" || user.platformRole === "PLATFORM_ADMIN")
    .map((user) => user.id);
}

/** Phase 6 Sprint 6.3 — `ModerationDecisionRecordedEvent` carries the raw target
 * reference, not a resolved owner id (resolve-at-dispatch, same reasoning as
 * `listActiveOrgOwnersAndAdmins` for `OrganizationFollowedEvent`). `TECHNOLOGY_PROFILE`
 * has no direct `created_by`/`owner` column — its "owner" is the case's active OWNER
 * `case_member`, resolved via `technology_profile.technology_case_id`. Returns
 * `undefined` if the target (or its owner) can no longer be found — the caller should
 * skip notifying in that case, same "no crash on stale reference" treatment as
 * `findActiveOrgOwnerUserId`. */
export async function findContentOwnerUserId(
  db: Database,
  target: { targetType: string; targetResourceId: string | null; targetAnnotationId: string | null; targetTechnologyProfileId: string | null },
): Promise<string | undefined> {
  if (target.targetType === "RESOURCE" && target.targetResourceId) {
    const resource = await db.query.resource.findFirst({ where: eq(schema.resource.id, target.targetResourceId) });
    return resource?.createdByUserId;
  }
  if (target.targetType === "ANNOTATION" && target.targetAnnotationId) {
    const annotation = await db.query.annotation.findFirst({ where: eq(schema.annotation.id, target.targetAnnotationId) });
    return annotation?.createdByUserId;
  }
  if (target.targetType === "TECHNOLOGY_PROFILE" && target.targetTechnologyProfileId) {
    const profile = await db.query.technologyProfile.findFirst({ where: eq(schema.technologyProfile.id, target.targetTechnologyProfileId) });
    if (!profile) return undefined;
    const owner = await db.query.caseMember.findFirst({
      where: and(eq(schema.caseMember.technologyCaseId, profile.technologyCaseId), eq(schema.caseMember.role, "OWNER"), eq(schema.caseMember.status, "ACTIVE")),
    });
    return owner?.userId;
  }
  return undefined;
}
