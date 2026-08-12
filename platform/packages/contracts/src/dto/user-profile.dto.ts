import { z } from "zod";

export const UpdateProfileRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(200).optional(),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  jobTitle: z.string().trim().max(150).optional(),
  locale: z.string().trim().max(20).optional(),
  timezone: z.string().trim().max(50).optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export interface UserProfileResponse {
  userId: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  jobTitle: string | null;
  locale: string;
  timezone: string;
}

/** Not spec-mandated — explicit user-approved addition so UUIDs referenced elsewhere
 * (case members, verification applicants) can be resolved to a display name without
 * leaking anything else about the account (no email/phone/etc). */
export interface UserPublicInfoResponse {
  userId: string;
  displayName: string;
}

/** `GET /platform/users` (admin-only) — deliberately broader than `UserPublicInfoResponse`
 * since the caller is already a platform admin, but still no password/identity data. */
export interface PlatformUserResponse {
  userId: string;
  primaryEmail: string;
  displayName: string | null;
  platformRole: string;
  status: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}
