import type { Database } from "@r2m/db";
import { schema } from "@r2m/db";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";

function firstOrThrow<T>(rows: T[], message: string): T {
  const row = rows[0];
  if (!row) throw new Error(message);
  return row;
}

@Injectable()
export class OrganizationsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findBySlug(slug: string, tx?: Database) {
    const client = tx ?? this.db;
    return client.query.organization.findFirst({ where: eq(schema.organization.slug, slug) });
  }

  async findById(id: string) {
    return this.db.query.organization.findFirst({ where: eq(schema.organization.id, id) });
  }

  async findUserByEmail(email: string, tx?: Database) {
    const client = tx ?? this.db;
    return client.query.userAccount.findFirst({ where: eq(schema.userAccount.primaryEmail, email) });
  }

  async createUserAccount(
    values: typeof schema.userAccount.$inferInsert,
    tx: Database,
  ) {
    const rows = await tx.insert(schema.userAccount).values(values).returning();
    return firstOrThrow(rows, "createUserAccount: insert returned no row");
  }

  async createUserIdentity(values: typeof schema.userIdentity.$inferInsert, tx: Database) {
    await tx.insert(schema.userIdentity).values(values);
  }

  async createUserProfile(values: typeof schema.userProfile.$inferInsert, tx: Database) {
    await tx.insert(schema.userProfile).values(values);
  }

  async createOrganization(values: typeof schema.organization.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.organization).values(values).returning();
    return firstOrThrow(rows, "createOrganization: insert returned no row");
  }

  async createOrganizationDomain(values: typeof schema.organizationDomain.$inferInsert, tx: Database) {
    await tx.insert(schema.organizationDomain).values(values);
  }

  async createOrganizationMember(
    values: typeof schema.organizationMember.$inferInsert,
    tx?: Database,
  ) {
    const client = tx ?? this.db;
    const rows = await client.insert(schema.organizationMember).values(values).returning();
    return firstOrThrow(rows, "createOrganizationMember: insert returned no row");
  }

  async createVerificationRequest(
    values: typeof schema.organizationVerificationRequest.$inferInsert,
    tx: Database,
  ) {
    const rows = await tx.insert(schema.organizationVerificationRequest).values(values).returning();
    return firstOrThrow(rows, "createVerificationRequest: insert returned no row");
  }

  async findMemberById(organizationId: string, memberId: string) {
    return this.db.query.organizationMember.findFirst({
      where: and(
        eq(schema.organizationMember.id, memberId),
        eq(schema.organizationMember.organizationId, organizationId),
      ),
    });
  }

  async findMemberByUserId(organizationId: string, userId: string) {
    return this.db.query.organizationMember.findFirst({
      where: and(
        eq(schema.organizationMember.organizationId, organizationId),
        eq(schema.organizationMember.userId, userId),
      ),
    });
  }

  async listMembersForActiveOrganizations(userId: string) {
    return this.db.query.organizationMember.findMany({
      where: and(eq(schema.organizationMember.userId, userId), eq(schema.organizationMember.status, "ACTIVE")),
      with: { organization: true },
    });
  }

  async updateOrganization(
    id: string,
    expectedVersion: number,
    updates: Partial<typeof schema.organization.$inferInsert>,
  ) {
    const rows = await this.db
      .update(schema.organization)
      .set(updates)
      .where(and(eq(schema.organization.id, id), eq(schema.organization.version, expectedVersion)))
      .returning();
    return rows[0];
  }

  async updateOrganizationMember(
    memberId: string,
    updates: Partial<typeof schema.organizationMember.$inferInsert>,
  ) {
    const rows = await this.db
      .update(schema.organizationMember)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.organizationMember.id, memberId))
      .returning();
    return firstOrThrow(rows, "updateOrganizationMember: update matched no row");
  }
}
