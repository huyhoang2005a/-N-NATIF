import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../database/database.module";

function firstOrThrow<T>(rows: T[], message: string): T {
  const row = rows[0];
  if (!row) throw new Error(message);
  return row;
}

@Injectable()
export class ResourceAccessGrantsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findById(id: string) {
    return this.db.query.resourceAccessGrant.findFirst({ where: eq(schema.resourceAccessGrant.id, id) });
  }

  async listByResource(resourceId: string) {
    return this.db.query.resourceAccessGrant.findMany({
      where: eq(schema.resourceAccessGrant.resourceId, resourceId),
    });
  }

  /** SUC-04 invariant (ĐỀ XUẤT — CẦN REVIEW, xem plan B.0.1): không tạo 2 grant ACTIVE
   * trùng (resource, recipient, permission). */
  async findActiveDuplicate(input: {
    resourceId: string;
    recipientUserId?: string;
    recipientOrganizationId?: string;
    permission: string;
  }) {
    return this.db.query.resourceAccessGrant.findFirst({
      where: and(
        eq(schema.resourceAccessGrant.resourceId, input.resourceId),
        eq(schema.resourceAccessGrant.status, "ACTIVE"),
        eq(schema.resourceAccessGrant.permission, input.permission as never),
        input.recipientUserId
          ? eq(schema.resourceAccessGrant.recipientUserId, input.recipientUserId)
          : eq(schema.resourceAccessGrant.recipientOrganizationId, input.recipientOrganizationId!),
      ),
    });
  }

  async create(values: typeof schema.resourceAccessGrant.$inferInsert, tx: Database) {
    const rows = await tx.insert(schema.resourceAccessGrant).values(values).returning();
    return firstOrThrow(rows, "create: insert returned no row");
  }

  async revoke(id: string, revokedByUserId: string, tx: Database) {
    const rows = await tx
      .update(schema.resourceAccessGrant)
      .set({ status: "REVOKED", revokedAt: new Date(), revokedByUserId })
      .where(and(eq(schema.resourceAccessGrant.id, id), eq(schema.resourceAccessGrant.status, "ACTIVE")))
      .returning();
    return rows[0];
  }
}
