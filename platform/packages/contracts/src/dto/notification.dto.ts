import { z } from "zod";

export const ListNotificationsQuerySchema = z.object({
  status: z.enum(["UNREAD", "READ", "ARCHIVED"]).optional(),
});
export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuerySchema>;

/** Batch theo id[] — WHERE recipient_user_id = actor lọc sẵn trong repository, id không
 * thuộc actor bị bỏ qua âm thầm (không lỗi cứng), đúng thiết kế đã chốt ở plan Phase 6. */
export const NotificationIdsRequestSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});
export type NotificationIdsRequest = z.infer<typeof NotificationIdsRequestSchema>;

export interface NotificationResponse {
  id: string;
  scopeOrganizationId: string | null;
  type: string;
  title: string;
  message: string;
  status: string;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
}
