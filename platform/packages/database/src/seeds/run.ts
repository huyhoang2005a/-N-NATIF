import * as bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "../client";
import { userAccount, userIdentity, userProfile } from "../schema/identity";
import { organization, organizationMember } from "../schema/organization";

/**
 * Dev-only seed: one platform admin and one platform reviewer (for reviewing
 * organization verification requests as two distinct roles) and one already-ACTIVE
 * sample organization with its owner. Safe to re-run — every insert is guarded by an
 * existence check instead of relying on ON CONFLICT DO NOTHING, so partial re-runs
 * after a failure still converge.
 */
async function main(): Promise<void> {
  const db = getDb();

  const adminEmail = "admin@r2m.local";
  const existingAdmin = await db.query.userAccount.findFirst({
    where: eq(userAccount.primaryEmail, adminEmail),
  });

  let adminId = existingAdmin?.id;
  if (!adminId) {
    const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
    const [admin] = await db
      .insert(userAccount)
      .values({
        primaryEmail: adminEmail,
        platformRole: "PLATFORM_ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      })
      .returning();
    if (!admin) throw new Error("[seed] admin insert returned no row");
    adminId = admin.id;
    await db.insert(userIdentity).values({
      userId: adminId,
      provider: "LOCAL",
      providerSubject: adminEmail,
      passwordHash,
    });
    await db.insert(userProfile).values({
      userId: adminId,
      displayName: "R2M Platform Admin",
    });
    console.log(`[seed] created platform admin ${adminEmail}`);
  } else {
    console.log(`[seed] platform admin ${adminEmail} already exists, skipping`);
  }

  const reviewerEmail = "reviewer@r2m.local";
  const existingReviewer = await db.query.userAccount.findFirst({
    where: eq(userAccount.primaryEmail, reviewerEmail),
  });

  let reviewerId = existingReviewer?.id;
  if (!reviewerId) {
    const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
    const [reviewer] = await db
      .insert(userAccount)
      .values({
        primaryEmail: reviewerEmail,
        platformRole: "PLATFORM_REVIEWER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      })
      .returning();
    if (!reviewer) throw new Error("[seed] reviewer insert returned no row");
    reviewerId = reviewer.id;
    await db.insert(userIdentity).values({
      userId: reviewerId,
      provider: "LOCAL",
      providerSubject: reviewerEmail,
      passwordHash,
    });
    await db.insert(userProfile).values({
      userId: reviewerId,
      displayName: "R2M Platform Reviewer",
    });
    console.log(`[seed] created platform reviewer ${reviewerEmail}`);
  } else {
    console.log(`[seed] platform reviewer ${reviewerEmail} already exists, skipping`);
  }

  const ownerEmail = "owner@sample-research-unit.local";
  const existingOwner = await db.query.userAccount.findFirst({
    where: eq(userAccount.primaryEmail, ownerEmail),
  });

  let ownerId = existingOwner?.id;
  if (!ownerId) {
    const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
    const [owner] = await db
      .insert(userAccount)
      .values({
        primaryEmail: ownerEmail,
        platformRole: "USER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      })
      .returning();
    if (!owner) throw new Error("[seed] owner insert returned no row");
    ownerId = owner.id;
    await db.insert(userIdentity).values({
      userId: ownerId,
      provider: "LOCAL",
      providerSubject: ownerEmail,
      passwordHash,
    });
    await db.insert(userProfile).values({
      userId: ownerId,
      displayName: "Sample Research Unit Owner",
    });
    console.log(`[seed] created sample org owner ${ownerEmail}`);
  } else {
    console.log(`[seed] sample org owner ${ownerEmail} already exists, skipping`);
  }

  const existingOrg = await db.query.organization.findFirst({
    where: eq(organization.slug, "sample-research-unit"),
  });

  if (!existingOrg) {
    const [org] = await db
      .insert(organization)
      .values({
        name: "Sample Research Unit",
        slug: "sample-research-unit",
        type: "RESEARCH_UNIT",
        status: "ACTIVE",
        createdByUserId: ownerId,
        primaryContactUserId: ownerId,
      })
      .returning();
    if (!org) throw new Error("[seed] organization insert returned no row");
    await db.insert(organizationMember).values({
      organizationId: org.id,
      userId: ownerId,
      role: "ORG_OWNER",
      status: "ACTIVE",
      joinedAt: new Date(),
    });
    console.log(`[seed] created sample organization ${org.slug}`);
  } else {
    console.log("[seed] sample organization already exists, skipping");
  }

  await closeDb();
}

main().catch((error) => {
  console.error("[seed] failed", error);
  process.exitCode = 1;
});
