import { ConflictError, ErrorCode, TechnologyCaseStatus, TransitionTable } from "@r2m/domain";

/**
 * Chính thức trong §8 R2M_SPEC_DESIGN_V5_COMPLETE.md (không tự đề xuất, khác Resource/
 * ResourceVersion ở Phase 2). Dù chính thức, vẫn đặt state machine ở đây thay vì
 * `packages/domain` theo đúng ranh giới đã chốt từ Phase 2 trở đi (xem
 * packages/domain/README.md) — mọi state machine mới, kể cả chính thức, thuộc về bounded
 * context của nó, không phải shared kernel.
 *
 * Khai báo đủ 10 trạng thái nối tiếp để dùng lại ở Phase 4-6. Phase 3 chỉ thực sự cho
 * phép gọi tới `EVIDENCE_COLLECTION`; Phase 4 mở thêm `UNDER_ASSESSMENT`/
 * `GAP_IDENTIFIED`/`ROADMAP_DRAFT`/`ROADMAP_APPROVED` (xem `SUPPORTED_TRANSITION_
 * TARGETS`) — các bước sau `ROADMAP_APPROVED` (PILOT_READY trở đi) cần dữ liệu Transfer
 * (Phase 6) chưa tồn tại để guard đúng.
 */
const technologyCaseTransitions = new TransitionTable<TechnologyCaseStatus>({
  [TechnologyCaseStatus.DRAFT]: [TechnologyCaseStatus.EVIDENCE_COLLECTION],
  [TechnologyCaseStatus.EVIDENCE_COLLECTION]: [TechnologyCaseStatus.UNDER_ASSESSMENT],
  [TechnologyCaseStatus.UNDER_ASSESSMENT]: [TechnologyCaseStatus.GAP_IDENTIFIED],
  [TechnologyCaseStatus.GAP_IDENTIFIED]: [TechnologyCaseStatus.ROADMAP_DRAFT],
  [TechnologyCaseStatus.ROADMAP_DRAFT]: [TechnologyCaseStatus.ROADMAP_APPROVED],
  [TechnologyCaseStatus.ROADMAP_APPROVED]: [TechnologyCaseStatus.PILOT_READY],
  [TechnologyCaseStatus.PILOT_READY]: [TechnologyCaseStatus.TRANSFER_READY],
  [TechnologyCaseStatus.TRANSFER_READY]: [TechnologyCaseStatus.COMMERCIALIZED],
  [TechnologyCaseStatus.COMMERCIALIZED]: [TechnologyCaseStatus.ARCHIVED],
  [TechnologyCaseStatus.ARCHIVED]: [],
});

export function canTransitionCase(from: TechnologyCaseStatus, to: TechnologyCaseStatus): boolean {
  return technologyCaseTransitions.canTransition(from, to);
}

export function assertCaseTransition(from: TechnologyCaseStatus, to: TechnologyCaseStatus): void {
  if (!canTransitionCase(from, to)) {
    throw new ConflictError(
      ErrorCode.CASE_INVALID_TRANSITION,
      `Technology case cannot transition from ${from} to ${to}.`,
      { from, to },
    );
  }
}

/** Target thực sự có guard/side-effect implement tới Phase 4 — mọi target khác (từ
 * `PILOT_READY` trở đi, thuộc Phase 6 Transfer) bị chặn ở tầng service
 * (`TechnologyCaseService.applyTransition`) trước khi gọi tới đây, dù bảng transition
 * phía trên đã đúng theo spec đầy đủ. */
export const SUPPORTED_TRANSITION_TARGETS: readonly TechnologyCaseStatus[] = [
  TechnologyCaseStatus.EVIDENCE_COLLECTION,
  TechnologyCaseStatus.UNDER_ASSESSMENT,
  TechnologyCaseStatus.GAP_IDENTIFIED,
  TechnologyCaseStatus.ROADMAP_DRAFT,
  TechnologyCaseStatus.ROADMAP_APPROVED,
];
