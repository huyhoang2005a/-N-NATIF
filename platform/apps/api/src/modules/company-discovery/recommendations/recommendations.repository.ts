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
export class RecommendationsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async createRun(values: typeof schema.recommendationRun.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.recommendationRun).values(values).returning();
    return firstOrThrow(rows, "createRun: insert returned no row");
  }

  async findRunById(id: string) {
    return this.db.query.recommendationRun.findFirst({ where: eq(schema.recommendationRun.id, id) });
  }

  /** Backs the `DISCOVERY_RUN_ALREADY_IN_PROGRESS` guard — mirrors the DB-level partial
   * unique index `uq_one_active_focused_run_per_need`, gives a clean error before hitting
   * that constraint. */
  async findActiveFocusedRunForNeed(researchNeedId: string) {
    return this.db.query.recommendationRun.findFirst({
      where: and(
        eq(schema.recommendationRun.researchNeedId, researchNeedId),
        inArray(schema.recommendationRun.status, ["QUEUED", "RUNNING"]),
      ),
    });
  }

  async listActiveItemsByRun(recommendationRunId: string) {
    return this.db.query.recommendationItem.findMany({
      where: and(eq(schema.recommendationItem.recommendationRunId, recommendationRunId), eq(schema.recommendationItem.status, "ACTIVE")),
      orderBy: (item, { asc }) => [asc(item.rank)],
      with: {
        citations: { with: { citation: true } },
        resourceVersion: { with: { resource: { with: { paperMetadata: true } } } },
      },
    });
  }

  /** Mirrors `findActiveFocusedRunForNeed` for the FEED side of `DISCOVERY_RUN_ALREADY_IN_
   * PROGRESS`, backed by `uq_one_active_feed_run_per_company`. */
  async findActiveFeedRunForOrg(companyOrganizationId: string) {
    return this.db.query.recommendationRun.findFirst({
      where: and(
        eq(schema.recommendationRun.companyOrganizationId, companyOrganizationId),
        inArray(schema.recommendationRun.status, ["QUEUED", "RUNNING"]),
      ),
    });
  }

  async findLatestCompletedFeedRun(companyOrganizationId: string) {
    return this.db.query.recommendationRun.findFirst({
      where: and(
        eq(schema.recommendationRun.companyOrganizationId, companyOrganizationId),
        eq(schema.recommendationRun.runType, "FEED"),
        eq(schema.recommendationRun.status, "COMPLETED"),
      ),
      orderBy: [desc(schema.recommendationRun.createdAt)],
    });
  }

  async findItemWithRunById(id: string) {
    return this.db.query.recommendationItem.findFirst({
      where: eq(schema.recommendationItem.id, id),
      with: {
        recommendationRun: true,
        citations: { with: { citation: true } },
        resourceVersion: { with: { resource: { with: { paperMetadata: true } } } },
      },
    });
  }

  /** No optimistic-lock column on `recommendation_item` (see schema) — `status='ACTIVE'`
   * in the WHERE clause is the only guard; dismissing an already-`DISMISSED` item is
   * treated as idempotent by the caller (checks `findItemWithRunById` first), not raced
   * against here. */
  async dismissItem(id: string) {
    const rows = await this.db
      .update(schema.recommendationItem)
      .set({ status: "DISMISSED" })
      .where(and(eq(schema.recommendationItem.id, id), eq(schema.recommendationItem.status, "ACTIVE")))
      .returning();
    return rows[0];
  }
}
