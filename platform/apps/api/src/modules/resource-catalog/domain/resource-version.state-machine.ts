import { ConflictError, ErrorCode, ResourceVersionStatus, TransitionTable } from "@r2m/domain";

/**
 * Đã chốt sau review (2026-08-05) — xem ghi chú ở `resource.state-machine.ts`.
 * `PUBLISHED -> SUPERSEDED` không tự động thực hiện ở đây — service gọi
 * `assertResourceVersionTransition` khi version mới hơn được publish để chuyển version
 * PUBLISHED trước đó sang SUPERSEDED trong cùng transaction (UC-RES-01 business
 * invariant: "Published resource version bất biến"). User đã xác nhận cascade này là bắt
 * buộc (tránh 2 version PUBLISHED song song, không nơi nào biết đâu là bản hiện hành) và
 * đúng vị trí đặt ở domain service, không đặt trong state machine.
 */
const resourceVersionTransitions = new TransitionTable<ResourceVersionStatus>({
  [ResourceVersionStatus.DRAFT]: [ResourceVersionStatus.PUBLISHED, ResourceVersionStatus.WITHDRAWN],
  [ResourceVersionStatus.PUBLISHED]: [
    ResourceVersionStatus.SUPERSEDED,
    ResourceVersionStatus.WITHDRAWN,
  ],
  [ResourceVersionStatus.SUPERSEDED]: [],
  [ResourceVersionStatus.WITHDRAWN]: [],
});

export function canTransitionResourceVersion(
  from: ResourceVersionStatus,
  to: ResourceVersionStatus,
): boolean {
  return resourceVersionTransitions.canTransition(from, to);
}

export function assertResourceVersionTransition(
  from: ResourceVersionStatus,
  to: ResourceVersionStatus,
): void {
  if (!canTransitionResourceVersion(from, to)) {
    throw new ConflictError(
      ErrorCode.RESOURCE_INVALID_TRANSITION,
      `Resource version cannot transition from ${from} to ${to}.`,
      { from, to },
    );
  }
}
