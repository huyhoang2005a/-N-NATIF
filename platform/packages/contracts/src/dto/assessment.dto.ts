import { z } from "zod";

/** UC-ASM-01 input: "Framework version" — optional, mặc định dùng framework `ACTIVE`
 * hiện hành nếu không truyền (assessment khoá version framework tại thời điểm tạo, xem
 * §9.6 "Framework/criterion có version và immutable sau khi được dùng"). */
export const CreateAssessmentRequestSchema = z.object({
  frameworkId: z.string().uuid().optional(),
});
export type CreateAssessmentRequest = z.infer<typeof CreateAssessmentRequestSchema>;

/** UC-ASM-01 business invariant: "Mỗi score có rationale và liên kết evidence/citation"
 * — validate criterion.requiresEvidence/requiresCitation ở service (cần đọc criterion từ
 * DB), không phải ở zod. `evidenceIds`/`citationIds` trỏ tới `evidence`/`citation` đã tồn
 * tại (Phase 3), không tạo mới ở đây. */
export const UpsertAssessmentScoreRequestSchema = z.object({
  score: z.number(),
  rationale: z.string().trim().min(1),
  evidenceIds: z.array(z.string().uuid()).default([]),
  citationIds: z.array(z.string().uuid()).default([]),
});
export type UpsertAssessmentScoreRequest = z.infer<typeof UpsertAssessmentScoreRequestSchema>;

/** Đã chốt sau review (2026-08-06, rule 12 CLAUDE.md): chỉ CASE_REVIEWER được gọi —
 * validate ở service, không phải ở đây. Mirror pattern
 * `OrganizationVerificationDecisionRequestSchema`. */
export const AssessmentDecisionRequestSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    reason: z.string().trim().max(2000).optional(),
  })
  .refine((value) => value.decision !== "REJECT" || Boolean(value.reason?.length), {
    message: "reason is required when decision is REJECT.",
    path: ["reason"],
  });
export type AssessmentDecisionRequest = z.infer<typeof AssessmentDecisionRequestSchema>;

export interface AssessmentScoreResponse {
  id: string;
  assessmentId: string;
  criterionId: string;
  score: number;
  rationale: string;
  evidenceIds: string[];
  citationIds: string[];
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReadinessAssessmentResponse {
  id: string;
  technologyCaseId: string;
  frameworkId: string;
  status: string;
  compositeScore: number | null;
  createdByUserId: string;
  submittedByUserId: string | null;
  approvedByUserId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}
