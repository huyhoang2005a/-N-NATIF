import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";

function firstOrThrow<T>(rows: T[], message: string): T {
  const row = rows[0];
  if (!row) throw new Error(message);
  return row;
}

@Injectable()
export class EvidenceRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async createCitation(values: typeof schema.citation.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.citation).values(values).returning();
    return firstOrThrow(rows, "createCitation: insert returned no row");
  }

  async createEvidence(values: typeof schema.evidence.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.evidence).values(values).returning();
    return firstOrThrow(rows, "createEvidence: insert returned no row");
  }

  async createEvidenceCitation(values: typeof schema.evidenceCitation.$inferInsert, tx: Database) {
    await tx.insert(schema.evidenceCitation).values(values);
  }

  async findById(id: string) {
    return this.db.query.evidence.findFirst({ where: eq(schema.evidence.id, id) });
  }

  /** Called BEFORE inserting the new evidence row, inside the same transaction, to
   * decide whether this is the case's first evidence (triggers the automatic
   * DRAFT→EVIDENCE_COLLECTION transition — breakdown Sprint 3.3 item 15). */
  async hasAnyEvidence(technologyCaseId: string, tx: Database) {
    const row = await tx.query.evidence.findFirst({
      where: eq(schema.evidence.technologyCaseId, technologyCaseId),
    });
    return row !== undefined;
  }
}
