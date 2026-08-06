/** Đã chốt sau review (2026-08-06, xem plan PHẦN D quyết định 1-2, README §5): §8 viết
 * "DRAFT → IN_REVIEW → APPROVED / CHANGES_REQUESTED; APPROVED → SUPERSEDED / ARCHIVED"
 * nhưng `CHANGES_REQUESTED`/`ARCHIVED` KHÔNG tồn tại trong enum thật của dbml — enum thật
 * có thêm `ACTIVE`/`COMPLETED`/`REJECTED` mà §8 không nhắc (schema thắng prose, user xác
 * nhận). `RoadmapReviewDecision` map sang `RoadmapStatus` theo đúng 3 nhánh tách biệt —
 * `RoadmapStatus.REJECTED` là state đạt tới được thật, KHÔNG gộp chung `DRAFT`:
 * decision=APPROVED→`APPROVED`, decision=REJECTED→`REJECTED` (terminal), decision=
 * CHANGES_REQUESTED→`DRAFT` (quay lại sửa). `ACTIVE`/`COMPLETED`/`SUPERSEDED` khai đủ
 * nhưng Phase 4 chỉ thực thi tới `APPROVED`/`REJECTED`/`DRAFT` (phần thực thi roadmap
 * thuộc phase sau). */
export const RoadmapStatus = {
  DRAFT: "DRAFT",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
  SUPERSEDED: "SUPERSEDED",
} as const;
export type RoadmapStatus = (typeof RoadmapStatus)[keyof typeof RoadmapStatus];

export const RoadmapReviewDecision = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
} as const;
export type RoadmapReviewDecision = (typeof RoadmapReviewDecision)[keyof typeof RoadmapReviewDecision];

export const MilestoneStatus = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type MilestoneStatus = (typeof MilestoneStatus)[keyof typeof MilestoneStatus];

export const TaskStatus = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  BLOCKED: "BLOCKED",
  DONE: "DONE",
  CANCELLED: "CANCELLED",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const PriorityLevel = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type PriorityLevel = (typeof PriorityLevel)[keyof typeof PriorityLevel];

export const DependencyType = {
  FINISH_TO_START: "FINISH_TO_START",
  START_TO_START: "START_TO_START",
  FINISH_TO_FINISH: "FINISH_TO_FINISH",
  START_TO_FINISH: "START_TO_FINISH",
} as const;
export type DependencyType = (typeof DependencyType)[keyof typeof DependencyType];
