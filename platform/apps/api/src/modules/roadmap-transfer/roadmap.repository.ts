import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";

function firstOrThrow<T>(rows: T[], message: string): T {
  const row = rows[0];
  if (!row) throw new Error(message);
  return row;
}

@Injectable()
export class RoadmapRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(values: typeof schema.roadmap.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.roadmap).values(values).returning();
    return firstOrThrow(rows, "create: insert returned no row");
  }

  async findById(id: string) {
    return this.db.query.roadmap.findFirst({ where: eq(schema.roadmap.id, id) });
  }

  async listByCase(technologyCaseId: string) {
    return this.db.query.roadmap.findMany({
      where: eq(schema.roadmap.technologyCaseId, technologyCaseId),
      orderBy: [desc(schema.roadmap.versionNo)],
    });
  }

  async findLatestVersionByCase(technologyCaseId: string) {
    return this.db.query.roadmap.findFirst({
      where: eq(schema.roadmap.technologyCaseId, technologyCaseId),
      orderBy: [desc(schema.roadmap.versionNo)],
    });
  }

  /** Gọi TRƯỚC insert, trong cùng transaction — quyết định case có chuyển
   * `ROADMAP_DRAFT` hay không (đúng tiền lệ `GapRepository.hasAnyGap`/
   * `EvidenceRepository.hasAnyEvidence`). */
  async hasAnyRoadmap(technologyCaseId: string, tx: Database) {
    const row = await tx.query.roadmap.findFirst({ where: eq(schema.roadmap.technologyCaseId, technologyCaseId) });
    return row !== undefined;
  }

  async updateStatus(
    id: string,
    expectedVersion: number,
    status: string,
    tx: Database,
    extra?: {
      submittedAt?: Date;
      submittedByUserId?: string;
      approvedAt?: Date;
      approvedByUserId?: string;
    },
  ) {
    const rows = await tx
      .update(schema.roadmap)
      .set({ status: status as never, ...extra })
      .where(and(eq(schema.roadmap.id, id), eq(schema.roadmap.version, expectedVersion)))
      .returning();
    return rows[0];
  }

  async createMilestone(values: typeof schema.roadmapMilestone.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.roadmapMilestone).values(values).returning();
    return firstOrThrow(rows, "createMilestone: insert returned no row");
  }

  async findMilestoneById(id: string) {
    return this.db.query.roadmapMilestone.findFirst({ where: eq(schema.roadmapMilestone.id, id) });
  }

  async listMilestonesByRoadmap(roadmapId: string) {
    return this.db.query.roadmapMilestone.findMany({
      where: eq(schema.roadmapMilestone.roadmapId, roadmapId),
      orderBy: [schema.roadmapMilestone.sortOrder],
    });
  }

  async countMilestonesByRoadmap(roadmapId: string) {
    const rows = await this.listMilestonesByRoadmap(roadmapId);
    return rows.length;
  }

  async createTask(values: typeof schema.roadmapTask.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.roadmapTask).values(values).returning();
    return firstOrThrow(rows, "createTask: insert returned no row");
  }

  /** Toàn bộ edge `milestone_dependency` hiện có của 1 roadmap — dùng cho cycle
   * detection (`domain/cycle-detection.ts`). `milestone_dependency` không có cột
   * `roadmap_id` trực tiếp nên lọc qua tập milestone id của roadmap trước. */
  async findDependencyEdgesByRoadmap(roadmapId: string) {
    const milestones = await this.listMilestonesByRoadmap(roadmapId);
    const milestoneIds = milestones.map((m) => m.id);
    if (milestoneIds.length === 0) return [];
    return this.db.query.milestoneDependency.findMany({
      where: inArray(schema.milestoneDependency.predecessorMilestoneId, milestoneIds),
    });
  }

  async createDependency(values: typeof schema.milestoneDependency.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.milestoneDependency).values(values).returning();
    return firstOrThrow(rows, "createDependency: insert returned no row");
  }

  async createMilestoneGapLink(values: typeof schema.milestoneGap.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.milestoneGap).values(values).returning();
    return firstOrThrow(rows, "createMilestoneGapLink: insert returned no row");
  }

  async createReview(values: typeof schema.roadmapReview.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.roadmapReview).values(values).returning();
    return firstOrThrow(rows, "createReview: insert returned no row");
  }
}
