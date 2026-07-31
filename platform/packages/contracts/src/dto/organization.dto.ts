import { OrganizationMemberRole, OrganizationType } from "@r2m/domain";
import { z } from "zod";

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

export interface OrganizationMemberResponse {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationMemberRole;
  status: string;
  invitedAt: string | null;
  joinedAt: string | null;
}
