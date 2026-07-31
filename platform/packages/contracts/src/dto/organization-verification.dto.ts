import { z } from "zod";

/**
 * UC-VER-02 invariant (applied to organization verification, SUC-03): a reject decision
 * must always carry a reason. Enforced here so the API layer rejects malformed input
 * before it ever reaches the domain service.
 */
export const OrganizationVerificationDecisionRequestSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    reviewerNote: z.string().trim().max(2000).optional(),
  })
  .refine((value) => value.decision !== "REJECT" || Boolean(value.reviewerNote?.length), {
    message: "reviewerNote is required when decision is REJECT.",
    path: ["reviewerNote"],
  });
export type OrganizationVerificationDecisionRequest = z.infer<
  typeof OrganizationVerificationDecisionRequestSchema
>;

export interface OrganizationVerificationRequestResponse {
  id: string;
  organizationId: string;
  status: string;
  submittedByUserId: string;
  reviewerUserId: string | null;
  reviewerNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}
