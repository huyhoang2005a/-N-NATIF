export const ResourceType = {
  PAPER: "PAPER",
  REPORT: "REPORT",
  DATASET: "DATASET",
  MODEL: "MODEL",
  CHECKPOINT: "CHECKPOINT",
  SOURCE_CODE: "SOURCE_CODE",
  PATENT: "PATENT",
  LICENSE: "LICENSE",
  ARCHITECTURE_DOCUMENT: "ARCHITECTURE_DOCUMENT",
  EXPERIMENT_RESULT: "EXPERIMENT_RESULT",
  PILOT_EVIDENCE: "PILOT_EVIDENCE",
  VIDEO: "VIDEO",
  OTHER: "OTHER",
} as const;
export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

/** Đã chốt sau review (2026-08-05) — không có trong danh sách 10 state machine chính
 * thức ở §8 R2M_SPEC_DESIGN_V5_COMPLETE.md, tự đề xuất transition dựa theo UC-RES-01 +
 * giá trị enum thật trong dbml, user đã duyệt. ARCHIVED/WITHDRAWN KHÔNG cascade xuống
 * `ResourceVersion` — 2 khái niệm độc lập ("container còn hoạt động không" vs "bản nào
 * là bản chính thức"); version đã có citation/evidence trỏ vào không được tự đổi trạng
 * thái chỉ vì Resource cha bị archive, nếu không sẽ phá vỡ invariant "evidence active
 * phải có citation hợp lệ" (Phase 3). Endpoint archive/withdraw Resource CHƯA tồn tại ở
 * Phase 2 (ngoài phạm vi §13.2) — quyết định này chỉ ghi nhận để áp dụng khi thật sự xây. */
export const ResourceStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
  WITHDRAWN: "WITHDRAWN",
} as const;
export type ResourceStatus = (typeof ResourceStatus)[keyof typeof ResourceStatus];

/** Đã chốt sau review (2026-08-05) — xem ghi chú ở `ResourceStatus` phía trên.
 * `PUBLISHED → SUPERSEDED` PHẢI cascade (khi publish version mới, version PUBLISHED cũ
 * tự chuyển SUPERSEDED trong cùng transaction) — nếu không, không nơi nào biết đâu là
 * "bản hiện hành" khi resolve citation/evidence. Cascade này đặt trong domain service
 * (`resources.service.ts#publishVersion`), KHÔNG đặt trong state machine — đã đúng vị
 * trí từ đầu. */
export const ResourceVersionStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  SUPERSEDED: "SUPERSEDED",
  WITHDRAWN: "WITHDRAWN",
} as const;
export type ResourceVersionStatus =
  (typeof ResourceVersionStatus)[keyof typeof ResourceVersionStatus];

export const ResourceAccessLevel = {
  PUBLIC: "PUBLIC",
  ORGANIZATION: "ORGANIZATION",
  CASE_ONLY: "CASE_ONLY",
  APPROVAL_REQUIRED: "APPROVAL_REQUIRED",
  PRIVATE: "PRIVATE",
} as const;
export type ResourceAccessLevel = (typeof ResourceAccessLevel)[keyof typeof ResourceAccessLevel];

export const AccessPermission = {
  VIEW: "VIEW",
  DOWNLOAD: "DOWNLOAD",
  MANAGE: "MANAGE",
} as const;
export type AccessPermission = (typeof AccessPermission)[keyof typeof AccessPermission];

export const AccessGrantStatus = {
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED",
} as const;
export type AccessGrantStatus = (typeof AccessGrantStatus)[keyof typeof AccessGrantStatus];

export const ContentModerationStatus = {
  ACTIVE: "ACTIVE",
  HIDDEN: "HIDDEN",
  REMOVED: "REMOVED",
} as const;
export type ContentModerationStatus =
  (typeof ContentModerationStatus)[keyof typeof ContentModerationStatus];

export const IngestionStatus = {
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type IngestionStatus = (typeof IngestionStatus)[keyof typeof IngestionStatus];

export const AnnotationStatus = {
  ACTIVE: "ACTIVE",
  DEPRECATED: "DEPRECATED",
  REMOVED: "REMOVED",
} as const;
export type AnnotationStatus = (typeof AnnotationStatus)[keyof typeof AnnotationStatus];
