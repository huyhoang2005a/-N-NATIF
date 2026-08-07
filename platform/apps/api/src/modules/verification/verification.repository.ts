import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, asc, count, eq, inArray } from "drizzle-orm";
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
    const existing = await this.findOpenRequest(organizationId);
    return existing !== undefined;
  }

  async findOpenRequest(organizationId: string) {
    return this.db.query.organizationVerificationRequest.findFirst({
      where: and(
        eq(schema.organizationVerificationRequest.organizationId, organizationId),
        inArray(schema.organizationVerificationRequest.status, ["PENDING", "IN_REVIEW"]),
      ),
    });
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
    tx?: Database,
  ) {
    const client = tx ?? this.db;
    const [row] = await client
      .insert(schema.organizationVerificationRequest)
      .values({ organizationId, submittedByUserId, status: "PENDING" })
      .returning();
    if (!row) throw new Error("createResubmission: insert returned no row");
    return row;
  }

  async createDocument(
    input: {
      organizationVerificationRequestId: string;
      documentType: string;
      storageObjectKey: string;
      originalFilename: string;
      mimeType: string;
      sizeBytes: number;
      checksumSha256: string;
    },
    tx: Database,
  ) {
    const [row] = await tx
      .insert(schema.verificationDocument)
      .values({
        organizationVerificationRequestId: input.organizationVerificationRequestId,
        documentType: input.documentType as never,
        storageObjectKey: input.storageObjectKey,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256,
      })
      .returning();
    if (!row) throw new Error("createDocument: insert returned no row");
    return row;
  }

  async listDocuments(organizationVerificationRequestId: string) {
    return this.db.query.verificationDocument.findMany({
      where: eq(schema.verificationDocument.organizationVerificationRequestId, organizationVerificationRequestId),
    });
  }

  async countDocuments(organizationVerificationRequestId: string): Promise<number> {
    const rows = await this.db
      .select({ value: count() })
      .from(schema.verificationDocument)
      .where(
        eq(schema.verificationDocument.organizationVerificationRequestId, organizationVerificationRequestId),
      );
    return rows[0]?.value ?? 0;
  }
}
