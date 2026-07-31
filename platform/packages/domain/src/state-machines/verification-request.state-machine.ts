import { VerificationRequestStatus } from "../enums/verification.enum";
import { ConflictError } from "../errors/domain-error";
import { ErrorCode } from "../errors/error-codes";
import { TransitionTable } from "./transition-table";

/**
 * Shared verification-request lifecycle (UC-VER-02 narrative, applied here to
 * organization_verification_request; author_verification_request reuses the same enum
 * in Phase 2). PENDING -> IN_REVIEW happens when a reviewer claims the request.
 */
const verificationRequestTransitions = new TransitionTable<VerificationRequestStatus>({
  [VerificationRequestStatus.PENDING]: [
    VerificationRequestStatus.IN_REVIEW,
    VerificationRequestStatus.CANCELLED,
  ],
  [VerificationRequestStatus.IN_REVIEW]: [
    VerificationRequestStatus.APPROVED,
    VerificationRequestStatus.REJECTED,
  ],
  [VerificationRequestStatus.APPROVED]: [],
  [VerificationRequestStatus.REJECTED]: [],
  [VerificationRequestStatus.CANCELLED]: [],
});

export function canTransitionVerificationRequest(
  from: VerificationRequestStatus,
  to: VerificationRequestStatus,
): boolean {
  return verificationRequestTransitions.canTransition(from, to);
}

export function assertVerificationRequestTransition(
  from: VerificationRequestStatus,
  to: VerificationRequestStatus,
): void {
  if (!canTransitionVerificationRequest(from, to)) {
    throw new ConflictError(
      ErrorCode.VERIFICATION_INVALID_TRANSITION,
      `Verification request cannot transition from ${from} to ${to}.`,
      { from, to },
    );
  }
}
