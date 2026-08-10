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
export class ModerationRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async create(values: typeof schema.contentFlag.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.contentFlag).values(values).returning();
    return firstOrThrow(rows, "create: insert returned no row");
  }

  async findById(id: string) {
    return this.db.query.contentFlag.findFirst({ where: eq(schema.contentFlag.id, id) });
  }

  /** Hàng chờ duyệt — PENDING (chưa ai nhận) + IN_REVIEW (đang xử lý), mới nhất trước. */
  async listQueue() {
    return this.db.query.contentFlag.findMany({
      where: inArray(schema.contentFlag.status, ["PENDING", "IN_REVIEW"]),
      orderBy: [desc(schema.contentFlag.createdAt)],
    });
  }

  /** Optimistic-lock-qua-status (không có cột `version`) — cùng pattern
   * `sweepExpiredCaseInitiationRequests`: WHERE status='PENDING' trong update, 0 dòng
   * nghĩa là đã có reviewer khác claim trước. */
  async claim(id: string, reviewerUserId: string, tx: Database) {
    const rows = await tx
      .update(schema.contentFlag)
      .set({ status: "IN_REVIEW", assignedReviewerUserId: reviewerUserId })
      .where(and(eq(schema.contentFlag.id, id), eq(schema.contentFlag.status, "PENDING")))
      .returning();
    return rows[0];
  }

  /** Đóng flag sau quyết định — WHERE status='IN_REVIEW' AND assigned_reviewer_user_id
   * = reviewer, chặn 2 reviewer cùng quyết định 1 flag (chỉ người đã claim mới đóng
   * được). */
  async close(id: string, reviewerUserId: string, values: { status: string; closedAt: Date; hiddenAt?: Date }, tx: Database) {
    const rows = await tx
      .update(schema.contentFlag)
      .set(values as never)
      .where(
        and(
          eq(schema.contentFlag.id, id),
          eq(schema.contentFlag.status, "IN_REVIEW"),
          eq(schema.contentFlag.assignedReviewerUserId, reviewerUserId),
        ),
      )
      .returning();
    return rows[0];
  }

  async createDecision(values: typeof schema.moderationDecision.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.moderationDecision).values(values).returning();
    return firstOrThrow(rows, "createDecision: insert returned no row");
  }

  // ---------- target existence + moderation status (đọc/ghi thẳng schema, không qua
  // service module khác — chỉ lookup/update 1 cột đơn giản, đúng tiền lệ
  // `PublicProfilesRepository` đọc thẳng `schema.resource`) ----------

  async findResourceById(id: string) {
    return this.db.query.resource.findFirst({ where: eq(schema.resource.id, id) });
  }

  async findAnnotationById(id: string) {
    return this.db.query.annotation.findFirst({ where: eq(schema.annotation.id, id) });
  }

  async findTechnologyProfileById(id: string) {
    return this.db.query.technologyProfile.findFirst({ where: eq(schema.technologyProfile.id, id) });
  }

  async updateResourceModerationStatus(id: string, moderationStatus: string, tx: Database) {
    await tx.update(schema.resource).set({ moderationStatus: moderationStatus as never }).where(eq(schema.resource.id, id));
  }

  async updateAnnotationModerationStatus(id: string, moderationStatus: string, tx: Database) {
    await tx.update(schema.annotation).set({ moderationStatus: moderationStatus as never }).where(eq(schema.annotation.id, id));
  }

  async updateTechnologyProfileModerationStatus(id: string, moderationStatus: string, tx: Database) {
    await tx
      .update(schema.technologyProfile)
      .set({ moderationStatus: moderationStatus as never })
      .where(eq(schema.technologyProfile.id, id));
  }
}
