import { AuthorVerificationStatus, ConflictError, ErrorCode, TransitionTable } from "@r2m/domain";

/**
 * §8 "State machine chính thức" (R2M_SPEC_DESIGN_V5_COMPLETE.md): "UNVERIFIED → PENDING
 * → VERIFIED / DECLINED; VERIFIED → SUSPENDED; DECLINED → PENDING". Business rule
 * specific to the Verification bounded context's author sub-flow, so it lives here per
 * the packages/domain boundary (see packages/domain/README.md) even though — unlike
 * Resource/ResourceVersion — it is officially spec'd, not self-proposed.
 */
const authorProfileTransitions = new TransitionTable<AuthorVerificationStatus>({
  [AuthorVerificationStatus.UNVERIFIED]: [AuthorVerificationStatus.PENDING],
  [AuthorVerificationStatus.PENDING]: [
    AuthorVerificationStatus.VERIFIED,
    AuthorVerificationStatus.DECLINED,
  ],
  [AuthorVerificationStatus.VERIFIED]: [AuthorVerificationStatus.SUSPENDED],
  [AuthorVerificationStatus.DECLINED]: [AuthorVerificationStatus.PENDING],
  [AuthorVerificationStatus.SUSPENDED]: [],
});

export function canTransitionAuthorProfile(
  from: AuthorVerificationStatus,
  to: AuthorVerificationStatus,
): boolean {
  return authorProfileTransitions.canTransition(from, to);
}

export function assertAuthorProfileTransition(
  from: AuthorVerificationStatus,
  to: AuthorVerificationStatus,
): void {
  if (!canTransitionAuthorProfile(from, to)) {
    throw new ConflictError(
      ErrorCode.AUTHOR_INVALID_TRANSITION,
      `Author profile cannot transition from ${from} to ${to}.`,
      { from, to },
    );
  }
}
