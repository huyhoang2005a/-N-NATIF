import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";

@Injectable()
export class VerificationRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findById(id: string) {
    return this.db.query.organizationVerificationRequest.findFirst({
      where: eq(schema.organizationVerificationRequest.id, id),
    });
  }

  async listPending() {
    return this.db.query.organizationVerificationRequest.findMany({
      where: inArray(schema.organizationVerificationRequest.status, ["PENDING", "IN_REVIEW"]),
      orderBy: [asc(schema.organizationVerificationRequest.submittedAt)],
    });
  }

  async hasOpenRequest(organizationId: string) {
    const existing = await this.db.query.organizationVerificationRequest.findFirst({
      where: and(
        eq(schema.organizationVerificationRequest.organizationId, organizationId),
        inArray(schema.organizationVerificationRequest.status, ["PENDING", "IN_REVIEW"]),
      ),
    });
    return existing !== undefined;
  }

  /** Optimistic claim: only succeeds if the request is still PENDING (first reviewer wins). */
  async claim(id: string, reviewerUserId: string) {
    const rows = await this.db
      .update(schema.organizationVerificationRequest)
      .set({ status: "IN_REVIEW", reviewerUserId })
      .where(
        and(
          eq(schema.organizationVerificationRequest.id, id),
          eq(schema.organizationVerificationRequest.status, "PENDING"),
        ),
      )
      .returning();
    return rows[0];
  }

  async decide(
    id: string,
    reviewerUserId: string,
    status: "APPROVED" | "REJECTED",
    reviewerNote: string | undefined,
    tx: Database,
  ) {
    const rows = await tx
      .update(schema.organizationVerificationRequest)
      .set({ status, reviewerUserId, reviewerNote: reviewerNote ?? null, reviewedAt: new Date() })
      .where(
        and(
          eq(schema.organizationVerificationRequest.id, id),
          eq(schema.organizationVerificationRequest.status, "IN_REVIEW"),
        ),
      )
      .returning();
    return rows[0];
  }

  async createResubmission(
    organizationId: string,
    submittedByUserId: string,
  ) {
    const [row] = await this.db
      .insert(schema.organizationVerificationRequest)
      .values({ organizationId, submittedByUserId, status: "PENDING" })
      .returning();
    if (!row) throw new Error("createResubmission: insert returned no row");
    return row;
  }
}
