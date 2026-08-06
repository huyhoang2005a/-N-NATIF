import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";

function firstOrThrow<T>(rows: T[], message: string): T {
  const row = rows[0];
  if (!row) throw new Error(message);
  return row;
}

@Injectable()
export class GapRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(values: typeof schema.gapRecord.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.gapRecord).values(values).returning();
    return firstOrThrow(rows, "create: insert returned no row");
  }

  async createEvidenceLinks(gapRecordId: string, evidenceIds: string[], tx: Database) {
    if (evidenceIds.length === 0) return;
    await tx.insert(schema.gapEvidence).values(evidenceIds.map((evidenceId) => ({ gapRecordId, evidenceId })));
  }

  async findById(id: string) {
    return this.db.query.gapRecord.findFirst({ where: eq(schema.gapRecord.id, id) });
  }

  async listByCase(technologyCaseId: string) {
    return this.db.query.gapRecord.findMany({
      where: eq(schema.gapRecord.technologyCaseId, technologyCaseId),
      orderBy: [desc(schema.gapRecord.createdAt)],
    });
  }

  /** Dùng để quyết định "đây có phải gap đầu tiên của case sau assessment không" —
   * transition case sang GAP_IDENTIFIED chỉ khi chưa từng có gap nào (breakdown mục 10).
   * Gọi TRƯỚC insert, trong cùng transaction (đúng tiền lệ
   * `EvidenceRepository.hasAnyEvidence`, Phase 3). */
  async hasAnyGap(technologyCaseId: string, tx: Database) {
    const row = await tx.query.gapRecord.findFirst({
      where: eq(schema.gapRecord.technologyCaseId, technologyCaseId),
    });
    return row !== undefined;
  }

  /** `idx_open_critical_gaps` — dùng cho gate `ROADMAP_HAS_UNRESOLVED_CRITICAL_GAPS`
   * (port `validate_roadmap_approval`, xem `roadmap.service.ts`). */
  async findOpenCriticalGaps(technologyCaseId: string) {
    return this.db.query.gapRecord.findMany({
      where: and(
        eq(schema.gapRecord.technologyCaseId, technologyCaseId),
        eq(schema.gapRecord.severity, "CRITICAL"),
      ),
      columns: { id: true, status: true },
    }).then((rows) => rows.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS"));
  }

  async update(id: string, expectedVersion: number, values: Partial<typeof schema.gapRecord.$inferInsert>, tx: Database) {
    const rows = await tx
      .update(schema.gapRecord)
      .set(values)
      .where(and(eq(schema.gapRecord.id, id), eq(schema.gapRecord.version, expectedVersion)))
      .returning();
    return rows[0];
  }
}
