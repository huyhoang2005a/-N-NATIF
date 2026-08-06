import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, ne } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";

function firstOrThrow<T>(rows: T[], message: string): T {
  const row = rows[0];
  if (!row) throw new Error(message);
  return row;
}

@Injectable()
export class AssessmentRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(values: typeof schema.readinessAssessment.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.readinessAssessment).values(values).returning();
    return firstOrThrow(rows, "create: insert returned no row");
  }

  async findById(id: string) {
    return this.db.query.readinessAssessment.findFirst({ where: eq(schema.readinessAssessment.id, id) });
  }

  async listByCase(technologyCaseId: string) {
    return this.db.query.readinessAssessment.findMany({
      where: eq(schema.readinessAssessment.technologyCaseId, technologyCaseId),
      orderBy: [desc(schema.readinessAssessment.createdAt)],
    });
  }

  /** Dùng để supersede assessment `APPROVED` cũ khi có assessment mới được approve cho
   * cùng case (mirror `ResourcesRepository.findPublishedVersionByResource`, Phase 2). */
  async findApprovedByCase(technologyCaseId: string, excludeId: string) {
    return this.db.query.readinessAssessment.findFirst({
      where: and(
        eq(schema.readinessAssessment.technologyCaseId, technologyCaseId),
        eq(schema.readinessAssessment.status, "APPROVED"),
        ne(schema.readinessAssessment.id, excludeId),
      ),
    });
  }

  async updateStatus(
    id: string,
    expectedVersion: number,
    status: string,
    tx: Database,
    extra?: {
      compositeScore?: string;
      submittedAt?: Date;
      submittedByUserId?: string;
      approvedAt?: Date;
      approvedByUserId?: string;
    },
  ) {
    const rows = await tx
      .update(schema.readinessAssessment)
      .set({ status: status as never, ...extra })
      .where(
        and(eq(schema.readinessAssessment.id, id), eq(schema.readinessAssessment.version, expectedVersion)),
      )
      .returning();
    return rows[0];
  }

  /** `score` + link evidence/citation trong 1 lần gọi PUT (thay hết bộ link cũ — đúng
   * ngữ nghĩa PUT của `/assessments/:id/scores/:criterionId`, không phải PATCH cộng
   * dồn). */
  async upsertScore(
    values: typeof schema.assessmentScore.$inferInsert,
    tx: Database,
  ): Promise<typeof schema.assessmentScore.$inferSelect> {
    const rows = await tx
      .insert(schema.assessmentScore)
      .values(values)
      .onConflictDoUpdate({
        target: [schema.assessmentScore.assessmentId, schema.assessmentScore.criterionId],
        set: {
          score: values.score,
          rationale: values.rationale,
          updatedByUserId: values.updatedByUserId,
          updatedAt: new Date(),
        },
      })
      .returning();
    return firstOrThrow(rows, "upsertScore: insert/update returned no row");
  }

  async replaceScoreEvidenceLinks(assessmentScoreId: string, evidenceIds: string[], tx: Database) {
    await tx.delete(schema.assessmentScoreEvidence).where(
      eq(schema.assessmentScoreEvidence.assessmentScoreId, assessmentScoreId),
    );
    if (evidenceIds.length === 0) return;
    await tx
      .insert(schema.assessmentScoreEvidence)
      .values(evidenceIds.map((evidenceId) => ({ assessmentScoreId, evidenceId })));
  }

  async replaceScoreCitationLinks(assessmentScoreId: string, citationIds: string[], tx: Database) {
    await tx.delete(schema.assessmentScoreCitation).where(
      eq(schema.assessmentScoreCitation.assessmentScoreId, assessmentScoreId),
    );
    if (citationIds.length === 0) return;
    await tx
      .insert(schema.assessmentScoreCitation)
      .values(citationIds.map((citationId) => ({ assessmentScoreId, citationId })));
  }

  /** Join score + criterion (min/max/weight/requires*) — dùng cho cả completeness check
   * (submit) lẫn tính composite score. */
  async findScoresWithCriteriaByAssessment(assessmentId: string) {
    const scores = await this.db.query.assessmentScore.findMany({
      where: eq(schema.assessmentScore.assessmentId, assessmentId),
      with: { criterion: true, evidenceLinks: true, citationLinks: true },
    });
    return scores;
  }
}
