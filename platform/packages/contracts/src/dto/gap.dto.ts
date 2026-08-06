import { GapSeverity, GapStatus } from "@r2m/domain";
import { z } from "zod";

const gapSeverityValues = Object.values(GapSeverity) as [GapSeverity, ...GapSeverity[]];
const gapStatusValues = Object.values(GapStatus) as [GapStatus, ...GapStatus[]];

/** UC-GAP-01 business invariant: "gap phải có cơ sở support (assessment/evidence/
 * citation)" — đã chốt (xem plan PHẦN D quyết định 11): chỉ cần ≥1 trong số
 * {`sourceAssessmentId` set, ≥1 `evidenceIds`} — không làm `gap_citation` trực tiếp ở
 * Phase 4 MVP (evidence luôn có ≥1 citation sẵn). Validate ở service, không phải zod. */
export const CreateGapRequestSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1),
  category: z.string().trim().max(120).optional(),
  severity: z.enum(gapSeverityValues),
  ownerUserId: z.string().uuid().optional(),
  dueDate: z.string().date().optional(),
  sourceAssessmentId: z.string().uuid().optional(),
  sourceAssessmentScoreId: z.string().uuid().optional(),
  evidenceIds: z.array(z.string().uuid()).default([]),
});
export type CreateGapRequest = z.infer<typeof CreateGapRequestSchema>;

export const UpdateGapRequestSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().min(1).optional(),
  category: z.string().trim().max(120).optional(),
  ownerUserId: z.string().uuid().optional(),
  dueDate: z.string().date().optional(),
});
export type UpdateGapRequest = z.infer<typeof UpdateGapRequestSchema>;

/** `chk_gap_resolution_fields` (DB): RESOLVED/ACCEPTED_RISK/CLOSED bắt buộc có
 * resolved_at + resolved_by_user_id — service tự set 2 cột đó, `resolutionNote` bắt
 * buộc ở tầng request khi target thuộc 3 trạng thái này (đúng UC-GAP-01 "Resolved yêu
 * cầu resolution note"). */
export const TransitionGapRequestSchema = z
  .object({
    toStatus: z.enum(gapStatusValues),
    resolutionNote: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) =>
      !["RESOLVED", "ACCEPTED_RISK", "CLOSED"].includes(value.toStatus) || Boolean(value.resolutionNote),
    {
      message: "resolutionNote is required when transitioning to RESOLVED/ACCEPTED_RISK/CLOSED.",
      path: ["resolutionNote"],
    },
  );
export type TransitionGapRequest = z.infer<typeof TransitionGapRequestSchema>;

export interface GapResponse {
  id: string;
  technologyCaseId: string;
  sourceAssessmentId: string | null;
  sourceAssessmentScoreId: string | null;
  title: string;
  description: string;
  category: string | null;
  severity: string;
  status: string;
  ownerUserId: string | null;
  dueDate: string | null;
  createdByUserId: string;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}
