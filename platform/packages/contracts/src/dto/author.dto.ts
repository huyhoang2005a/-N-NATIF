import { VerificationDocumentType } from "@r2m/domain";
import { z } from "zod";

const verificationDocumentTypeValues = Object.values(VerificationDocumentType) as [
  VerificationDocumentType,
  ...VerificationDocumentType[],
];

/** UC-VER-01 only allows PDF/JPG/PNG. 20 MB is an operational cap (not spec-mandated —
 * no size limit is given in the spec), matching the general "kiểm tra MIME/size cơ bản"
 * scope decided for Phase 2 (see plan B.0). */
const ALLOWED_DOCUMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;

/** UC-VER-01 step 1 — request a presigned upload URL before creating the request itself. */
export const RequestAuthorVerificationUploadSchema = z.object({
  documentType: z.enum(verificationDocumentTypeValues),
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: z.enum(ALLOWED_DOCUMENT_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_SIZE_BYTES),
});
export type RequestAuthorVerificationUploadRequest = z.infer<
  typeof RequestAuthorVerificationUploadSchema
>;

export interface AuthorVerificationUploadResponse {
  uploadUrl: string;
  storageObjectKey: string;
  expiresIn: number;
}

/** UC-VER-01 step 2 — submit the request referencing the object just uploaded. */
export const SubmitAuthorVerificationRequestSchema = z.object({
  affiliationOrgId: z.string().uuid(),
  submittedNote: z.string().trim().max(2000).optional(),
  documentStorageObjectKey: z.string().min(1),
  documentType: z.enum(verificationDocumentTypeValues),
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: z.enum(ALLOWED_DOCUMENT_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_SIZE_BYTES),
});
export type SubmitAuthorVerificationRequest = z.infer<typeof SubmitAuthorVerificationRequestSchema>;

/** UC-VER-02 business invariant: reject decision always carries a reason — same rule as
 * `OrganizationVerificationDecisionRequestSchema`. */
export const AuthorVerificationDecisionRequestSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    reviewerNote: z.string().trim().max(2000).optional(),
  })
  .refine((value) => value.decision !== "REJECT" || Boolean(value.reviewerNote?.length), {
    message: "reviewerNote is required when decision is REJECT.",
    path: ["reviewerNote"],
  });
export type AuthorVerificationDecisionRequest = z.infer<
  typeof AuthorVerificationDecisionRequestSchema
>;

export interface AuthorProfileResponse {
  userId: string;
  currentAffiliationOrgId: string | null;
  orcid: string | null;
  bio: string | null;
  expertiseTags: string[] | null;
  verificationStatus: string;
  verifiedAt: string | null;
}

export interface AuthorVerificationRequestResponse {
  id: string;
  authorUserId: string;
  affiliationOrgId: string;
  status: string;
  submittedNote: string | null;
  reviewerUserId: string | null;
  reviewerNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}
