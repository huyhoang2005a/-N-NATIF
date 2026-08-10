import { ModerationAction, ModerationTargetType } from "@r2m/domain";
import { z } from "zod";

const moderationTargetTypeValues = Object.values(ModerationTargetType) as [ModerationTargetType, ...ModerationTargetType[]];
const moderationActionValues = Object.values(ModerationAction) as [ModerationAction, ...ModerationAction[]];

/** 1 `targetId` thay vì 3 field FK nullable riêng — client chỉ cần biết loại + id, service
 * tự map sang đúng cột `target_resource_id`/`target_annotation_id`/
 * `target_technology_profile_id` (khớp CHECK `chk_content_flag_target_matches_type`). */
export const CreateContentFlagRequestSchema = z.object({
  targetType: z.enum(moderationTargetTypeValues),
  targetId: z.string().uuid(),
  reasonCode: z.string().trim().min(1).max(100),
  details: z.string().trim().min(1),
});
export type CreateContentFlagRequest = z.infer<typeof CreateContentFlagRequestSchema>;

export const CreateModerationDecisionRequestSchema = z.object({
  action: z.enum(moderationActionValues),
  rationale: z.string().trim().min(1),
});
export type CreateModerationDecisionRequest = z.infer<typeof CreateModerationDecisionRequestSchema>;

export interface ContentFlagResponse {
  id: string;
  reporterUserId: string;
  targetType: string;
  targetResourceId: string | null;
  targetAnnotationId: string | null;
  targetTechnologyProfileId: string | null;
  reasonCode: string;
  details: string;
  status: string;
  assignedReviewerUserId: string | null;
  hiddenAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModerationDecisionResponse {
  id: string;
  contentFlagId: string;
  reviewerUserId: string;
  action: string;
  rationale: string;
  createdAt: string;
}
