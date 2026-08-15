import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";

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

  /** Not spec-mandated — explicit user-approved addition covering the frontend gap noted
   * in [[r2m_frontend_status]] ("`GET /organizations` only returns orgs the actor is a
   * member of, no platform-wide list"). Admin-only, gated in the service layer. */
  async listAll(limit: number, offset: number) {
    return this.db.query.organization.findMany({
      orderBy: [desc(schema.organization.createdAt)],
      limit,
      offset,
    });
  }

  /** Not spec-mandated — explicit user-approved addition for the admin dashboard's growth
   * chart. Raw grouped rows only — the service layer zero-fills weeks/types with no rows,
   * since that's shaping for the chart's stable axes, not a data-access concern. */
  async statsForPlatform() {
    const weeklySignupRows = await this.db
      .select({
        weekStart: sql<string>`date_trunc('week', ${schema.organization.createdAt})::date`,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.organization)
      .where(gte(schema.organization.createdAt, sql`now() - interval '12 weeks'`))
      .groupBy(sql`1`);

    const byTypeRows = await this.db
      .select({ type: schema.organization.type, count: sql<number>`count(*)::int` })
      .from(schema.organization)
      .groupBy(schema.organization.type);

    return { weeklySignupRows, byTypeRows };
  }

  /** Domain is globally unique (see `organization_domain` schema note) — used both to block
   * duplicate registrations with a clear `ORG_DOMAIN_ALREADY_REGISTERED` error and to power
   * the self-service "join this organization instead" flow. */
  async findOrganizationByDomain(domain: string) {
    const row = await this.db.query.organizationDomain.findFirst({
      where: eq(schema.organizationDomain.domain, domain),
      with: { organization: true },
    });
    return row?.organization;
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

  /** Mirrors `VerificationRepository.createDocument` — duplicated (not imported) to avoid
   * a circular module dependency: `VerificationModule` already imports `OrganizationsModule`. */
  async createVerificationDocument(
    input: {
      organizationVerificationRequestId: string;
      documentType: string;
      storageObjectKey: string;
      originalFilename: string;
      mimeType: string;
      sizeBytes: number;
      checksumSha256: string;
    },
    tx: Database,
  ) {
    const rows = await tx
      .insert(schema.verificationDocument)
      .values({
        organizationVerificationRequestId: input.organizationVerificationRequestId,
        documentType: input.documentType as never,
        storageObjectKey: input.storageObjectKey,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256,
      })
      .returning();
    return firstOrThrow(rows, "createVerificationDocument: insert returned no row");
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

  async findMemberWithUserById(organizationId: string, memberId: string) {
    return this.db.query.organizationMember.findFirst({
      where: and(
        eq(schema.organizationMember.id, memberId),
        eq(schema.organizationMember.organizationId, organizationId),
      ),
      with: { user: { with: { profile: true } } },
    });
  }

  async listMembers(organizationId: string) {
    return this.db.query.organizationMember.findMany({
      where: eq(schema.organizationMember.organizationId, organizationId),
      with: { user: { with: { profile: true } } },
    });
  }

  async listPendingMembershipsForUser(userId: string) {
    return this.db.query.organizationMember.findMany({
      where: and(
        eq(schema.organizationMember.userId, userId),
        eq(schema.organizationMember.status, "PENDING_APPROVAL"),
      ),
      with: { organization: true },
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
