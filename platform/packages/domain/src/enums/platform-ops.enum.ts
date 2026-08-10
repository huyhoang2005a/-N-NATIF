export const NotificationStatus = {
  UNREAD: "UNREAD",
  READ: "READ",
  ARCHIVED: "ARCHIVED",
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const OutboxStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  PUBLISHED: "PUBLISHED",
  FAILED: "FAILED",
  DEAD_LETTER: "DEAD_LETTER",
} as const;
export type OutboxStatus = (typeof OutboxStatus)[keyof typeof OutboxStatus];

// ---------- Phase 6 Sprint 6.3 — Content Moderation ----------

export const ModerationTargetType = {
  RESOURCE: "RESOURCE",
  ANNOTATION: "ANNOTATION",
  TECHNOLOGY_PROFILE: "TECHNOLOGY_PROFILE",
} as const;
export type ModerationTargetType = (typeof ModerationTargetType)[keyof typeof ModerationTargetType];

export const ContentFlagStatus = {
  PENDING: "PENDING",
  IN_REVIEW: "IN_REVIEW",
  CLOSED: "CLOSED",
  DISMISSED: "DISMISSED",
} as const;
export type ContentFlagStatus = (typeof ContentFlagStatus)[keyof typeof ContentFlagStatus];

/** UC-MOD-01 lists decision values as "KEEP/HIDE/REMOVE/RESTRICT_AUTHOR/DISMISS", nhưng
 * `moderation_action` enum thật trong dbml không có DISMISS — có `RESTORE` thay vào đó.
 * Đã đối chiếu kỹ (xem plan phê duyệt trước khi code): "DISMISS" trong UC prose/activity
 * diagram là nói tắt cho `content_flag.status = DISMISSED` (cột khác), không phải giá trị
 * của cột này. `action = KEEP` dùng khi flag bị dismiss (không vi phạm); `RESTORE` dùng khi
 * đảo ngược 1 quyết định HIDE/REMOVE trước đó — xem `moderation.service.ts` cho mapping
 * action → content_flag.status đầy đủ. */
export const ModerationAction = {
  KEEP: "KEEP",
  HIDE: "HIDE",
  REMOVE: "REMOVE",
  RESTRICT_AUTHOR: "RESTRICT_AUTHOR",
  RESTORE: "RESTORE",
} as const;
export type ModerationAction = (typeof ModerationAction)[keyof typeof ModerationAction];
