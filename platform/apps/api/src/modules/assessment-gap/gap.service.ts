import type { CreateGapRequest, GapResponse, GapSuggestion, TransitionGapRequest, UpdateGapRequest } from "@r2m/contracts";
import { GapSuggestionListSchema } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import type { Database } from "@r2m/database";
import {
  CaseMemberRole,
  ConflictError,
  ErrorCode,
  ForbiddenError,
  GapStatus,
  NotFoundError,
  TechnologyCaseStatus,
} from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../database/database.module";
import { AuditService } from "../platform-operations/audit/audit.service";
import { OutboxService } from "../platform-operations/jobs/outbox.service";
import { GeminiClient } from "../assistant/gemini.client";
import { TechnologyCaseRepository } from "../technology-case/technology-case.repository";
import { TechnologyCaseService } from "../technology-case/technology-case.service";
import { AssessmentRepository } from "./assessment.repository";
import { assertGapTransition } from "./domain/gap.state-machine";
import { GapRepository } from "./gap.repository";

const WRITE_ROLES: readonly string[] = [
  CaseMemberRole.OWNER,
  CaseMemberRole.TECHNICAL_MEMBER,
  CaseMemberRole.CASE_REVIEWER,
];
const RESOLUTION_STATUSES: readonly string[] = [GapStatus.RESOLVED, GapStatus.ACCEPTED_RISK, GapStatus.CLOSED];

