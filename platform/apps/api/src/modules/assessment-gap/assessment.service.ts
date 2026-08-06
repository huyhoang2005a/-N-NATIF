import type {
  AssessmentDecisionRequest,
  AssessmentScoreResponse,
  CreateAssessmentRequest,
  ReadinessAssessmentResponse,
  UpsertAssessmentScoreRequest,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import type { Database } from "@r2m/database";
import {
  AssessmentStatus,
  CaseMemberRole,
  ConflictError,
  ErrorCode,
  ForbiddenError,
  NotFoundError,
  TechnologyCaseStatus,
} from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../database/database.module";
import { AuditService } from "../platform-operations/audit/audit.service";
import { OutboxService } from "../platform-operations/jobs/outbox.service";
import { TechnologyCaseRepository } from "../technology-case/technology-case.repository";
import { TechnologyCaseService } from "../technology-case/technology-case.service";
import { calculateCompositeScore } from "./domain/composite-score";
import { assertAssessmentTransition } from "./domain/assessment.state-machine";
import { AssessmentFrameworkRepository } from "./assessment-framework.repository";
import { AssessmentRepository } from "./assessment.repository";

const WRITE_ROLES: readonly string[] = [CaseMemberRole.OWNER, CaseMemberRole.TECHNICAL_MEMBER];

function toAssessmentResponse(row: {
  id: string;
  technologyCaseId: string;
  frameworkId: string;
  status: string;
  compositeScore: string | null;
  createdByUserId: string;
  submittedByUserId: string | null;
  approvedByUserId: string | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}): ReadinessAssessmentResponse {
  return {
    id: row.id,
    technologyCaseId: row.technologyCaseId,
    frameworkId: row.frameworkId,
    status: row.status,
    compositeScore: row.compositeScore === null ? null : Number(row.compositeScore),
    createdByUserId: row.createdByUserId,
    submittedByUserId: row.submittedByUserId,
    approvedByUserId: row.approvedByUserId,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

function toScoreResponse(row: {
  id: string;
  assessmentId: string;
  criterionId: string;
  score: string;
  rationale: string;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  evidenceLinks?: { evidenceId: string }[];
  citationLinks?: { citationId: string }[];
}): AssessmentScoreResponse {
  return {
    id: row.id,
    assessmentId: row.assessmentId,
    criterionId: row.criterionId,
    score: Number(row.score),
    rationale: row.rationale,
    evidenceIds: (row.evidenceLinks ?? []).map((l) => l.evidenceId),
    citationIds: (row.citationLinks ?? []).map((l) => l.citationId),
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** UC-ASM-01. Bounded context: Assessment & Gap (§9.6). */
@Injectable()
export class AssessmentService {
  constructor(
    private readonly repository: AssessmentRepository,
    private readonly frameworkRepository: AssessmentFrameworkRepository,
    private readonly caseRepository: TechnologyCaseRepository,
    private readonly caseService: TechnologyCaseService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  /** Đã chốt sau review (2026-08-06, theo rule 12 CLAUDE.md) — chỉ OWNER/TECHNICAL_MEMBER
   * được tạo/nhập điểm/submit assessment (nhóm "làm"), CASE_REVIEWER không được (sẽ tự
   * duyệt chính bước mình vừa nhập nếu cho phép). */
  private async assertWriteAllowed(technologyCaseId: string, actor: ActorContext): Promise<void> {
    const membership = await this.caseRepository.findActiveMembership(technologyCaseId, actor.userId);
    if (!membership || !WRITE_ROLES.includes(membership.role)) {
      throw new ForbiddenError(
        ErrorCode.AUTH_FORBIDDEN,
        "Only an active case OWNER or TECHNICAL_MEMBER may create or edit an assessment.",
      );
    }
  }

  async create(
    actor: ActorContext,
    technologyCaseId: string,
    input: CreateAssessmentRequest,
    requestIdHeader: string | null,
  ): Promise<ReadinessAssessmentResponse> {
    const technologyCase = await this.caseRepository.findById(technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.assertWriteAllowed(technologyCaseId, actor);

    const framework = input.frameworkId
      ? await this.frameworkRepository.findById(input.frameworkId)
      : await this.frameworkRepository.findActiveFramework();
    if (!framework) {
      throw new NotFoundError(ErrorCode.ASSESSMENT_FRAMEWORK_NOT_FOUND, "No usable assessment framework found.");
    }

    const assessment = await this.db.transaction(async (tx) => {
      const created = await this.repository.create(
        { technologyCaseId, frameworkId: framework.id, createdByUserId: actor.userId },
        tx,
      );
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "assessment.create",
          entityType: "readiness_assessment",
          entityId: created.id,
          afterData: created,
        },
        tx,
      );
      return created;
    });

    return toAssessmentResponse(assessment);
  }

  async upsertScore(
    actor: ActorContext,
    assessmentId: string,
    criterionId: string,
    input: UpsertAssessmentScoreRequest,
    requestIdHeader: string | null,
  ): Promise<AssessmentScoreResponse> {
    const assessment = await this.repository.findById(assessmentId);
    if (!assessment) {
      throw new NotFoundError(ErrorCode.ASSESSMENT_NOT_FOUND, "Assessment not found.");
    }
    const technologyCase = await this.caseRepository.findById(assessment.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.assertWriteAllowed(assessment.technologyCaseId, actor);

    if (assessment.status !== AssessmentStatus.DRAFT) {
      throw new ConflictError(
        ErrorCode.ASSESSMENT_INVALID_TRANSITION,
        "Scores can only be entered/edited while the assessment is DRAFT.",
        { status: assessment.status },
      );
    }

    const criterion = await this.frameworkRepository.findCriterionById(criterionId);
    if (!criterion) {
      throw new NotFoundError(ErrorCode.ASSESSMENT_CRITERION_NOT_FOUND, "Criterion not found.");
    }
    if (criterion.frameworkId !== assessment.frameworkId) {
      throw new ConflictError(
        ErrorCode.ASSESSMENT_CRITERION_FRAMEWORK_MISMATCH,
        "Criterion does not belong to this assessment's framework.",
        { criterionId, frameworkId: assessment.frameworkId },
      );
    }

    const min = Number(criterion.minScore);
    const max = Number(criterion.maxScore);
    if (input.score < min || input.score > max) {
      throw new ConflictError(
        ErrorCode.ASSESSMENT_SCORE_OUT_OF_RANGE,
        `Score must be between ${min} and ${max} for criterion ${criterion.criterionCode}.`,
        { min, max },
      );
    }

    const score = await this.db.transaction(async (tx) => {
      const upserted = await this.repository.upsertScore(
        {
          assessmentId,
          criterionId,
          score: input.score.toString(),
          rationale: input.rationale,
          createdByUserId: actor.userId,
          updatedByUserId: actor.userId,
        },
        tx,
      );
      await this.repository.replaceScoreEvidenceLinks(upserted.id, input.evidenceIds, tx);
      await this.repository.replaceScoreCitationLinks(upserted.id, input.citationIds, tx);
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "assessment.upsert_score",
          entityType: "assessment_score",
          entityId: upserted.id,
          afterData: { ...upserted, evidenceIds: input.evidenceIds, citationIds: input.citationIds },
        },
        tx,
      );
      return upserted;
    });

    return toScoreResponse({ ...score, evidenceLinks: input.evidenceIds.map((evidenceId) => ({ evidenceId })), citationLinks: input.citationIds.map((citationId) => ({ citationId })) });
  }

  /** Port `validate_and_calculate_assessment_submission()` (SQL mẫu) sang app layer —
   * chạy lại ở CẢ submit lẫn decision=APPROVE (đúng SQL trigger fire cho cả 2 target,
   * "Composite score tái tính nhất quán" — acceptance criteria UC-ASM-01). */
  private async validateCompletenessAndComputeScore(assessmentId: string): Promise<number> {
    const scores = await this.repository.findScoresWithCriteriaByAssessment(assessmentId);
    if (scores.length === 0) {
      throw new ConflictError(ErrorCode.ASSESSMENT_HAS_NO_SCORES, "Assessment has no scores.");
    }

    for (const s of scores) {
      if (s.criterion.requiresEvidence && s.evidenceLinks.length === 0) {
        throw new ConflictError(
          ErrorCode.ASSESSMENT_SCORE_MISSING_EVIDENCE,
          `Criterion ${s.criterion.criterionCode} requires at least one linked evidence.`,
          { criterionId: s.criterionId },
        );
      }
      if (s.criterion.requiresCitation && s.citationLinks.length === 0) {
        throw new ConflictError(
          ErrorCode.ASSESSMENT_SCORE_MISSING_CITATION,
          `Criterion ${s.criterion.criterionCode} requires at least one linked citation.`,
          { criterionId: s.criterionId },
        );
      }
    }

    return calculateCompositeScore(
      scores.map((s) => ({
        score: Number(s.score),
        minScore: Number(s.criterion.minScore),
        maxScore: Number(s.criterion.maxScore),
        weight: Number(s.criterion.weight),
      })),
    );
  }

  async submit(
    actor: ActorContext,
    assessmentId: string,
    requestIdHeader: string | null,
  ): Promise<ReadinessAssessmentResponse> {
    const assessment = await this.repository.findById(assessmentId);
    if (!assessment) {
      throw new NotFoundError(ErrorCode.ASSESSMENT_NOT_FOUND, "Assessment not found.");
    }
    const technologyCase = await this.caseRepository.findById(assessment.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.assertWriteAllowed(assessment.technologyCaseId, actor);

    assertAssessmentTransition(assessment.status as AssessmentStatus, AssessmentStatus.SUBMITTED);
    const compositeScore = await this.validateCompletenessAndComputeScore(assessmentId);

    const updated = await this.db.transaction(async (tx) => {
      const result = await this.repository.updateStatus(assessmentId, assessment.version, AssessmentStatus.SUBMITTED, tx, {
        compositeScore: compositeScore.toFixed(4),
        submittedAt: new Date(),
        submittedByUserId: actor.userId,
      });
      if (!result) {
        throw new ConflictError(
          ErrorCode.ASSESSMENT_INVALID_TRANSITION,
          "Assessment was modified concurrently — retry submitting.",
        );
      }

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "assessment.submit",
          entityType: "readiness_assessment",
          entityId: assessmentId,
          beforeData: { status: assessment.status },
          afterData: { status: result.status, compositeScore: result.compositeScore },
        },
        tx,
      );
      await this.outboxService.append(
        "readiness_assessment",
        assessmentId,
        {
          type: "AssessmentSubmitted",
          assessmentId,
          technologyCaseId: assessment.technologyCaseId,
          compositeScore,
          submittedByUserId: actor.userId,
        },
        tx,
      );

      if (technologyCase.lifecycleStatus === TechnologyCaseStatus.EVIDENCE_COLLECTION) {
        await this.caseService.applyTransition(
          tx,
          actor,
          technologyCase,
          TechnologyCaseStatus.UNDER_ASSESSMENT,
          "Assessment submitted",
          requestIdHeader,
        );
      }

      return result;
    });

    return toAssessmentResponse(updated);
  }

  /** Đã chốt sau review (2026-08-06, theo rule 12 CLAUDE.md) — chỉ CASE_REVIEWER được
   * quyết định (KHÔNG gồm OWNER, dù OWNER được phép nhập điểm — tránh owner tự duyệt
   * chính assessment mình nhập). */
  async decide(
    actor: ActorContext,
    assessmentId: string,
    input: AssessmentDecisionRequest,
    requestIdHeader: string | null,
  ): Promise<ReadinessAssessmentResponse> {
    const assessment = await this.repository.findById(assessmentId);
    if (!assessment) {
      throw new NotFoundError(ErrorCode.ASSESSMENT_NOT_FOUND, "Assessment not found.");
    }
    const technologyCase = await this.caseRepository.findById(assessment.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    const membership = await this.caseRepository.findActiveMembership(assessment.technologyCaseId, actor.userId);
    if (membership?.role !== CaseMemberRole.CASE_REVIEWER) {
      throw new ForbiddenError(
        ErrorCode.AUTH_FORBIDDEN,
        "Only an active case CASE_REVIEWER may decide on an assessment.",
      );
    }

    if (input.decision === "APPROVE") {
      assertAssessmentTransition(assessment.status as AssessmentStatus, AssessmentStatus.APPROVED);
      const compositeScore = await this.validateCompletenessAndComputeScore(assessmentId);

      const updated = await this.db.transaction(async (tx) => {
        const result = await this.repository.updateStatus(assessmentId, assessment.version, AssessmentStatus.APPROVED, tx, {
          compositeScore: compositeScore.toFixed(4),
          approvedAt: new Date(),
          approvedByUserId: actor.userId,
        });
        if (!result) {
          throw new ConflictError(
            ErrorCode.ASSESSMENT_INVALID_TRANSITION,
            "Assessment was modified concurrently — retry.",
          );
        }

        const previousApproved = await this.repository.findApprovedByCase(assessment.technologyCaseId, assessmentId);
        if (previousApproved) {
          await this.repository.updateStatus(
            previousApproved.id,
            previousApproved.version,
            AssessmentStatus.SUPERSEDED,
            tx,
          );
        }

        await this.auditService.write(
          {
            actorUserId: actor.userId,
            scopeOrganizationId: technologyCase.owningOrganizationId,
            requestId: requestIdHeader,
            action: "assessment.decide",
            entityType: "readiness_assessment",
            entityId: assessmentId,
            beforeData: { status: assessment.status },
            afterData: { status: result.status, decision: "APPROVE" },
          },
          tx,
        );
        await this.outboxService.append(
          "readiness_assessment",
          assessmentId,
          {
            type: "AssessmentApproved",
            assessmentId,
            technologyCaseId: assessment.technologyCaseId,
            approvedByUserId: actor.userId,
          },
          tx,
        );

        return result;
      });

      return toAssessmentResponse(updated);
    }

    assertAssessmentTransition(assessment.status as AssessmentStatus, AssessmentStatus.DRAFT);
    const updated = await this.db.transaction(async (tx) => {
      const result = await this.repository.updateStatus(assessmentId, assessment.version, AssessmentStatus.DRAFT, tx);
      if (!result) {
        throw new ConflictError(
          ErrorCode.ASSESSMENT_INVALID_TRANSITION,
          "Assessment was modified concurrently — retry.",
        );
      }
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "assessment.decide",
          entityType: "readiness_assessment",
          entityId: assessmentId,
          beforeData: { status: assessment.status },
          afterData: { status: result.status, decision: "REJECT", reason: input.reason },
        },
        tx,
      );
      return result;
    });

    return toAssessmentResponse(updated);
  }

  async listScores(actor: ActorContext, assessmentId: string): Promise<AssessmentScoreResponse[]> {
    const assessment = await this.repository.findById(assessmentId);
    if (!assessment) {
      throw new NotFoundError(ErrorCode.ASSESSMENT_NOT_FOUND, "Assessment not found.");
    }
    const technologyCase = await this.caseRepository.findById(assessment.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.caseService.assertVisible(actor, technologyCase);
    const rows = await this.repository.findScoresWithCriteriaByAssessment(assessmentId);
    return rows.map((row) => toScoreResponse(row));
  }

  async getById(actor: ActorContext, id: string): Promise<ReadinessAssessmentResponse> {
    const assessment = await this.repository.findById(id);
    if (!assessment) {
      throw new NotFoundError(ErrorCode.ASSESSMENT_NOT_FOUND, "Assessment not found.");
    }
    const technologyCase = await this.caseRepository.findById(assessment.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.caseService.assertVisible(actor, technologyCase);
    return toAssessmentResponse(assessment);
  }

  async listByCase(actor: ActorContext, technologyCaseId: string): Promise<ReadinessAssessmentResponse[]> {
    const technologyCase = await this.caseRepository.findById(technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.caseService.assertVisible(actor, technologyCase);
    const rows = await this.repository.listByCase(technologyCaseId);
    return rows.map(toAssessmentResponse);
  }
}
