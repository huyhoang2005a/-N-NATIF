import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";

function firstOrThrow<T>(rows: T[], message: string): T {
  const row = rows[0];
  if (!row) throw new Error(message);
  return row;
}

@Injectable()
export class ProposalsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(values: typeof schema.researchProposal.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.researchProposal).values(values).returning();
    return firstOrThrow(rows, "create: insert returned no row");
  }

  async findById(id: string) {
    return this.db.query.researchProposal.findFirst({ where: eq(schema.researchProposal.id, id) });
  }

  async listByNeed(researchNeedId: string) {
    return this.db.query.researchProposal.findMany({
      where: eq(schema.researchProposal.researchNeedId, researchNeedId),
      orderBy: [desc(schema.researchProposal.createdAt)],
    });
  }

  async listByAuthor(proposerAuthorUserId: string) {
    return this.db.query.researchProposal.findMany({
      where: eq(schema.researchProposal.proposerAuthorUserId, proposerAuthorUserId),
      orderBy: [desc(schema.researchProposal.createdAt)],
    });
  }

  /** Đợt 5 (Cộng đồng) — điểm ghi nhận tác giả trên public profile: đếm đề xuất đã được
   * chấp nhận, không kéo cả list về rồi filter/count trong JS. */
  async countAcceptedByAuthor(proposerAuthorUserId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.researchProposal)
      .where(and(eq(schema.researchProposal.proposerAuthorUserId, proposerAuthorUserId), eq(schema.researchProposal.status, "ACCEPTED")));
    return row?.count ?? 0;
  }

  /** Optimistic lock — mirrors `GapRepository.update`/`ResearchNeedsRepository.update`:
   * `updated_at`/`version` bumped by the `set_updated_at_and_version()` DB trigger. */
  async update(id: string, expectedVersion: number, values: Partial<typeof schema.researchProposal.$inferInsert>, tx: Database) {
    const rows = await tx
      .update(schema.researchProposal)
      .set(values)
      .where(and(eq(schema.researchProposal.id, id), eq(schema.researchProposal.version, expectedVersion)))
      .returning();
    return rows[0];
  }
}
