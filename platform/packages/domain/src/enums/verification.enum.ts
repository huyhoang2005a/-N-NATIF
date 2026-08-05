export const VerificationRequestStatus = {
  PENDING: "PENDING",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;
export type VerificationRequestStatus =
  (typeof VerificationRequestStatus)[keyof typeof VerificationRequestStatus];

/** Author-side verification status is defined here for completeness; Phase 1 does not yet
 * ship the author-verification workflow (deferred to Phase 2 per architecture plan §14). */
export const AuthorVerificationStatus = {
  UNVERIFIED: "UNVERIFIED",
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  DECLINED: "DECLINED",
  SUSPENDED: "SUSPENDED",
} as const;
export type AuthorVerificationStatus =
  (typeof AuthorVerificationStatus)[keyof typeof AuthorVerificationStatus];

/** Shared by both organization and author verification documents (Phase 2). */
export const VerificationDocumentType = {
  IDENTITY_DOCUMENT: "IDENTITY_DOCUMENT",
  AFFILIATION_PROOF: "AFFILIATION_PROOF",
  ORGANIZATION_LETTER: "ORGANIZATION_LETTER",
  TAX_DOCUMENT: "TAX_DOCUMENT",
  OTHER: "OTHER",
} as const;
export type VerificationDocumentType =
  (typeof VerificationDocumentType)[keyof typeof VerificationDocumentType];
