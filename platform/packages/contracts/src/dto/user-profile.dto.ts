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
