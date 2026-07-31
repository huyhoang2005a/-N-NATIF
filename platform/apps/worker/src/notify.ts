import type { Database } from "@r2m/db";
import { schema } from "@r2m/db";
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
  await db.insert(schema.notification).values({
    recipientUserId: input.recipientUserId,
    scopeOrganizationId: input.scopeOrganizationId ?? null,
    type: input.type,
    title: input.title,
    message: input.message,
    dedupeKey: input.dedupeKey ?? null,
  });
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

export async function listActivePlatformReviewerIds(db: Database): Promise<string[]> {
  const reviewers = await db.query.userAccount.findMany({
    where: eq(schema.userAccount.status, "ACTIVE"),
  });
  return reviewers
    .filter((user) => user.platformRole === "PLATFORM_REVIEWER" || user.platformRole === "PLATFORM_ADMIN")
    .map((user) => user.id);
}
