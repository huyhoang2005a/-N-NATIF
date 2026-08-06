import { ConflictError, ErrorCode, RoadmapStatus, TransitionTable } from "@r2m/domain";

/**
 * Đã chốt sau review (2026-08-06, xem plan PHẦN D quyết định 1-2, packages/domain/src/
 * enums/roadmap.enum.ts, README §5): §8 viết "DRAFT → IN_REVIEW → APPROVED /
 * CHANGES_REQUESTED; APPROVED → SUPERSEDED / ARCHIVED" nhưng `CHANGES_REQUESTED`/
 * `ARCHIVED` không tồn tại trong `RoadmapStatus` enum thật (dbml: DRAFT/IN_REVIEW/
 * APPROVED/ACTIVE/COMPLETED/REJECTED/SUPERSEDED — schema thắng prose, user xác nhận).
 * `RoadmapReviewDecision` (3 giá trị: APPROVED/REJECTED/CHANGES_REQUESTED) map sang
 * `RoadmapStatus` theo đúng 3 nhánh tách biệt, KHÔNG gộp REJECTED chung CHANGES_REQUESTED
 * — `RoadmapStatus.REJECTED` là state đạt tới được thật, không phải khai cho đủ enum:
 *
 *   decision = APPROVED           → RoadmapStatus.APPROVED
 *   decision = REJECTED           → RoadmapStatus.REJECTED   (terminal)
 *   decision = CHANGES_REQUESTED  → RoadmapStatus.DRAFT       (quay lại sửa)
 *
 * Khai đủ `APPROVED→ACTIVE→COMPLETED` và `APPROVED→SUPERSEDED` theo enum chính thức
 * nhưng Phase 4 chỉ thực thi tới `APPROVED`/`REJECTED`/`DRAFT` — phần thực thi roadmap
 * (ACTIVE/COMPLETED) thuộc phase sau.
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
