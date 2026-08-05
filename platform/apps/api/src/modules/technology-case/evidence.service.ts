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

  /** ĐỀ XUẤT — CẦN REVIEW (đã chốt sau nghiên cứu, xem plan PHẦN C quyết định 5): spec
   * chỉ nói "Case member có quyền ghi" (1 dòng, không rõ role nào) — chọn: mọi
   * case_member ACTIVE trừ VIEWER (đúng nghĩa "chỉ xem"). */
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
    if (!membership || membership.role === CaseMemberRole.VIEWER) {
      throw new ForbiddenError(
        ErrorCode.AUTH_FORBIDDEN,
        "Only an active case member (other than VIEWER) may add evidence.",
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
