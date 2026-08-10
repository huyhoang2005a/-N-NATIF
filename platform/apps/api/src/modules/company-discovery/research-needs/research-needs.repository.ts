import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";

function firstOrThrow<T>(rows: T[], message: string): T {
  const row = rows[0];
  if (!row) throw new Error(message);
  return row;
}

@Injectable()
export class ResearchNeedsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async createNeed(values: typeof schema.researchNeed.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.researchNeed).values(values).returning();
    return firstOrThrow(rows, "createNeed: insert returned no row");
  }

  async createVersion(values: typeof schema.needStatementVersion.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.needStatementVersion).values(values).returning();
    return firstOrThrow(rows, "createVersion: insert returned no row");
  }

  async findById(id: string) {
    return this.db.query.researchNeed.findFirst({ where: eq(schema.researchNeed.id, id) });
  }

  async findLatestVersion(researchNeedId: string) {
    return this.db.query.needStatementVersion.findFirst({
      where: eq(schema.needStatementVersion.researchNeedId, researchNeedId),
      orderBy: [desc(schema.needStatementVersion.versionNo)],
    });
  }

  async listVersions(researchNeedId: string) {
    return this.db.query.needStatementVersion.findMany({
      where: eq(schema.needStatementVersion.researchNeedId, researchNeedId),
      orderBy: [desc(schema.needStatementVersion.versionNo)],
    });
  }

  /** Company managing its own needs — any status/visibility, guarded by
   * `assertActiveMember` at the service layer. */
  async listByOrganization(companyOrganizationId: string) {
    return this.db.query.researchNeed.findMany({
      where: eq(schema.researchNeed.companyOrganizationId, companyOrganizationId),
      orderBy: [desc(schema.researchNeed.createdAt)],
    });
  }

  /** UC-DIS-01 acceptance criteria: "Public listing chỉ trả OPEN + PUBLIC." Đợt 7 (Cộng
   * đồng — duyệt theo lĩnh vực): `technicalField` lives on `need_statement_version`, not
   * `research_need` itself, so filtering/grouping by it needs each need's LATEST version
   * joined in — `with: { statementVersions: { limit: 1, orderBy: versionNo desc } }`
   * embeds exactly that per need, no N+1. `field` filters in-memory over that small
   * already-fetched set (same "no real pagination yet" trade-off as `sort=top|hot`, not a
   * new one). */
  async listPublicOpen(field?: string) {
    const needs = await this.db.query.researchNeed.findMany({
      where: and(eq(schema.researchNeed.status, "OPEN"), eq(schema.researchNeed.visibility, "PUBLIC")),
      orderBy: [desc(schema.researchNeed.publishedAt)],
      with: {
        statementVersions: {
          orderBy: [desc(schema.needStatementVersion.versionNo)],
          limit: 1,
        },
      },
    });
    if (!field) return needs;
    return needs.filter((need) => need.statementVersions[0]?.technicalField === field);
  }

  /** Đợt 7 — distinct technical fields among OPEN+PUBLIC needs, with how many needs
   * currently sit under each (grouped by each need's latest version, same join as
   * `listPublicOpen` above). Sorted by count desc so the most active fields lead. */
  async listTechnicalFieldCounts(): Promise<{ field: string; count: number }[]> {
    const needs = await this.listPublicOpen();
    const counts = new Map<string, number>();
    for (const need of needs) {
      const field = need.statementVersions[0]?.technicalField;
      if (!field) continue;
      counts.set(field, (counts.get(field) ?? 0) + 1);
    }
    return [...counts.entries()].map(([field, count]) => ({ field, count })).sort((a, b) => b.count - a.count);
  }

  /** Đợt 4 (activity feed) — needs from followed organizations only (no individual
   * "author" concept for a research need). */
  async listRecentPublicOpenForOrganizations(organizationIds: string[], limit: number) {
    if (organizationIds.length === 0) return [];
    return this.db.query.researchNeed.findMany({
      where: and(
        eq(schema.researchNeed.status, "OPEN"),
        eq(schema.researchNeed.visibility, "PUBLIC"),
        inArray(schema.researchNeed.companyOrganizationId, organizationIds),
      ),
      orderBy: [desc(schema.researchNeed.publishedAt)],
      limit,
    });
  }

  /** Optimistic lock — mirrors `GapRepository.update`: WHERE id+version, `updated_at`/
   * `version` bumped by the `set_updated_at_and_version()` DB trigger, not here. */
  async update(id: string, expectedVersion: number, values: Partial<typeof schema.researchNeed.$inferInsert>, tx: Database) {
    const rows = await tx
      .update(schema.researchNeed)
      .set(values)
      .where(and(eq(schema.researchNeed.id, id), eq(schema.researchNeed.version, expectedVersion)))
      .returning();
    return rows[0];
  }
}
