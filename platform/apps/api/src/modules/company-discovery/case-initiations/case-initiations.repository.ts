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

  /** Resource-sourced `create()`/`accept()` path (2026-08-19) — the version + its
   * resource, no recommendation run involved. Mirrors `findItemForInitiation`'s shape
   * (resource reachable via a `with`) so both source branches load what they need the
   * same way. */
  async findResourceVersionWithResource(resourceVersionId: string) {
    return this.db.query.resourceVersion.findFirst({
      where: eq(schema.resourceVersion.id, resourceVersionId),
      with: { resource: true },
    });
  }

  async createRequest(values: typeof schema.caseInitiationRequest.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.caseInitiationRequest).values(values).returning();
    return firstOrThrow(rows, "createRequest: insert returned no row");
  }

  /** `with` on both possible sources so `toResponse` can resolve `resourceTitle`
   * regardless of which one is set (2026-08-19) — exactly one is ever non-null. */
  private readonly withResourceTitle = {
    recommendationItem: { with: { resourceVersion: { with: { resource: true } } } },
    resourceVersion: { with: { resource: true } },
  } as const;

  async findById(id: string) {
    return this.db.query.caseInitiationRequest.findFirst({
      where: eq(schema.caseInitiationRequest.id, id),
      with: this.withResourceTitle,
    });
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
      with: this.withResourceTitle,
    });
  }

  async listForOrganization(requestingOrganizationId: string) {
    return this.db.query.caseInitiationRequest.findMany({
      where: eq(schema.caseInitiationRequest.requestingOrganizationId, requestingOrganizationId),
      orderBy: [desc(schema.caseInitiationRequest.createdAt)],
      with: this.withResourceTitle,
    });
  }
}