export function toGapResponse(row: {
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
  resolvedAt: Date | null;
  resolutionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}): GapResponse {
  return {
    id: row.id,
    technologyCaseId: row.technologyCaseId,
    sourceAssessmentId: row.sourceAssessmentId,
    sourceAssessmentScoreId: row.sourceAssessmentScoreId,
    title: row.title,
    description: row.description,
    category: row.category,
    severity: row.severity,
    status: row.status,
    ownerUserId: row.ownerUserId,
    dueDate: row.dueDate,
    createdByUserId: row.createdByUserId,
    resolvedByUserId: row.resolvedByUserId,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolutionNote: row.resolutionNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

/** UC-GAP-01. Bounded context: Assessment & Gap (§9.6). */
@Injectable()
export class GapService {
  constructor(
    private readonly repository: GapRepository,
    private readonly caseRepository: TechnologyCaseRepository,
    private readonly caseService: TechnologyCaseService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    private readonly assessmentRepository: AssessmentRepository,
    private readonly geminiClient: GeminiClient,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  /** UC-GAP-01 actor "Case Reviewer/Owner/Technical Member" — liệt kê vai trò thay
   * phiên bằng "/", không phải điều kiện cộng dồn (rule 11 CLAUDE.md chỉ áp dụng AND
   * cho nhiều điều kiện trên cùng 1 actor). Không vi phạm rule 12 vì Phase 4 không có
   * bước "duyệt gap" nào để CASE_REVIEWER tự duyệt lại gap mình tạo. */
  private async assertWriteAllowed(technologyCaseId: string, actor: ActorContext): Promise<void> {
    const membership = await this.caseRepository.findActiveMembership(technologyCaseId, actor.userId);
    if (!membership || !WRITE_ROLES.includes(membership.role)) {
      throw new ForbiddenError(
        ErrorCode.AUTH_FORBIDDEN,
        "Only an active case OWNER, TECHNICAL_MEMBER or CASE_REVIEWER may create or edit a gap.",
      );
    }
  }

  /** Đã chốt (xem plan PHẦN D quyết định 11): ≥1 nguồn support trong số
   * {`sourceAssessmentId` set, ≥1 `evidenceIds`} — không làm `gap_citation` trực tiếp ở
   * Phase 4 MVP (evidence luôn có ≥1 citation sẵn, đủ để thoả "gap phải có cơ sở"). */
  async create(
    actor: ActorContext,
    technologyCaseId: string,
    input: CreateGapRequest,
    requestIdHeader: string | null,
  ): Promise<GapResponse> {
    const technologyCase = await this.caseRepository.findById(technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.assertWriteAllowed(technologyCaseId, actor);

    if (!input.sourceAssessmentId && input.evidenceIds.length === 0) {
      throw new ConflictError(
        ErrorCode.GAP_MISSING_SUPPORT,
        "A gap needs at least one support source: a linked assessment or at least one linked evidence.",
      );
    }

    const gap = await this.db.transaction(async (tx) => {
      const isFirstGap = !(await this.repository.hasAnyGap(technologyCaseId, tx));

      const created = await this.repository.create(
        {
          technologyCaseId,
          sourceAssessmentId: input.sourceAssessmentId,
          sourceAssessmentScoreId: input.sourceAssessmentScoreId,
          title: input.title,
          description: input.description,
          category: input.category,
          severity: input.severity,
          ownerUserId: input.ownerUserId,
          dueDate: input.dueDate,
          createdByUserId: actor.userId,
        },
        tx,
      );
      await this.repository.createEvidenceLinks(created.id, input.evidenceIds, tx);

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "gap.create",
          entityType: "gap_record",
          entityId: created.id,
          afterData: { ...created, evidenceIds: input.evidenceIds },
        },
        tx,
      );

      if (created.severity === "CRITICAL") {
        await this.outboxService.append(
          "gap_record",
          created.id,
          {
            type: "CriticalGapRaised",
            gapRecordId: created.id,
            technologyCaseId,
            createdByUserId: actor.userId,
          },
          tx,
        );
      }

      if (isFirstGap && technologyCase.lifecycleStatus === TechnologyCaseStatus.UNDER_ASSESSMENT) {
        await this.caseService.applyTransition(
          tx,
          actor,
          technologyCase,
          TechnologyCaseStatus.GAP_IDENTIFIED,
          "First gap identified",
          requestIdHeader,
        );
      }

      return created;
    });

    return toGapResponse(gap);
  }

  async update(
    actor: ActorContext,
    gapId: string,
    input: UpdateGapRequest,
    requestIdHeader: string | null,
  ): Promise<GapResponse> {
    const gap = await this.repository.findById(gapId);
    if (!gap) {
      throw new NotFoundError(ErrorCode.GAP_NOT_FOUND, "Gap not found.");
    }
    const technologyCase = await this.caseRepository.findById(gap.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.assertWriteAllowed(gap.technologyCaseId, actor);

    const updated = await this.db.transaction(async (tx) => {
      const result = await this.repository.update(gapId, gap.version, input, tx);
      if (!result) {
        throw new ConflictError(ErrorCode.GAP_INVALID_TRANSITION, "Gap was modified concurrently — retry.");
      }
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "gap.update",
          entityType: "gap_record",
          entityId: gapId,
          beforeData: gap,
          afterData: result,
        },
        tx,
      );
      return result;
    });

    return toGapResponse(updated);
  }

  /** §3.5 (Phase 3 spirit, áp dụng tương tự cho gap): người tạo, case OWNER,
   * CASE_REVIEWER, hoặc chính `gap.ownerUserId` được gán đều transition được — không có
   * bước "duyệt lại" nào ở đây nên không xung đột rule 12. */
  async transition(
    actor: ActorContext,
    gapId: string,
    input: TransitionGapRequest,
    requestIdHeader: string | null,
  ): Promise<GapResponse> {
    const gap = await this.repository.findById(gapId);
    if (!gap) {
      throw new NotFoundError(ErrorCode.GAP_NOT_FOUND, "Gap not found.");
    }
    const technologyCase = await this.caseRepository.findById(gap.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }

    const membership = await this.caseRepository.findActiveMembership(gap.technologyCaseId, actor.userId);
    const isAllowed =
      gap.createdByUserId === actor.userId ||
      gap.ownerUserId === actor.userId ||
      membership?.role === CaseMemberRole.OWNER ||
      membership?.role === CaseMemberRole.CASE_REVIEWER;
    if (!isAllowed) {
      throw new ForbiddenError(
        ErrorCode.AUTH_FORBIDDEN,
        "Only the gap's creator/owner, case OWNER or CASE_REVIEWER may transition a gap.",
      );
    }

    assertGapTransition(gap.status as GapStatus, input.toStatus as GapStatus);

    const isResolution = RESOLUTION_STATUSES.includes(input.toStatus);
    const updated = await this.db.transaction(async (tx) => {
      const result = await this.repository.update(
        gapId,
        gap.version,
        {
          status: input.toStatus as never,
          resolutionNote: input.resolutionNote ?? null,
          resolvedAt: isResolution ? new Date() : null,
          resolvedByUserId: isResolution ? actor.userId : null,
        },
        tx,
      );
      if (!result) {
        throw new ConflictError(ErrorCode.GAP_INVALID_TRANSITION, "Gap was modified concurrently — retry.");
      }
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "gap.transition",
          entityType: "gap_record",
          entityId: gapId,
          beforeData: { status: gap.status },
          afterData: { status: result.status, resolutionNote: result.resolutionNote },
        },
        tx,
      );
      return result;
    });

    return toGapResponse(updated);
  }

  async getById(actor: ActorContext, id: string): Promise<GapResponse> {
    const gap = await this.repository.findById(id);
    if (!gap) {
      throw new NotFoundError(ErrorCode.GAP_NOT_FOUND, "Gap not found.");
    }
    const technologyCase = await this.caseRepository.findById(gap.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.caseService.assertVisible(actor, technologyCase);
    return toGapResponse(gap);
  }

  async listByCase(actor: ActorContext, technologyCaseId: string): Promise<GapResponse[]> {
    const technologyCase = await this.caseRepository.findById(technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.caseService.assertVisible(actor, technologyCase);
    const rows = await this.repository.listByCase(technologyCaseId);
    return rows.map(toGapResponse);
  }

  /** AI-copilot draft (2026-08, demo phase) — same write-authorization gate as
   * `create()` (a suggestion is only useful to someone who could actually act on it), but
   * writes nothing: returns candidate `GapSuggestion`s grounded in this case's real latest
   * assessment scores + existing gap titles (so the model doesn't propose duplicates),
   * for the user to review/edit and submit through the unmodified `create()` above. */
  async suggestDrafts(actor: ActorContext, technologyCaseId: string): Promise<GapSuggestion[]> {
    const technologyCase = await this.caseRepository.findById(technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.assertWriteAllowed(technologyCaseId, actor);

    if (!this.geminiClient.isConfigured()) {
      throw new ConflictError(ErrorCode.ASSISTANT_UNAVAILABLE, "AI copilot is not configured on this environment.");
    }

    const assessments = await this.assessmentRepository.listByCase(technologyCaseId);
    const latestAssessment = assessments.find((a) => a.status === "APPROVED" || a.status === "SUBMITTED") ?? assessments[0];
    const scoreLines = latestAssessment
      ? (await this.assessmentRepository.findScoresWithCriteriaByAssessment(latestAssessment.id))
          .map((s) => `- ${s.criterion.title} (mã ${s.criterion.criterionCode}): ${s.score}/${s.criterion.maxScore} — ${s.rationale}`)
          .join("\n")
      : "(Chưa có đánh giá nào cho case này.)";

    const existingGaps = await this.repository.listByCase(technologyCaseId);
    const existingGapLines = existingGaps.length > 0 ? existingGaps.map((g) => `- ${g.title} (${g.severity})`).join("\n") : "(Chưa có gap nào.)";

    const systemInstruction = [
      "Bạn là trợ lý gợi ý gap-analysis (khoảng trống công nghệ) cho nền tảng R2M — chuyển giao công nghệ từ nghiên cứu sang doanh nghiệp.",
      "Chỉ dựa vào thông tin case/điểm đánh giá được cung cấp — không bịa số liệu, không bịa tên tổ chức/người liên quan.",
      "Đề xuất 1-4 gap KHÔNG trùng với danh sách gap đã có. Mỗi gap phải bám sát tiêu chí đánh giá có điểm thấp trong dữ liệu được cung cấp.",
      "severity chỉ được là một trong: LOW, MEDIUM, HIGH, CRITICAL.",
      "rationale: giải thích ngắn gọn vì sao đề xuất gap này, dựa trên điểm/tiêu chí nào.",
    ].join(" ");

    const userPrompt = [
      `Case: ${technologyCase.title}`,
      technologyCase.description ? `Mô tả case: ${technologyCase.description}` : null,
      `Điểm đánh giá theo tiêu chí:\n${scoreLines}`,
      `Gap đã ghi nhận:\n${existingGapLines}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const responseSchema = {
      type: "ARRAY",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: { type: "STRING" },
          category: { type: "STRING" },
          severity: { type: "STRING", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
          rationale: { type: "STRING" },
        },
        required: ["title", "description", "severity", "rationale"],
      },
    };

    let raw: unknown;
    try {
      raw = await this.geminiClient.generateJson(systemInstruction, userPrompt, responseSchema);
    } catch {
      throw new ConflictError(ErrorCode.ASSISTANT_UNAVAILABLE, "AI copilot could not generate suggestions right now — try again shortly.");
    }

    const parsed = GapSuggestionListSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ConflictError(ErrorCode.ASSISTANT_UNAVAILABLE, "AI copilot returned an unexpected response — try again.");
    }
    return parsed.data;
  }
}
