import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";

@Injectable()
export class VotesRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** `.onConflictDoNothing()` — no target needed, only 1 of the 2 partial unique indexes
   * can ever apply per insert (exactly one of `resourceId`/`researchNeedId` is set) —
   * makes voting idempotent without a pre-check round trip. */
  async voteResource(voterUserId: string, resourceId: string): Promise<void> {
    await this.db.insert(schema.contentVote).values({ voterUserId, resourceId }).onConflictDoNothing();
  }

  async unvoteResource(voterUserId: string, resourceId: string): Promise<void> {
    await this.db
      .delete(schema.contentVote)
      .where(and(eq(schema.contentVote.voterUserId, voterUserId), eq(schema.contentVote.resourceId, resourceId)));
  }

  async voteResearchNeed(voterUserId: string, researchNeedId: string): Promise<void> {
    await this.db.insert(schema.contentVote).values({ voterUserId, researchNeedId }).onConflictDoNothing();
  }

  async unvoteResearchNeed(voterUserId: string, researchNeedId: string): Promise<void> {
    await this.db
      .delete(schema.contentVote)
      .where(and(eq(schema.contentVote.voterUserId, voterUserId), eq(schema.contentVote.researchNeedId, researchNeedId)));
  }

  /** Batched — used when decorating a list response (avoids N+1 for e.g. 50 resource
   * cards). Returns 0 for ids with no votes (not present in the map). */
  /** Đợt 5 (Cộng đồng) — "tổng upvote nhận được" cho public profile tác giả: 1 tổng qua
   * SQL, không lấy `countVotesForResources` (per-resource map) rồi cộng trong JS. */
  async sumVotesForResources(resourceIds: string[]): Promise<number> {
    if (resourceIds.length === 0) return 0;
    const [row] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.contentVote)
      .where(inArray(schema.contentVote.resourceId, resourceIds));
    return row?.total ?? 0;
  }

  async countVotesForResources(resourceIds: string[]): Promise<Map<string, number>> {
    if (resourceIds.length === 0) return new Map();
    const rows = await this.db
      .select({ resourceId: schema.contentVote.resourceId, count: sql<number>`count(*)::int` })
      .from(schema.contentVote)
      .where(inArray(schema.contentVote.resourceId, resourceIds))
      .groupBy(schema.contentVote.resourceId);
    return new Map(rows.map((r) => [r.resourceId as string, r.count]));
  }

  async countVotesForResearchNeeds(researchNeedIds: string[]): Promise<Map<string, number>> {
    if (researchNeedIds.length === 0) return new Map();
    const rows = await this.db
      .select({ researchNeedId: schema.contentVote.researchNeedId, count: sql<number>`count(*)::int` })
      .from(schema.contentVote)
      .where(inArray(schema.contentVote.researchNeedId, researchNeedIds))
      .groupBy(schema.contentVote.researchNeedId);
    return new Map(rows.map((r) => [r.researchNeedId as string, r.count]));
  }

  async votedResourceIds(voterUserId: string, resourceIds: string[]): Promise<Set<string>> {
    if (resourceIds.length === 0) return new Set();
    const rows = await this.db
      .select({ resourceId: schema.contentVote.resourceId })
      .from(schema.contentVote)
      .where(and(eq(schema.contentVote.voterUserId, voterUserId), inArray(schema.contentVote.resourceId, resourceIds)));
    return new Set(rows.map((r) => r.resourceId as string));
  }

  async votedResearchNeedIds(voterUserId: string, researchNeedIds: string[]): Promise<Set<string>> {
    if (researchNeedIds.length === 0) return new Set();
    const rows = await this.db
      .select({ researchNeedId: schema.contentVote.researchNeedId })
      .from(schema.contentVote)
      .where(
        and(eq(schema.contentVote.voterUserId, voterUserId), inArray(schema.contentVote.researchNeedId, researchNeedIds)),
      );
    return new Set(rows.map((r) => r.researchNeedId as string));
  }
}
