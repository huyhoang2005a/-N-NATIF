import { describe, expect, it } from "vitest";
import { VerificationRequestStatus } from "../enums/verification.enum";
import {
  assertVerificationRequestTransition,
  canTransitionVerificationRequest,
} from "./verification-request.state-machine";

describe("verification request state machine", () => {
  it("allows PENDING -> IN_REVIEW when a reviewer claims it", () => {
    expect(
      canTransitionVerificationRequest(
        VerificationRequestStatus.PENDING,
        VerificationRequestStatus.IN_REVIEW,
      ),
    ).toBe(true);
  });

  it("allows IN_REVIEW -> APPROVED and IN_REVIEW -> REJECTED", () => {
    expect(
      canTransitionVerificationRequest(
        VerificationRequestStatus.IN_REVIEW,
        VerificationRequestStatus.APPROVED,
      ),
    ).toBe(true);
    expect(
      canTransitionVerificationRequest(
        VerificationRequestStatus.IN_REVIEW,
        VerificationRequestStatus.REJECTED,
      ),
    ).toBe(true);
  });

  it("rejects skipping straight from PENDING to APPROVED (must be claimed first)", () => {
    expect(
      canTransitionVerificationRequest(
        VerificationRequestStatus.PENDING,
        VerificationRequestStatus.APPROVED,
      ),
    ).toBe(false);
  });

  it("rejects re-deciding an already APPROVED request", () => {
    expect(() =>
      assertVerificationRequestTransition(
        VerificationRequestStatus.APPROVED,
        VerificationRequestStatus.REJECTED,
      ),
    ).toThrow();
  });
});
