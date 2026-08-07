import { z } from "zod";

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

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
}

export const ConfirmEmailVerificationRequestSchema = z.object({
  token: z.string().min(1),
});
export type ConfirmEmailVerificationRequest = z.infer<typeof ConfirmEmailVerificationRequestSchema>;

export interface EmailVerificationStatusResponse {
  emailVerified: boolean;
}
