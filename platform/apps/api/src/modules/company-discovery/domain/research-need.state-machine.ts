import { ConflictError, ErrorCode, ResearchNeedStatus, TransitionTable } from "@r2m/domain";

/**
 * UC-DIS-01 / `06_phase5_full_design.md` §2.1: "DRAFT → OPEN → PAUSED → OPEN,
 * OPEN → CLOSED → ARCHIVED". Only the verbs the sprint breakdown actually gives an
 * endpoint for are wired to a command (publish/pause/resume/close) — `ARCHIVED` is a
 * real reachable state in the enum but no archive endpoint is specified anywhere in the
 * breakdown, so it stays unreachable via API for now (scope cut, not a missing case).
 */
const researchNeedTransitions = new TransitionTable<ResearchNeedStatus>({
  [ResearchNeedStatus.DRAFT]: [ResearchNeedStatus.OPEN],
  [ResearchNeedStatus.OPEN]: [ResearchNeedStatus.PAUSED, ResearchNeedStatus.CLOSED],
  [ResearchNeedStatus.PAUSED]: [ResearchNeedStatus.OPEN],
  [ResearchNeedStatus.CLOSED]: [ResearchNeedStatus.ARCHIVED],
  [ResearchNeedStatus.ARCHIVED]: [],
});

export function canTransitionResearchNeed(from: ResearchNeedStatus, to: ResearchNeedStatus): boolean {
  return researchNeedTransitions.canTransition(from, to);
}

export function assertResearchNeedTransition(from: ResearchNeedStatus, to: ResearchNeedStatus): void {
  if (!canTransitionResearchNeed(from, to)) {
    throw new ConflictError(
      ErrorCode.DISCOVERY_NEED_INVALID_TRANSITION,
      `Research need cannot transition from ${from} to ${to}.`,
      { from, to },
    );
  }
}
