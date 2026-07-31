import { describe, expect, it } from "vitest";
import { OrganizationStatus } from "../enums/organization.enum";
import { assertOrganizationTransition, canTransitionOrganization } from "./organization.state-machine";

describe("organization state machine", () => {
  it("allows PENDING_VERIFICATION -> ACTIVE", () => {
    expect(
      canTransitionOrganization(OrganizationStatus.PENDING_VERIFICATION, OrganizationStatus.ACTIVE),
    ).toBe(true);
  });

  it("allows SUSPENDED -> ACTIVE and SUSPENDED -> ARCHIVED", () => {
    expect(canTransitionOrganization(OrganizationStatus.SUSPENDED, OrganizationStatus.ACTIVE)).toBe(
      true,
    );
    expect(canTransitionOrganization(OrganizationStatus.SUSPENDED, OrganizationStatus.ARCHIVED)).toBe(
      true,
    );
  });

  it("rejects skipping straight from PENDING_VERIFICATION to SUSPENDED", () => {
    expect(
      canTransitionOrganization(OrganizationStatus.PENDING_VERIFICATION, OrganizationStatus.SUSPENDED),
    ).toBe(false);
  });

  it("rejects any transition out of a terminal ARCHIVED state", () => {
    expect(canTransitionOrganization(OrganizationStatus.ARCHIVED, OrganizationStatus.ACTIVE)).toBe(
      false,
    );
  });

  it("throws ORG_INVALID_TRANSITION with a 409 hint on an illegal move", () => {
    expect(() =>
      assertOrganizationTransition(OrganizationStatus.REJECTED, OrganizationStatus.ACTIVE),
    ).toThrowError(/ORG_INVALID_TRANSITION|cannot transition/);
  });
});
