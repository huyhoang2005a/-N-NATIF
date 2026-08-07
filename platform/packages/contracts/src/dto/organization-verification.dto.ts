import { z } from "zod";
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE_BYTES } from "./author.dto";

/**
 * Minimum-qualifying document types for organization verification (mục 1 of the
 * "vá lỗ hổng xác minh" plan, 2026-08-07): a resubmission or open-request attachment must
 * be one of these to close VERIFICATION_MISSING_DOCUMENT — other VerificationDocumentType
 * values are not accepted through these two endpoints, since their only purpose is to
 * satisfy the minimum requirement (no supplementary-document upload was requested).
 */
export const MinimumOrganizationVerificationDocumentTypeSchema = z.enum([
  "TAX_DOCUMENT",
  "ORGANIZATION_LETTER",
]);
export type MinimumOrganizationVerificationDocumentType = z.infer<
  typeof MinimumOrganizationVerificationDocumentTypeSchema
>;

/** Multipart form field alongside the uploaded file — see OrganizationVerificationRequestController. */
export const SubmitOrganizationVerificationDocumentSchema = z.object({
  documentType: MinimumOrganizationVerificationDocumentTypeSchema,
});
export type SubmitOrganizationVerificationDocumentRequest = z.infer<
  typeof SubmitOrganizationVerificationDocumentSchema
>;

export { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE_BYTES };

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

/** Reviewer-facing document listing — each entry carries its own ready-to-use signed
 * download URL so the client never needs a second round trip per document. */
export interface OrganizationVerificationDocumentResponse {
  id: string;
  documentType: string;
  originalFilename: string;
  downloadUrl: string;
  expiresIn: number;
}
