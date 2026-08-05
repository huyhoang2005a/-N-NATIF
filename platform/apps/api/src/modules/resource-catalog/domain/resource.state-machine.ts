import { ConflictError, ErrorCode, ResourceStatus, TransitionTable } from "@r2m/domain";

/**
 * Đã chốt sau review (2026-08-05). `Resource` không nằm trong danh sách 10 state machine
 * chính thức ở §8 `R2M_SPEC_DESIGN_V5_COMPLETE.md`. Đề xuất dựa trên UC-RES-01 ("Publish
 * version sau validation; cập nhật resource ACTIVE nếu policy cho phép" → chọn: publish
 * version đầu tiên luôn kích hoạt resource ngay) và giá trị enum thật trong dbml, user đã
 * duyệt. ACTIVE → ARCHIVED/WITHDRAWN KHÔNG cascade xuống `ResourceVersion` (xem
 * `packages/domain/src/enums/resource.enum.ts`) — chưa có endpoint gọi 2 transition này ở
 * Phase 2, giữ nguyên transition table để dùng khi thật sự xây tính năng archive/withdraw.
 * Business rule cụ thể của bounded context Resource Catalog, đặt ở đây theo đúng ranh
 * giới đã chốt (không đặt trong packages/domain — xem packages/domain/README.md).
 */
const resourceTransitions = new TransitionTable<ResourceStatus>({
  [ResourceStatus.DRAFT]: [ResourceStatus.ACTIVE],
  [ResourceStatus.ACTIVE]: [ResourceStatus.ARCHIVED, ResourceStatus.WITHDRAWN],
  [ResourceStatus.ARCHIVED]: [],
  [ResourceStatus.WITHDRAWN]: [],
});

export function canTransitionResource(from: ResourceStatus, to: ResourceStatus): boolean {
  return resourceTransitions.canTransition(from, to);
}

export function assertResourceTransition(from: ResourceStatus, to: ResourceStatus): void {
  if (!canTransitionResource(from, to)) {
    throw new ConflictError(
      ErrorCode.RESOURCE_INVALID_TRANSITION,
      `Resource cannot transition from ${from} to ${to}.`,
      { from, to },
    );
  }
}
