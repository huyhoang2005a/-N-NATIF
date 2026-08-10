import { ConflictError, ErrorCode, TransferManifestStatus, TransitionTable } from "@r2m/domain";

/** UC-TRF-01: "Chuyển READY rồi SHARED" — không có endpoint riêng để đánh dấu READY
 * (danh sách API chỉ có create/items/recipients/share/revoke), nên trên thực tế `share()`
 * luôn thấy manifest ở `DRAFT`. `READY` vẫn khai trong bảng chuyển trạng thái cho đủ enum
 * dbml, phòng khi có endpoint "mark ready" riêng sau này — không phải suy diễn thêm state
 * mới, chỉ dùng đúng enum đã khoá. `EXPIRED` đạt tới qua worker sweep
 * (`apps/worker/src/transfer-manifests/sweep-expired.ts`), không qua state machine này
 * (worker là process riêng, không dùng chung NestJS DI với `apps/api`) — vẫn khai ở đây để
 * tài liệu hoá toàn bộ transition hợp lệ. */
const transferManifestTransitions = new TransitionTable<TransferManifestStatus>({
  [TransferManifestStatus.DRAFT]: [TransferManifestStatus.READY, TransferManifestStatus.SHARED],
  [TransferManifestStatus.READY]: [TransferManifestStatus.SHARED],
  [TransferManifestStatus.SHARED]: [TransferManifestStatus.REVOKED, TransferManifestStatus.EXPIRED],
  [TransferManifestStatus.EXPIRED]: [],
  [TransferManifestStatus.REVOKED]: [],
});

export function canTransitionTransferManifest(from: TransferManifestStatus, to: TransferManifestStatus): boolean {
  return transferManifestTransitions.canTransition(from, to);
}

export function assertTransferManifestTransition(from: TransferManifestStatus, to: TransferManifestStatus): void {
  if (!canTransitionTransferManifest(from, to)) {
    throw new ConflictError(
      ErrorCode.TRANSFER_MANIFEST_INVALID_TRANSITION,
      `Transfer manifest cannot transition from ${from} to ${to}.`,
      { from, to },
    );
  }
}
