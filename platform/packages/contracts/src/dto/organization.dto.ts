import { OrganizationMemberRole, OrganizationType } from "@r2m/domain";
import { z } from "zod";
import { MinimumOrganizationVerificationDocumentTypeSchema } from "./organization-verification.dto";

const organizationTypeValues = Object.values(OrganizationType) as [
  OrganizationType,
  ...OrganizationType[],
];

/** UC-ORG-01 input: tên, loại, website, mã định danh/tax code, email + password của owner. */
export const RegisterOrganizationRequestSchema = z.object({
  organizationName: z.string().trim().min(2).max(255),
  organizationType: z.enum(organizationTypeValues),
  website: z.string().url().optional(),
  taxCode: z.string().trim().max(100).optional(),
  institutionIdentifier: z.string().trim().max(150).optional(),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8).max(255),
  ownerDisplayName: z.string().trim().min(1).max(200),
});
export type RegisterOrganizationRequest = z.infer<typeof RegisterOrganizationRequestSchema>;

/** Registration is multipart now — the minimum-required verification document (mục 4,
 * "vá lỗ hổng xác minh" plan follow-up) is submitted in the same call, not a separate
 * post-registration step. Same field set as `RegisterOrganizationRequestSchema` plus the
 * document-type form field alongside the uploaded `file`. */
export const RegisterOrganizationWithDocumentSchema = RegisterOrganizationRequestSchema.extend({
  documentType: MinimumOrganizationVerificationDocumentTypeSchema,
});
export type RegisterOrganizationWithDocumentRequest = z.infer<
  typeof RegisterOrganizationWithDocumentSchema
>;

/** Self-service join request for an ALREADY-registered organization (matched by email
 * domain) — new account, PENDING_APPROVAL membership until an ORG_OWNER/ORG_ADMIN decides. */
export const JoinOrganizationRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(255),
});
export type JoinOrganizationRequest = z.infer<typeof JoinOrganizationRequestSchema>;

/** SUC-02: invite a member. ORG_OWNER can only change hands via the dedicated transfer flow. */
export const InviteMemberRequestSchema = z.object({
  email: z.string().email(),
  role: z.enum([OrganizationMemberRole.ORG_ADMIN, OrganizationMemberRole.MEMBER]),
});
export type InviteMemberRequest = z.infer<typeof InviteMemberRequestSchema>;

export const UpdateMemberRequestSchema = z
  .object({
    role: z.enum([OrganizationMemberRole.ORG_ADMIN, OrganizationMemberRole.MEMBER]).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "LEFT"]).optional(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: "At least one of role or status must be provided.",
  });
export type UpdateMemberRequest = z.infer<typeof UpdateMemberRequestSchema>;

export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  type: OrganizationType;
  status: string;
  website: string | null;
  taxCode: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/** `GET /me/pending-memberships` — surfaces self-join requests still awaiting an
 * ORG_OWNER/ORG_ADMIN decision, since `GET /organizations` (listMine) only returns
 * organizations the actor is an ACTIVE member of. */
export interface PendingMembershipResponse {
  organizationId: string;
  organizationName: string;
  status: string;
}

export interface OrganizationMemberResponse {
  id: string;
  organizationId: string;
  userId: string;
  displayName: string;
  email: string;
  role: OrganizationMemberRole;
  status: string;
  invitedAt: string | null;
  joinedAt: string | null;
}
