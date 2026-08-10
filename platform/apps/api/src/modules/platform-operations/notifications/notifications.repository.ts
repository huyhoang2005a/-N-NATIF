import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";

const LIST_LIMIT = 50;

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** Mới nhất trước, giới hạn cứng (không cursor pagination — cùng giới hạn đã biết như
   * `GET /resources`, disclosed trong plan Phase 6). */
  async listForActor(recipientUserId: string, status?: string) {
    return this.db.query.notification.findMany({
      where: status
        ? and(eq(schema.notification.recipientUserId, recipientUserId), eq(schema.notification.status, status as never))
        : eq(schema.notification.recipientUserId, recipientUserId),
      orderBy: [desc(schema.notification.createdAt)],
      limit: LIST_LIMIT,
    });
  }

  /** WHERE recipient_user_id lọc sẵn — id không thuộc actor tự động không match, không cần
   * check quyền sở hữu riêng (đúng thiết kế đã chốt ở plan Phase 6). */
  async markRead(recipientUserId: string, ids: string[]) {
    return this.db
      .update(schema.notification)
      .set({ status: "READ", readAt: new Date() })
      .where(and(inArray(schema.notification.id, ids), eq(schema.notification.recipientUserId, recipientUserId)))
      .returning();
  }

  async markDismissed(recipientUserId: string, ids: string[]) {
    return this.db
      .update(schema.notification)
      .set({ status: "ARCHIVED", archivedAt: new Date() })
      .where(and(inArray(schema.notification.id, ids), eq(schema.notification.recipientUserId, recipientUserId)))
      .returning();
  }
}
