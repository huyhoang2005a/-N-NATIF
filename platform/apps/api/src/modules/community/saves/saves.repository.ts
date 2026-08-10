import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";

@Injectable()
export class SavesRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** `.onConflictDoNothing()` — same idempotent-insert pattern as `VotesRepository`, see
   * that file's comment: only 1 of the 2 partial unique indexes can ever apply per insert. */
  async saveResource(saverUserId: string, resourceId: string): Promise<void> {
    await this.db.insert(schema.contentSave).values({ saverUserId, resourceId }).onConflictDoNothing();
  }

  async unsaveResource(saverUserId: string, resourceId: string): Promise<void> {
    await this.db
      .delete(schema.contentSave)
      .where(and(eq(schema.contentSave.saverUserId, saverUserId), eq(schema.contentSave.resourceId, resourceId)));
  }

  async saveResearchNeed(saverUserId: string, researchNeedId: string): Promise<void> {
    await this.db.insert(schema.contentSave).values({ saverUserId, researchNeedId }).onConflictDoNothing();
  }

  async unsaveResearchNeed(saverUserId: string, researchNeedId: string): Promise<void> {
    await this.db
      .delete(schema.contentSave)
      .where(and(eq(schema.contentSave.saverUserId, saverUserId), eq(schema.contentSave.researchNeedId, researchNeedId)));
  }

  async savedResourceIds(saverUserId: string, resourceIds: string[]): Promise<Set<string>> {
    if (resourceIds.length === 0) return new Set();
    const rows = await this.db
      .select({ resourceId: schema.contentSave.resourceId })
      .from(schema.contentSave)
      .where(and(eq(schema.contentSave.saverUserId, saverUserId), inArray(schema.contentSave.resourceId, resourceIds)));
    return new Set(rows.map((r) => r.resourceId as string));
  }

  async savedResearchNeedIds(saverUserId: string, researchNeedIds: string[]): Promise<Set<string>> {
    if (researchNeedIds.length === 0) return new Set();
    const rows = await this.db
      .select({ researchNeedId: schema.contentSave.researchNeedId })
      .from(schema.contentSave)
      .where(
        and(eq(schema.contentSave.saverUserId, saverUserId), inArray(schema.contentSave.researchNeedId, researchNeedIds)),
      );
    return new Set(rows.map((r) => r.researchNeedId as string));
  }

  /** For `GET /me/saved` — every resource this user has ever saved, newest save first. No
   * cap: a personal bookmark list, not a public discovery feed, so the same "hardcoded
   * limit 50" concern that applies to `GET /resources` doesn't apply here. */
  async listSavedResourceIds(saverUserId: string): Promise<{ resourceId: string; savedAt: Date }[]> {
    const rows = await this.db
      .select({ resourceId: schema.contentSave.resourceId, savedAt: schema.contentSave.createdAt })
      .from(schema.contentSave)
      .where(and(eq(schema.contentSave.saverUserId, saverUserId), sql`${schema.contentSave.resourceId} IS NOT NULL`))
      .orderBy(desc(schema.contentSave.createdAt));
    return rows.map((r) => ({ resourceId: r.resourceId as string, savedAt: r.savedAt }));
  }

  async listSavedResearchNeedIds(saverUserId: string): Promise<{ researchNeedId: string; savedAt: Date }[]> {
    const rows = await this.db
      .select({ researchNeedId: schema.contentSave.researchNeedId, savedAt: schema.contentSave.createdAt })
      .from(schema.contentSave)
      .where(and(eq(schema.contentSave.saverUserId, saverUserId), sql`${schema.contentSave.researchNeedId} IS NOT NULL`))
      .orderBy(desc(schema.contentSave.createdAt));
    return rows.map((r) => ({ researchNeedId: r.researchNeedId as string, savedAt: r.savedAt }));
  }
}
