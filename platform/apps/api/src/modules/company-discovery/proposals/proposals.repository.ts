import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
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
