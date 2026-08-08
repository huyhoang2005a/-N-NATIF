import { ConflictError, ErrorCode, ProposalStatus, TransitionTable } from "@r2m/domain";

/**
 * UC-DIS-02 §8 ("Luồng review nội bộ: SUBMITTED → UNDER_REVIEW → ACCEPTED/REJECTED;
 * SUBMITTED/UNDER_REVIEW → WITHDRAWN"). `DRAFT` is a real enum value (mirrors
 * `research_proposal.status` default) but `ResearchNeedsService.create` — the only writer —
 * always creates proposals directly as `SUBMITTED` per the UC main flow's step 3 ("Tạo
 * research_proposal SUBMITTED"), so `DRAFT` has no outgoing edges here; nothing in Sprint
 * 5.3 reaches it via API.
 */
const proposalTransitions = new TransitionTable<ProposalStatus>({
  [ProposalStatus.DRAFT]: [],
  [ProposalStatus.SUBMITTED]: [ProposalStatus.UNDER_REVIEW, ProposalStatus.WITHDRAWN],
  [ProposalStatus.UNDER_REVIEW]: [ProposalStatus.ACCEPTED, ProposalStatus.REJECTED, ProposalStatus.WITHDRAWN],
  [ProposalStatus.ACCEPTED]: [],
  [ProposalStatus.REJECTED]: [],
  [ProposalStatus.WITHDRAWN]: [],
});

export function canTransitionProposal(from: ProposalStatus, to: ProposalStatus): boolean {
  return proposalTransitions.canTransition(from, to);
}

export function assertProposalTransition(from: ProposalStatus, to: ProposalStatus): void {
  if (!canTransitionProposal(from, to)) {
    throw new ConflictError(
      ErrorCode.DISCOVERY_PROPOSAL_STATE_INVALID,
      `Research proposal cannot transition from ${from} to ${to}.`,
      { from, to },
    );
  }
}
