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
  /** Freshly presigned GET URL resolved server-side on every read (never stored durably —
   * presigned URLs expire) — `null` when no avatar has been set. */
  avatarUrl: string | null;
}

/** Not spec-mandated — explicit user-approved addition. Same upload-then-confirm shape as
 * `RequestResourceUploadSchema`/`ResourceUploadResponse`. Only JPEG/PNG — matches exactly
 * what `@r2m/file-safety`'s `sniffMimeType` recognizes (no WEBP signature there); a WEBP
 * upload would pass this client-side check but always fail the server-side magic-byte
 * sniff, so it's excluded here rather than producing a confusing guaranteed-rejection. */
export const ALLOWED_AVATAR_MIME_TYPES = ["image/jpeg", "image/png"] as const;
export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

export const RequestAvatarUploadSchema = z.object({
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: z.enum(ALLOWED_AVATAR_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_AVATAR_SIZE_BYTES),
});
export type RequestAvatarUploadRequest = z.infer<typeof RequestAvatarUploadSchema>;

export interface AvatarUploadResponse {
  uploadUrl: string;
  storageObjectKey: string;
  expiresIn: number;
}

export const UpdateAvatarRequestSchema = z.object({
  storageObjectKey: z.string().min(1),
});
export type UpdateAvatarRequest = z.infer<typeof UpdateAvatarRequestSchema>;

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
