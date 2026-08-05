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

/** ĐỀ XUẤT — CẦN REVIEW (không có trong danh sách 10 state machine chính thức ở §8
 * R2M_SPEC_DESIGN_V5_COMPLETE.md — xem plan PHẦN B.0.1). */
export const ResourceStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
  WITHDRAWN: "WITHDRAWN",
} as const;
export type ResourceStatus = (typeof ResourceStatus)[keyof typeof ResourceStatus];

/** ĐỀ XUẤT — CẦN REVIEW — xem ghi chú ở `ResourceStatus` phía trên. */
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
