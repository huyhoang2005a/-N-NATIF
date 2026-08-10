import type { ContentFlagResponse, CreateContentFlagRequest, CreateModerationDecisionRequest, ModerationDecisionResponse } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertPlatformReviewerOrAdmin } from "@r2m/authz";
import type { Database } from "@r2m/database";
import { ConflictError, ErrorCode, ForbiddenError, ModerationAction, NotFoundError } from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../../database/database.module";
import { AuditService } from "../audit/audit.service";
import { OutboxService } from "../jobs/outbox.service";
import { ModerationRepository } from "./moderation.repository";

function toFlagResponse(row: {
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
  hiddenAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ContentFlagResponse {
  return {
    id: row.id,
    reporterUserId: row.reporterUserId,
    targetType: row.targetType,
    targetResourceId: row.targetResourceId,
    targetAnnotationId: row.targetAnnotationId,
    targetTechnologyProfileId: row.targetTechnologyProfileId,
    reasonCode: row.reasonCode,
    details: row.details,
    status: row.status,
    assignedReviewerUserId: row.assignedReviewerUserId,
    hiddenAt: row.hiddenAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDecisionResponse(row: {
  id: string;
  contentFlagId: string;
  reviewerUserId: string;
  action: string;
  rationale: string;
  createdAt: Date;
}): ModerationDecisionResponse {
  return {
    id: row.id,
    contentFlagId: row.contentFlagId,
    reviewerUserId: row.reviewerUserId,
    action: row.action,
    rationale: row.rationale,
    createdAt: row.createdAt.toISOString(),
  };
}

/** `action` → target `moderation_status` + `content_flag.status` mapping đã chốt (xem
 * comment ở `packages/domain/src/enums/platform-ops.enum.ts` `ModerationAction` — đối
 * chiếu UC-MOD-01/activity diagram/dbml enum, "DISMISS" trong 2 nguồn đầu là nói tắt cho
 * content_flag.status=DISMISSED, không phải action value). `RESTRICT_AUTHOR` không có cơ
 * chế khoá tài khoản thật (không có bảng nào trong dbml hỗ trợ) — chỉ ghi nhận qua
 * moderation_decision + audit, cố ý không suy diễn thêm (rule 1 CLAUDE.md). */
function targetModerationStatusFor(action: string): string | null {
  switch (action) {
    case ModerationAction.HIDE:
      return "HIDDEN";
    case ModerationAction.REMOVE:
      return "REMOVED";
    case ModerationAction.RESTORE:
      return "ACTIVE";
    case ModerationAction.KEEP:
    case ModerationAction.RESTRICT_AUTHOR:
    default:
      return null;
  }
}

function flagStatusFor(action: string): "CLOSED" | "DISMISSED" {
  return action === ModerationAction.KEEP ? "DISMISSED" : "CLOSED";
}

/** UC-MOD-01. Bounded context: Platform Operations (phần moderation, Phase 6). */
@Injectable()
export class ModerationService {
  constructor(
    private readonly repository: ModerationRepository,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  private async assertTargetExists(targetType: string, targetId: string): Promise<void> {
    const exists =
      targetType === "RESOURCE"
        ? await this.repository.findResourceById(targetId)
        : targetType === "ANNOTATION"
          ? await this.repository.findAnnotationById(targetId)
          : await this.repository.findTechnologyProfileById(targetId);
    if (!exists) {
      throw new NotFoundError(ErrorCode.MODERATION_INVALID_TARGET, "Target not found for this moderation target type.");
    }
  }

  async create(actor: ActorContext, input: CreateContentFlagRequest, requestIdHeader: string | null): Promise<ContentFlagResponse> {
    await this.assertTargetExists(input.targetType, input.targetId);

    const flag = await this.db.transaction(async (tx) => {
      const created = await this.repository.create(
        {
          reporterUserId: actor.userId,
          targetType: input.targetType as never,
          targetResourceId: input.targetType === "RESOURCE" ? input.targetId : undefined,
          targetAnnotationId: input.targetType === "ANNOTATION" ? input.targetId : undefined,
          targetTechnologyProfileId: input.targetType === "TECHNOLOGY_PROFILE" ? input.targetId : undefined,
          reasonCode: input.reasonCode,
          details: input.details,
        },
        tx,
      );

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          requestId: requestIdHeader,
          action: "content_flag.create",
          entityType: "content_flag",
          entityId: created.id,
          afterData: created,
        },
        tx,
      );

      await this.outboxService.append(
        "content_flag",
        created.id,
        { type: "ContentFlagCreated", contentFlagId: created.id, targetType: input.targetType, reporterUserId: actor.userId },
        tx,
      );

      return created;
    });

    return toFlagResponse(flag);
  }

  async listQueue(actor: ActorContext): Promise<ContentFlagResponse[]> {
    assertPlatformReviewerOrAdmin(actor);
    const rows = await this.repository.listQueue();
    return rows.map(toFlagResponse);
  }

  async claim(actor: ActorContext, id: string): Promise<ContentFlagResponse> {
    assertPlatformReviewerOrAdmin(actor);
    const flag = await this.repository.findById(id);
    if (!flag) {
      throw new NotFoundError(ErrorCode.MODERATION_INVALID_TARGET, "Content flag not found.");
    }

    const claimed = await this.db.transaction((tx) => this.repository.claim(id, actor.userId, tx));
    if (!claimed) {
      throw new ConflictError(ErrorCode.MODERATION_FLAG_ALREADY_CLAIMED, "This flag has already been claimed by another reviewer.");
    }
    return toFlagResponse(claimed);
  }

  /** Chỉ đúng reviewer đã claim (flag.assigned_reviewer_user_id) mới quyết định được —
   * "một reviewer thắng optimistic lock" (UC-MOD-01 luồng thay thế). */
  async decide(
    actor: ActorContext,
    id: string,
    input: CreateModerationDecisionRequest,
    requestIdHeader: string | null,
  ): Promise<ModerationDecisionResponse> {
    assertPlatformReviewerOrAdmin(actor);
    const flag = await this.repository.findById(id);
    if (!flag) {
      throw new NotFoundError(ErrorCode.MODERATION_INVALID_TARGET, "Content flag not found.");
    }
    if (flag.assignedReviewerUserId !== actor.userId) {
      throw new ForbiddenError(ErrorCode.AUTH_FORBIDDEN, "Only the reviewer who claimed this flag may record a decision.");
    }

    const targetModerationStatus = targetModerationStatusFor(input.action);
    const nextFlagStatus = flagStatusFor(input.action);

    const decision = await this.db.transaction(async (tx) => {
      const closed = await this.repository.close(
        id,
        actor.userId,
        {
          status: nextFlagStatus,
          closedAt: new Date(),
          ...(input.action === ModerationAction.HIDE ? { hiddenAt: new Date() } : {}),
        },
        tx,
      );
      if (!closed) {
        throw new ConflictError(ErrorCode.MODERATION_FLAG_ALREADY_RESOLVED, "This flag is no longer awaiting your decision.");
      }

      const createdDecision = await this.repository.createDecision(
        { contentFlagId: id, reviewerUserId: actor.userId, action: input.action as never, rationale: input.rationale },
        tx,
      );

      if (targetModerationStatus) {
        if (flag.targetType === "RESOURCE" && flag.targetResourceId) {
          await this.repository.updateResourceModerationStatus(flag.targetResourceId, targetModerationStatus, tx);
        } else if (flag.targetType === "ANNOTATION" && flag.targetAnnotationId) {
          await this.repository.updateAnnotationModerationStatus(flag.targetAnnotationId, targetModerationStatus, tx);
        } else if (flag.targetType === "TECHNOLOGY_PROFILE" && flag.targetTechnologyProfileId) {
          await this.repository.updateTechnologyProfileModerationStatus(flag.targetTechnologyProfileId, targetModerationStatus, tx);
        }
      }

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          requestId: requestIdHeader,
          action: "content_flag.decide",
          entityType: "content_flag",
          entityId: id,
          beforeData: flag,
          afterData: { flag: closed, decision: createdDecision },
        },
        tx,
      );

      await this.outboxService.append(
        "content_flag",
        id,
        {
          type: "ModerationDecisionRecorded",
          contentFlagId: id,
          targetType: flag.targetType,
          targetResourceId: flag.targetResourceId,
          targetAnnotationId: flag.targetAnnotationId,
          targetTechnologyProfileId: flag.targetTechnologyProfileId,
          reporterUserId: flag.reporterUserId,
          action: input.action,
        },
        tx,
      );

      return createdDecision;
    });

    return toDecisionResponse(decision);
  }
}
