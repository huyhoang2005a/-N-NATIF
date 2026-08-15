import { DependencyType, PriorityLevel, RoadmapReviewDecision } from "@r2m/domain";
import { z } from "zod";

const dependencyTypeValues = Object.values(DependencyType) as [DependencyType, ...DependencyType[]];
const priorityLevelValues = Object.values(PriorityLevel) as [PriorityLevel, ...PriorityLevel[]];
const roadmapReviewDecisionValues = Object.values(RoadmapReviewDecision) as [
  RoadmapReviewDecision,
  ...RoadmapReviewDecision[],
];

export const CreateRoadmapRequestSchema = z.object({
  title: z.string().trim().min(1).max(255),
  objective: z.string().trim().optional(),
});
export type CreateRoadmapRequest = z.infer<typeof CreateRoadmapRequestSchema>;

export const CreateMilestoneRequestSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional(),
  priority: z.enum(priorityLevelValues).optional(),
  startDate: z.string().date().optional(),
  dueDate: z.string().date().optional(),
  ownerUserId: z.string().uuid().optional(),
});
export type CreateMilestoneRequest = z.infer<typeof CreateMilestoneRequestSchema>;

export const CreateTaskRequestSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional(),
  priority: z.enum(priorityLevelValues).optional(),
  assigneeUserId: z.string().uuid().optional(),
  startDate: z.string().date().optional(),
  dueDate: z.string().date().optional(),
});
export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>;

/** `chk_dependency_not_self` (DB) + cycle detection (app layer, xem
 * `domain/cycle-detection.ts`) — cả 2 validate ở service, không phải zod (cần đọc toàn
 * bộ dependency hiện có của roadmap). */
export const CreateDependencyRequestSchema = z.object({
  predecessorMilestoneId: z.string().uuid(),
  successorMilestoneId: z.string().uuid(),
  dependencyType: z.enum(dependencyTypeValues).optional(),
  lagDays: z.number().int().optional(),
});
export type CreateDependencyRequest = z.infer<typeof CreateDependencyRequestSchema>;

export const LinkMilestoneGapRequestSchema = z.object({
  gapRecordId: z.string().uuid(),
});
export type LinkMilestoneGapRequest = z.infer<typeof LinkMilestoneGapRequestSchema>;

/** Đã chốt sau review (2026-08-06, rule 12 CLAUDE.md): chỉ CASE_REVIEWER được gọi —
 * validate ở service. `decision=APPROVED` phải qua gate (không CRITICAL gap mở, có ≥1
 * milestone — `validate_roadmap_approval` port sang app layer) trước khi roadmap +
 * case chuyển trạng thái. */
export const CreateRoadmapReviewRequestSchema = z.object({
  decision: z.enum(roadmapReviewDecisionValues),
  comment: z.string().trim().max(2000).optional(),
});
export type CreateRoadmapReviewRequest = z.infer<typeof CreateRoadmapReviewRequestSchema>;

/** AI-copilot draft output (2026-08, demo phase Gemini feature) — a *suggestion*, never
 * persisted directly. Mirrors `CreateRoadmapRequestSchema`/`CreateMilestoneRequestSchema`/
 * `CreateTaskRequestSchema` shapes (minus fields a suggestion can't originate — dates,
 * assignees) so the user's accepted draft maps 1:1 onto the existing, unmodified
 * create-roadmap → create-milestone → create-task call sequence. `addressesGapIds`
 * references real `gap_record.id` values the caller supplied as context — the server
 * validates every id against that same list before returning, dropping any the model
 * invented, so the client never has to re-check id validity itself. */
export const RoadmapSuggestionSchema = z.object({
  title: z.string().trim().min(1).max(255),
  objective: z.string().trim().min(1),
  milestones: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(255),
        description: z.string().trim().min(1),
        addressesGapIds: z.array(z.string().uuid()).default([]),
        tasks: z
          .array(
            z.object({
              title: z.string().trim().min(1).max(255),
              description: z.string().trim().min(1),
            }),
          )
          .min(1)
          .max(5),
      }),
    )
    .min(1)
    .max(6),
});
export type RoadmapSuggestion = z.infer<typeof RoadmapSuggestionSchema>;

export interface RoadmapResponse {
  id: string;
  technologyCaseId: string;
  versionNo: number;
  title: string;
  objective: string | null;
  status: string;
  createdByUserId: string;
  submittedByUserId: string | null;
  approvedByUserId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface RoadmapMilestoneResponse {
  id: string;
  roadmapId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  ownerUserId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoadmapTaskResponse {
  id: string;
  milestoneId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeUserId: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MilestoneDependencyResponse {
  id: string;
  predecessorMilestoneId: string;
  successorMilestoneId: string;
  dependencyType: string;
  lagDays: number;
  createdAt: string;
}

export interface RoadmapReviewResponse {
  id: string;
  roadmapId: string;
  reviewerUserId: string;
  decision: string;
  comment: string | null;
  createdAt: string;
}
