import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";

let emailCounter = 0;
let slugCounter = 0;

export async function createTestUser(
  db: Database,
  overrides: Partial<typeof schema.userAccount.$inferInsert> = {},
) {
  emailCounter += 1;
  const [user] = await db
    .insert(schema.userAccount)
    .values({
      primaryEmail: `test-user-${emailCounter}@example.test`,
      status: "ACTIVE",
      ...overrides,
    })
    .returning();
  if (!user) throw new Error("createTestUser: insert returned no row");
  await db.insert(schema.userProfile).values({
    userId: user.id,
    displayName: `Test User ${emailCounter}`,
  });
  return user;
}

export async function createTestOrganization(
  db: Database,
  ownerUserId: string,
  overrides: Partial<typeof schema.organization.$inferInsert> = {},
) {
  slugCounter += 1;
  const [org] = await db
    .insert(schema.organization)
    .values({
      name: `Test Org ${slugCounter}`,
      slug: `test-org-${slugCounter}`,
      type: "RESEARCH_UNIT",
      status: "PENDING_VERIFICATION",
      createdByUserId: ownerUserId,
      ...overrides,
    })
    .returning();
  if (!org) throw new Error("createTestOrganization: insert returned no row");
  await db.insert(schema.organizationMember).values({
    organizationId: org.id,
    userId: ownerUserId,
    role: "ORG_OWNER",
    status: "ACTIVE",
    joinedAt: new Date(),
  });
  return org;
}
