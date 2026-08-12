import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";

function firstOrThrow<T>(rows: T[], message: string): T {
  const row = rows[0];
  if (!row) throw new Error(message);
  return row;
}

@Injectable()
export class TechnologyCaseRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(values: typeof schema.technologyCase.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.technologyCase).values(values).returning();
    return firstOrThrow(rows, "create: insert returned no row");
  }

  async createOrigin(values: typeof schema.caseOrigin.$inferInsert, tx: Database) {
    await tx.insert(schema.caseOrigin).values(values);
  }

  async createProfile(values: typeof schema.technologyProfile.$inferInsert, tx: Database) {
    await tx.insert(schema.technologyProfile).values(values);
  }

  async createOrganization(values: typeof schema.caseOrganization.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.caseOrganization).values(values).returning();
    return firstOrThrow(rows, "createOrganization: insert returned no row");
  }

  async createMember(values: typeof schema.caseMember.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.caseMember).values(values).returning();
    return firstOrThrow(rows, "createMember: insert returned no row");
  }

  async insertStatusHistory(values: typeof schema.caseStatusHistory.$inferInsert, tx: Database) {
    await tx.insert(schema.caseStatusHistory).values(values);
  }

  async updateStatus(id: string, expectedVersion: number, status: string, tx: Database) {
    const rows = await tx
      .update(schema.technologyCase)
      .set({ lifecycleStatus: status as never })
      .where(and(eq(schema.technologyCase.id, id), eq(schema.technologyCase.version, expectedVersion)))
      .returning();
    return rows[0];
  }

  async findById(id: string) {
    return this.db.query.technologyCase.findFirst({ where: eq(schema.technologyCase.id, id) });
  }

  async findBySlugInOrganization(owningOrganizationId: string, slug: string) {
    return this.db.query.technologyCase.findFirst({
      where: and(
        eq(schema.technologyCase.owningOrganizationId, owningOrganizationId),
        eq(schema.technologyCase.slug, slug),
      ),
    });
  }

  /** Not spec-mandated — explicit user-approved addition for the admin dashboard's
   * "Case đang xử lý" stat tile (was a `SoonStatTile` left over from before any
   * platform-wide read existed). Counts only, no row fetch — matches CLAUDE.md rule 5's
   * "dashboard is a read model, query it directly" guidance rather than fetching+mapping
   * every case just to `.length` them. `active` = not ARCHIVED (the only terminal status). */
  async countAllForPlatform() {
    const [totalRow] = await this.db.select({ count: sql<number>`count(*)::int` }).from(schema.technologyCase);
    const [activeRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.technologyCase)
      .where(ne(schema.technologyCase.lifecycleStatus, "ARCHIVED"));
    return { total: totalRow?.count ?? 0, active: activeRow?.count ?? 0 };
  }

  /** Actor sees a case if they are an active `case_member`, or belong (as an active org
   * member) to an organization linked via `case_organization` — covers the owning
   * organization too, since registering a case always creates an
   * `OWNING_ORGANIZATION` row. */
  async listVisible(input: { actorUserId: string; actorOrgIds: string[] }) {
    const { actorUserId, actorOrgIds } = input;

    const memberships = await this.db.query.caseMember.findMany({
      where: and(eq(schema.caseMember.userId, actorUserId), eq(schema.caseMember.status, "ACTIVE")),
    });
    const orgLinks =
      actorOrgIds.length > 0
        ? await this.db.query.caseOrganization.findMany({
            where: inArray(schema.caseOrganization.organizationId, actorOrgIds),
          })
        : [];

    const visibleIds = [
      ...new Set([
        ...memberships.map((m) => m.technologyCaseId),
        ...orgLinks.map((o) => o.technologyCaseId),
      ]),
    ];
    if (visibleIds.length === 0) return [];

    return this.db.query.technologyCase.findMany({
      where: inArray(schema.technologyCase.id, visibleIds),
    });
  }

  async listMembers(technologyCaseId: string) {
    return this.db.query.caseMember.findMany({
      where: eq(schema.caseMember.technologyCaseId, technologyCaseId),
      orderBy: [schema.caseMember.createdAt],
    });
  }

  async listOrganizations(technologyCaseId: string) {
    return this.db.query.caseOrganization.findMany({
      where: eq(schema.caseOrganization.technologyCaseId, technologyCaseId),
      orderBy: [schema.caseOrganization.joinedAt],
    });
  }

  async findActiveOwner(technologyCaseId: string) {
    return this.db.query.caseMember.findFirst({
      where: and(
        eq(schema.caseMember.technologyCaseId, technologyCaseId),
        eq(schema.caseMember.role, "OWNER"),
        eq(schema.caseMember.status, "ACTIVE"),
      ),
    });
  }

  async findActiveMembership(technologyCaseId: string, userId: string) {
    return this.db.query.caseMember.findFirst({
      where: and(
        eq(schema.caseMember.technologyCaseId, technologyCaseId),
        eq(schema.caseMember.userId, userId),
        eq(schema.caseMember.status, "ACTIVE"),
      ),
    });
  }

  async findExistingMember(technologyCaseId: string, userId: string) {
    return this.db.query.caseMember.findFirst({
      where: and(eq(schema.caseMember.technologyCaseId, technologyCaseId), eq(schema.caseMember.userId, userId)),
    });
  }

  async hasOrganizationRole(technologyCaseId: string, organizationId: string, role: string) {
    const row = await this.db.query.caseOrganization.findFirst({
      where: and(
        eq(schema.caseOrganization.technologyCaseId, technologyCaseId),
        eq(schema.caseOrganization.organizationId, organizationId),
        eq(schema.caseOrganization.role, role as never),
        isNull(schema.caseOrganization.leftAt),
      ),
    });
    return row !== undefined;
  }

  async hasOrganizationLink(technologyCaseId: string, organizationIds: string[]) {
    if (organizationIds.length === 0) return false;
    const row = await this.db.query.caseOrganization.findFirst({
      where: and(
        eq(schema.caseOrganization.technologyCaseId, technologyCaseId),
        inArray(schema.caseOrganization.organizationId, organizationIds),
      ),
    });
    return row !== undefined;
  }

  async isActiveOrgMember(userId: string, organizationId: string) {
    const row = await this.db.query.organizationMember.findFirst({
      where: and(
        eq(schema.organizationMember.userId, userId),
        eq(schema.organizationMember.organizationId, organizationId),
        eq(schema.organizationMember.status, "ACTIVE"),
      ),
    });
    return row !== undefined;
  }
}
