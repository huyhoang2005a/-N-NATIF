import { AssessmentStatus, ConflictError, ErrorCode, TransitionTable } from "@r2m/domain";

/**
 * ĐỀ XUẤT — CẦN REVIEW (xem plan PHẦN D quyết định 1-2, packages/domain/src/enums/
 * assessment-gap.enum.ts): §8 R2M_SPEC_DESIGN_V5_COMPLETE.md viết "DRAFT → SUBMITTED →
 * APPROVED / CHANGES_REQUESTED; CHANGES_REQUESTED → DRAFT" nhưng `CHANGES_REQUESTED`
 * không tồn tại trong `AssessmentStatus` enum thật (dbml: DRAFT/SUBMITTED/APPROVED/
 * SUPERSEDED — schema là nguồn sự thật đã khoá). Diễn giải: decision=REJECT đưa
 * assessment quay lại `DRAFT` để sửa (không tạo state mới); `APPROVED → SUPERSEDED` khi
 * có assessment mới được approve cho cùng case (mirror `ResourceVersion.PUBLISHED→
 * SUPERSEDED`, Phase 2).
 *
 * Đặt ở đây (không phải packages/domain) theo đúng ranh giới đã chốt từ Phase 2 — mọi
 * state machine mới, kể cả chính thức, thuộc bounded context của nó.
 */
const assessmentTransitions = new TransitionTable<AssessmentStatus>({
  [AssessmentStatus.DRAFT]: [AssessmentStatus.SUBMITTED],
  [AssessmentStatus.SUBMITTED]: [AssessmentStatus.APPROVED, AssessmentStatus.DRAFT],
  [AssessmentStatus.APPROVED]: [AssessmentStatus.SUPERSEDED],
  [AssessmentStatus.SUPERSEDED]: [],
});

export function canTransitionAssessment(from: AssessmentStatus, to: AssessmentStatus): boolean {
  return assessmentTransitions.canTransition(from, to);
}

export function assertAssessmentTransition(from: AssessmentStatus, to: AssessmentStatus): void {
  if (!canTransitionAssessment(from, to)) {
    throw new ConflictError(
      ErrorCode.ASSESSMENT_INVALID_TRANSITION,
      `Readiness assessment cannot transition from ${from} to ${to}.`,
      { from, to },
    );
  }
}
