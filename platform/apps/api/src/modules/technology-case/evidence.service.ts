import type { ActorContext } from "@r2m/authz";
import type { CreateEvidenceRequest, EvidenceResponse } from "@r2m/contracts";
import type { Database } from "@r2m/database";
import {
  CaseMemberRole,
  ErrorCode,
  ForbiddenError,
  NotFoundError,
  TechnologyCaseStatus,
} from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { ResourcesRepository } from "../resource-catalog/resources.repository";
import { ResourcesService } from "../resource-catalog/resources.service";
import { DATABASE } from "../../database/database.module";
import { AuditService } from "../platform-operations/audit/audit.service";
import { OutboxService } from "../platform-operations/jobs/outbox.service";
import { EvidenceRepository } from "./evidence.repository";
import { TechnologyCaseRepository } from "./technology-case.repository";
import { TechnologyCaseService } from "./technology-case.service";

function toEvidenceResponse(row: {
  id: string;
  technologyCaseId: string;
  resourceVersionId: string;
  annotationId: string | null;
  title: string;
  claim: string;
  relevanceNote: string;
  status: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}): EvidenceResponse {
  return {
    id: row.id,
    technologyCaseId: row.technologyCaseId,
    resourceVersionId: row.resourceVersionId,
    annotationId: row.annotationId,
    title: row.title,
    claim: row.claim,
    relevanceNote: row.relevanceNote,
    status: row.status,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** UC-EVD-01. Bounded context: Technology Case (evidence/citation part of "Resource
 * Catalog & Evidence" per architecture plan §6, but the aggregate root `evidence` FKs
 * to `technology_case` so the module lives here, not in resource-catalog). */
@Injectable()
export class EvidenceService {
  constructor(
    private readonly evidenceRepository: EvidenceRepository,
    private readonly caseRepository: TechnologyCaseRepository,
    private readonly caseService: TechnologyCaseService,
    private readonly resourcesRepository: ResourcesRepository,
    private readonly resourcesService: ResourcesService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  /** Đã chốt sau review (2026-08-05): chỉ OWNER/TECHNICAL_MEMBER/PARTNER_MEMBER được
   * link evidence — CASE_REVIEWER bị loại khỏi danh sách (siết lại so với đề xuất ban
   * đầu "mọi member trừ VIEWER"). Lý do: separation of duties — CASE_REVIEWER là người
   * duyệt assessment/roadmap ở Phase 4 dựa trên evidence đã link ở Phase 3 (§4.4
   * 01_workflow_theo_phase.md); nếu CASE_REVIEWER cũng tự link được evidence, họ có thể
   * tự đưa bằng chứng vào rồi tự duyệt dựa trên chính bằng chứng đó, phá vỡ mục đích của
   * bước review độc lập. OWNER/TECHNICAL_MEMBER/PARTNER_MEMBER là người "làm", CASE_
   * REVIEWER thuần tuý là người "soát". */
  private static readonly ROLES_ALLOWED_TO_LINK_EVIDENCE: readonly string[] = [
    CaseMemberRole.OWNER,
    CaseMemberRole.TECHNICAL_MEMBER,
    CaseMemberRole.PARTNER_MEMBER,
  ];

  async create(
    actor: ActorContext,
    technologyCaseId: string,
    input: CreateEvidenceRequest,
    requestIdHeader: string | null,
  ): Promise<EvidenceResponse> {
    const technologyCase = await this.caseRepository.findById(technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }

    const membership = await this.caseRepository.findActiveMembership(technologyCaseId, actor.userId);
    if (!membership) {
      throw new ForbiddenError(
        ErrorCode.AUTH_FORBIDDEN,
        "Only an active case member may add evidence.",
      );
    }
    if (!EvidenceService.ROLES_ALLOWED_TO_LINK_EVIDENCE.includes(membership.role)) {
      throw new ForbiddenError(
        ErrorCode.CASE_EVIDENCE_ROLE_NOT_ALLOWED,
        "Only OWNER, TECHNICAL_MEMBER or PARTNER_MEMBER may add evidence — CASE_REVIEWER and VIEWER cannot (separation of duties: reviewers approve evidence-based decisions in Phase 4, they don't supply the evidence).",
        { role: membership.role },
      );
    }

    const resourceVersion = await this.resourcesRepository.findVersionById(input.resourceVersionId);
    if (!resourceVersion) {
      throw new NotFoundError(ErrorCode.RESOURCE_VERSION_NOT_FOUND, "Resource version not found.");
    }
    const resource = await this.resourcesRepository.findById(resourceVersion.resourceId);
    if (!resource) {
      throw new NotFoundError(ErrorCode.RESOURCE_NOT_FOUND, "Resource not found.");
    }
    await this.resourcesService.assertVisible(actor, resource);

    // Read outside the transaction, same trade-off already accepted in
    // resources.service.ts#publishVersion (findPublishedVersionByResource): a genuinely
    // concurrent evidence-creation race on the same DRAFT case could make both requests
    // see `isFirstEvidence = true`, and the loser's optimistic-concurrency check inside
    // applyTransition() would then fail the whole transaction — acceptable, client
    // retries, not a correctness bug (no case ever ends up with 2 different statuses).
    const isFirstEvidence = !(await this.evidenceRepository.hasAnyEvidence(technologyCaseId, this.db));

    const evidence = await this.db.transaction(async (tx) => {
      const citation = await this.evidenceRepository.createCitation(
        {
          resourceVersionId: input.resourceVersionId,
          snippet: input.citation.snippet,
          pageNumber: input.citation.pageNumber,
          sectionLabel: input.citation.sectionLabel,
          offsetStart: input.citation.offsetStart,
          offsetEnd: input.citation.offsetEnd,
          createdByUserId: actor.userId,
        },
        tx,
      );

      const createdEvidence = await this.evidenceRepository.createEvidence(
        {
          technologyCaseId,
          resourceVersionId: input.resourceVersionId,
          annotationId: input.annotationId,
          title: input.title,
          claim: input.claim,
          relevanceNote: input.relevanceNote,
          createdByUserId: actor.userId,
        },
        tx,
      );

      await this.evidenceRepository.createEvidenceCitation(
        { evidenceId: createdEvidence.id, citationId: citation.id },
        tx,
      );

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "evidence.create",
          entityType: "evidence",
          entityId: createdEvidence.id,
          afterData: { evidence: createdEvidence, citation },
        },
        tx,
      );
      await this.outboxService.append(
        "evidence",
        createdEvidence.id,
        {
          type: "EvidenceLinked",
          evidenceId: createdEvidence.id,
          technologyCaseId,
          resourceVersionId: input.resourceVersionId,
          createdByUserId: actor.userId,
        },
        tx,
      );

      if (isFirstEvidence && technologyCase.lifecycleStatus === TechnologyCaseStatus.DRAFT) {
        await this.caseService.applyTransition(
          tx,
          actor,
          technologyCase,
          TechnologyCaseStatus.EVIDENCE_COLLECTION,
          "First evidence linked",
          requestIdHeader,
        );
      }

      return createdEvidence;
    });

    return toEvidenceResponse(evidence);
  }
}
