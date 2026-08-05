import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";

@Injectable()
export class AuthorVerificationRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findAuthorProfile(userId: string) {
    return this.db.query.authorProfile.findFirst({
      where: eq(schema.authorProfile.userId, userId),
    });
  }

  async createAuthorProfile(userId: string, tx?: Database) {
    const client = tx ?? this.db;
    const [row] = await client.insert(schema.authorProfile).values({ userId }).returning();
    if (!row) throw new Error("createAuthorProfile: insert returned no row");
    return row;
  }

  async updateAuthorProfileStatus(
    userId: string,
    status: string,
    tx: Database,
    extra?: { verifiedAt?: Date | null; suspendedAt?: Date | null },
  ) {
    const rows = await tx
      .update(schema.authorProfile)
      .set({ verificationStatus: status as never, ...extra })
      .where(eq(schema.authorProfile.userId, userId))
      .returning();
    return rows[0];
  }

  async findById(id: string) {
    return this.db.query.authorVerificationRequest.findFirst({
      where: eq(schema.authorVerificationRequest.id, id),
    });
  }

  async listPending() {
    return this.db.query.authorVerificationRequest.findMany({
      where: inArray(schema.authorVerificationRequest.status, ["PENDING", "IN_REVIEW"]),
      orderBy: [asc(schema.authorVerificationRequest.submittedAt)],
    });
  }

  async hasOpenRequest(authorUserId: string) {
    const existing = await this.db.query.authorVerificationRequest.findFirst({
      where: and(
        eq(schema.authorVerificationRequest.authorUserId, authorUserId),
        inArray(schema.authorVerificationRequest.status, ["PENDING", "IN_REVIEW"]),
      ),
    });
    return existing !== undefined;
  }

  async createRequest(
    authorUserId: string,
    affiliationOrgId: string,
    submittedNote: string | undefined,
    tx: Database,
  ) {
    const [row] = await tx
      .insert(schema.authorVerificationRequest)
      .values({ authorUserId, affiliationOrgId, submittedNote, status: "PENDING" })
      .returning();
    if (!row) throw new Error("createRequest: insert returned no row");
    return row;
  }

  async createDocument(
    input: {
      authorVerificationRequestId: string;
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
        authorVerificationRequestId: input.authorVerificationRequestId,
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

  /** Optimistic claim: only succeeds if the request is still PENDING (first reviewer wins) —
   * same pattern as `VerificationRepository.claim` for organization requests. */
  async claim(id: string, reviewerUserId: string) {
    const rows = await this.db
      .update(schema.authorVerificationRequest)
      .set({ status: "IN_REVIEW", reviewerUserId })
      .where(
        and(
          eq(schema.authorVerificationRequest.id, id),
          eq(schema.authorVerificationRequest.status, "PENDING"),
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
      .update(schema.authorVerificationRequest)
      .set({ status, reviewerUserId, reviewerNote: reviewerNote ?? null, reviewedAt: new Date() })
      .where(
        and(
          eq(schema.authorVerificationRequest.id, id),
          eq(schema.authorVerificationRequest.status, "IN_REVIEW"),
        ),
      )
      .returning();
    return rows[0];
  }

  async findDocumentByRequestId(authorVerificationRequestId: string) {
    return this.db.query.verificationDocument.findFirst({
      where: eq(schema.verificationDocument.authorVerificationRequestId, authorVerificationRequestId),
    });
  }
}
