/** Đã chốt sau review (2026-08-06, xem plan PHẦN D quyết định 1-2, README §5): §8
 * R2M_SPEC_DESIGN_V5_COMPLETE.md viết "DRAFT → SUBMITTED → APPROVED / CHANGES_REQUESTED;
 * CHANGES_REQUESTED → DRAFT" nhưng `CHANGES_REQUESTED` KHÔNG tồn tại trong enum thật của
 * dbml (schema là nguồn sự thật đã khoá, user xác nhận nguyên tắc này thắng prose).
 * Diễn giải: "changes requested" (quyết định REJECT) đưa assessment quay lại `DRAFT` để
 * sửa — không tạo state mới. `APPROVED → SUPERSEDED` khi có assessment mới được approve
 * cho cùng case (mirror `ResourceVersion.PUBLISHED→SUPERSEDED`, Phase 2). */
export const AssessmentStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  SUPERSEDED: "SUPERSEDED",
} as const;
export type AssessmentStatus = (typeof AssessmentStatus)[keyof typeof AssessmentStatus];

export const FrameworkStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  RETIRED: "RETIRED",
} as const;
export type FrameworkStatus = (typeof FrameworkStatus)[keyof typeof FrameworkStatus];

export const GapSeverity = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;
export type GapSeverity = (typeof GapSeverity)[keyof typeof GapSeverity];

/** `CLOSED` khai đủ theo dbml nhưng Phase 4 không có endpoint nào transition tới đó
 * (dành cho phase sau, giữ đúng tiền lệ khai đủ enum chính thức + chỉ mở khoá phần
 * trong phạm vi phase — xem `gap.state-machine.ts`). */
export const GapStatus = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  ACCEPTED_RISK: "ACCEPTED_RISK",
  CLOSED: "CLOSED",
} as const;
export type GapStatus = (typeof GapStatus)[keyof typeof GapStatus];
