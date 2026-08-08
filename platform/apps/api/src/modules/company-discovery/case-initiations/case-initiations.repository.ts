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
export class CaseInitiationsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Item + the underlying resource (for `targetAuthorUserId`/`targetOrganizationId`) +
   * its citations (reused as case evidence on accept — no new citation is ever created
   * here). */
  async findItemForInitiation(recommendationItemId: string) {
    return this.db.query.recommendationItem.findFirst({
      where: eq(schema.recommendationItem.id, recommendationItemId),
      with: {
        recommendationRun: true,
        resourceVersion: { with: { resource: true } },
        citations: { with: { citation: true } },
      },
    });
  }

  async createRequest(values: typeof schema.caseInitiationRequest.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.caseInitiationRequest).values(values).returning();
    return firstOrThrow(rows, "createRequest: insert returned no row");
  }

  async findById(id: string) {
    return this.db.query.caseInitiationRequest.findFirst({ where: eq(schema.caseInitiationRequest.id, id) });
  }

  /** Optimistic lock — mirrors `ProposalsRepository.update`. */
  async update(id: string, expectedVersion: number, values: Partial<typeof schema.caseInitiationRequest.$inferInsert>, tx: Database) {
    const rows = await tx
      .update(schema.caseInitiationRequest)
      .set(values)
      .where(and(eq(schema.caseInitiationRequest.id, id), eq(schema.caseInitiationRequest.version, expectedVersion)))
      .returning();
    return rows[0];
  }

  async listForAuthor(targetAuthorUserId: string) {
    return this.db.query.caseInitiationRequest.findMany({
      where: eq(schema.caseInitiationRequest.targetAuthorUserId, targetAuthorUserId),
      orderBy: [desc(schema.caseInitiationRequest.createdAt)],
    });
  }

  async listForOrganization(requestingOrganizationId: string) {
    return this.db.query.caseInitiationRequest.findMany({
      where: eq(schema.caseInitiationRequest.requestingOrganizationId, requestingOrganizationId),
      orderBy: [desc(schema.caseInitiationRequest.createdAt)],
    });
  }
}
