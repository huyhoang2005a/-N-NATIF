import { z } from "zod";

// ---------- Sprint 5.1: Company Profile ----------

export const CreateCompanyProfileRequestSchema = z.object({
  industryCode: z.string().trim().max(100).optional(),
  companySize: z.string().trim().max(50).optional(),
  description: z.string().trim().max(4000).optional(),
});
export type CreateCompanyProfileRequest = z.infer<typeof CreateCompanyProfileRequestSchema>;

export const UpdateCompanyProfileRequestSchema = CreateCompanyProfileRequestSchema;
export type UpdateCompanyProfileRequest = z.infer<typeof UpdateCompanyProfileRequestSchema>;

export interface CompanyProfileResponse {
  organizationId: string;
  publicSlug: string;
  industryCode: string | null;
  companySize: string | null;
  description: string | null;
  contactUserId: string | null;
  createdAt: string;
  updatedAt: string;
}
