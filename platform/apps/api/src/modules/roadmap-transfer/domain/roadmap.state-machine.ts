import { ConflictError, ErrorCode, RoadmapStatus, TransitionTable } from "@r2m/domain";

/**
 * ĐỀ XUẤT — CẦN REVIEW (xem plan PHẦN D quyết định 1-2, packages/domain/src/enums/
 * roadmap.enum.ts): §8 viết "DRAFT → IN_REVIEW → APPROVED / CHANGES_REQUESTED; APPROVED
 * → SUPERSEDED / ARCHIVED" nhưng `CHANGES_REQUESTED`/`ARCHIVED` không tồn tại trong
 * `RoadmapStatus` enum thật (dbml: DRAFT/IN_REVIEW/APPROVED/ACTIVE/COMPLETED/REJECTED/
 * SUPERSEDED). Diễn giải: review decision=CHANGES_REQUESTED (giá trị thật trong
 * `RoadmapReviewDecision`, khác `RoadmapStatus`) đưa roadmap quay lại `DRAFT`;
 * decision=REJECTED → roadmap `REJECTED` (terminal). Khai đủ `APPROVED→ACTIVE→COMPLETED`
 * và `APPROVED→SUPERSEDED` theo enum chính thức nhưng Phase 4 chỉ thực thi tới
 * `APPROVED`/`REJECTED` — phần thực thi roadmap (ACTIVE/COMPLETED) thuộc phase sau.
 *
 * Đặt ở đây (không phải packages/domain) theo đúng ranh giới đã chốt từ Phase 2.
 */
const roadmapTransitions = new TransitionTable<RoadmapStatus>({
  [RoadmapStatus.DRAFT]: [RoadmapStatus.IN_REVIEW],
  [RoadmapStatus.IN_REVIEW]: [RoadmapStatus.APPROVED, RoadmapStatus.REJECTED, RoadmapStatus.DRAFT],
  [RoadmapStatus.APPROVED]: [RoadmapStatus.ACTIVE, RoadmapStatus.SUPERSEDED],
  [RoadmapStatus.ACTIVE]: [RoadmapStatus.COMPLETED],
  [RoadmapStatus.COMPLETED]: [],
  [RoadmapStatus.REJECTED]: [],
  [RoadmapStatus.SUPERSEDED]: [],
});

/** Target thực sự được Phase 4 hỗ trợ khi service tạo/duyệt roadmap — `ACTIVE`/
 * `COMPLETED` khai đủ trong bảng transition phía trên nhưng chưa có endpoint nào gọi
 * tới (dành cho phase sau). */
export const PHASE_4_ROADMAP_REVIEW_TARGETS: readonly RoadmapStatus[] = [
  RoadmapStatus.APPROVED,
  RoadmapStatus.REJECTED,
  RoadmapStatus.DRAFT,
];

export function canTransitionRoadmap(from: RoadmapStatus, to: RoadmapStatus): boolean {
  return roadmapTransitions.canTransition(from, to);
}

export function assertRoadmapTransition(from: RoadmapStatus, to: RoadmapStatus): void {
  if (!canTransitionRoadmap(from, to)) {
    throw new ConflictError(
      ErrorCode.ROADMAP_INVALID_TRANSITION,
      `Roadmap cannot transition from ${from} to ${to}.`,
      { from, to },
    );
  }
}
