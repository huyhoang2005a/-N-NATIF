import { z } from "zod";

/** Phase 7 Sprint 7.4 — PII retention for `verification_document` (shared table between
 * org and author verification). No default duration is invented here — spec: "Data
 * retention và deletion phải có policy được pháp lý/tổ chức xác nhận" (no concrete number
 * given), so this is always an explicit platform-admin decision, never auto-computed. */
export const SetVerificationDocumentRetentionRequestSchema = z.object({
  retentionUntil: z.string().datetime().refine((value) => new Date(value).getTime() > Date.now(), {
    message: "retentionUntil must be in the future.",
  }),
});
export type SetVerificationDocumentRetentionRequest = z.infer<typeof SetVerificationDocumentRetentionRequestSchema>;

export interface VerificationDocumentRetentionResponse {
  id: string;
  retentionUntil: string;
}
