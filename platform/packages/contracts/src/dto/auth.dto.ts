import { z } from "zod";
import type { AuthorVerificationStatus } from "@r2m/domain";

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

export const ChangePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(255),
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

export interface MeResponse {
  userId: string;
  primaryEmail: string;
  platformRole: string;
  displayName: string;
  emailVerified: boolean;
  avatarUrl: string | null;
  /**
   * `author_profile.verification_status` for the actor, or `"UNVERIFIED"` when the actor
   * has no `author_profile` row at all (the common case for e.g. platform admins/reviewers
   * who'll never have one). `"PENDING"` already means "has a request awaiting review" —
   * `author-verification.service.ts`'s `submit()` moves the profile to PENDING immediately,
   * so no separate "has pending request" flag is needed.
   */
  authorVerificationStatus: AuthorVerificationStatus;
}

export const ConfirmEmailVerificationRequestSchema = z.object({
  token: z.string().min(1),
});
export type ConfirmEmailVerificationRequest = z.infer<typeof ConfirmEmailVerificationRequestSchema>;

export interface EmailVerificationStatusResponse {
  emailVerified: boolean;
}
