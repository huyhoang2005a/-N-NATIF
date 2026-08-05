import { ConflictError, ErrorCode, TechnologyCaseStatus, TransitionTable } from "@r2m/domain";

/**
 * Chính thức trong §8 R2M_SPEC_DESIGN_V5_COMPLETE.md (không tự đề xuất, khác Resource/
 * ResourceVersion ở Phase 2). Dù chính thức, vẫn đặt state machine ở đây thay vì
 * `packages/domain` theo đúng ranh giới đã chốt từ Phase 2 trở đi (xem
 * packages/domain/README.md) — mọi state machine mới, kể cả chính thức, thuộc về bounded
 * context của nó, không phải shared kernel.
 *
 * Khai báo đủ 10 trạng thái nối tiếp để dùng lại ở Phase 4-6, nhưng Phase 3
 * (`TechnologyCaseService.transition`) chỉ thực sự cho phép gọi tới
 * `EVIDENCE_COLLECTION` — các bước sau cần dữ liệu Assessment/Gap (Phase 4) chưa tồn
 * tại để guard đúng (vd không cho `ROADMAP_APPROVED` khi còn gap CRITICAL).
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

/** Phase 3 chỉ implement guard/side-effect cho transition này — mọi target khác bị
 * chặn ở tầng service (`TechnologyCaseService.transition`) trước khi gọi tới đây, dù
 * bảng transition phía trên đã đúng theo spec đầy đủ. */
export const PHASE_3_SUPPORTED_TARGET = TechnologyCaseStatus.EVIDENCE_COLLECTION;
