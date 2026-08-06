import { ConflictError, ErrorCode, GapStatus, TransitionTable } from "@r2m/domain";

/**
 * §8 chính thức: "OPEN → IN_PROGRESS → RESOLVED; OPEN/IN_PROGRESS → ACCEPTED_RISK;
 * resolved có thể REOPENED theo policy". `REOPENED` không phải giá trị `GapStatus` thật
 * (dbml chỉ có OPEN/IN_PROGRESS/RESOLVED/ACCEPTED_RISK/CLOSED) — diễn giải "reopen" =
 * quay lại `OPEN` (giá trị có thật), đúng tinh thần "theo policy" (tự chọn policy cụ
 * thể). `CLOSED` khai đủ trong transition table (RESOLVED → CLOSED) nhưng Phase 4 chưa
 * expose endpoint nào gọi tới — dành cho phase sau (có thể là bước "archive" tổng thể).
 */
const gapTransitions = new TransitionTable<GapStatus>({
  [GapStatus.OPEN]: [GapStatus.IN_PROGRESS, GapStatus.ACCEPTED_RISK],
  [GapStatus.IN_PROGRESS]: [GapStatus.RESOLVED, GapStatus.ACCEPTED_RISK, GapStatus.OPEN],
  [GapStatus.RESOLVED]: [GapStatus.CLOSED, GapStatus.OPEN],
  [GapStatus.ACCEPTED_RISK]: [],
  [GapStatus.CLOSED]: [],
});

export function canTransitionGap(from: GapStatus, to: GapStatus): boolean {
  return gapTransitions.canTransition(from, to);
}

export function assertGapTransition(from: GapStatus, to: GapStatus): void {
  if (!canTransitionGap(from, to)) {
    throw new ConflictError(
      ErrorCode.GAP_INVALID_TRANSITION,
      `Gap cannot transition from ${from} to ${to}.`,
      { from, to },
    );
  }
}
