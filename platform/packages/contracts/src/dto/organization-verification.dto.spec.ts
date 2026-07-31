import { describe, expect, it } from "vitest";
import { OrganizationVerificationDecisionRequestSchema } from "./organization-verification.dto";

describe("OrganizationVerificationDecisionRequestSchema", () => {
  it("accepts APPROVE without a reviewerNote", () => {
    const result = OrganizationVerificationDecisionRequestSchema.safeParse({ decision: "APPROVE" });
    expect(result.success).toBe(true);
  });

  it("rejects REJECT without a reviewerNote", () => {
    const result = OrganizationVerificationDecisionRequestSchema.safeParse({ decision: "REJECT" });
    expect(result.success).toBe(false);
  });

  it("accepts REJECT with a non-empty reviewerNote", () => {
    const result = OrganizationVerificationDecisionRequestSchema.safeParse({
      decision: "REJECT",
      reviewerNote: "Tax code does not match business registry.",
    });
    expect(result.success).toBe(true);
  });
});
