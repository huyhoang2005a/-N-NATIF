import type { CaseInitiationRequestResponse, CreateCaseInitiationRequest, DeclineCaseInitiationRequest } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertActiveMember } from "@r2m/authz";
import type { Database } from "@r2m/database";
import { CaseOriginType, ConflictError, ErrorCode, ForbiddenError, NotFoundError } from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../../database/database.module";
import { AuditService } from "../../platform-operations/audit/audit.service";
import { OutboxService } from "../../platform-operations/jobs/outbox.service";
import { TechnologyCaseService } from "../../technology-case/technology-case.service";
import { EvidenceRepository } from "../../technology-case/evidence.repository";
import { ResearchNeedsRepository } from "../research-needs/research-needs.repository";
import { CaseInitiationsRepository } from "./case-initiations.repository";

const EXPIRY_DAYS = 14;

function toResponse(row: {
  id: string;
  recommendationItemId: string;
  requestingOrganizationId: string;
  requestedByUserId: string;
  targetAuthorUserId: string;
  targetOrganizationId: string;
  status: string;
  message: string | null;
  responseNote: string | null;
  respondedByUserId: string | null;
  respondedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}): CaseInitiationRequestResponse {
  return {
    id: row.id,
    recommendationItemId: row.recommendationItemId,
    requestingOrganizationId: row.requestingOrganizationId,
    requestedByUserId: row.requestedByUserId,
    targetAuthorUserId: row.targetAuthorUserId,
    targetOrganizationId: row.targetOrganizationId,
    status: row.status,
    message: row.message,
    responseNote: row.responseNote,
    respondedByUserId: row.respondedByUserId,
    respondedAt: row.respondedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

/** UC-DIS-04. Bounded context: Company & Discovery. */
@Injectable()
export class CaseInitiationsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly repository: CaseInitiationsRepository,
    private readonly needsRepository: ResearchNeedsRepository,
    private readonly evidenceRepository: EvidenceRepository,
    private readonly technologyCaseService: TechnologyCaseService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
  ) {}

  /** §3 Sprint 5.6 item 20 — "Không cần biết item đến từ run loại nào" (FOCUSED or FEED),
   * only the item's target resource matters. */
  async create(
    actor: ActorContext,
    recommendationItemId: string,
    request: CreateCaseInitiationRequest,
    requestIdHeader: string | null,
  ): Promise<CaseInitiationRequestResponse> {
    const item = await this.repository.findItemForInitiation(recommendationItemId);
    if (!item) {
      throw new NotFoundError(ErrorCode.DISCOVERY_NEED_NOT_OPEN, "Recommendation item not found.");
    }

    const requestingOrganizationId = item.recommendationRun.researchNeedId
      ? (await this.needsRepository.findById(item.recommendationRun.researchNeedId))?.companyOrganizationId
      : item.recommendationRun.companyOrganizationId;
    if (!requestingOrganizationId) {
      throw new Error(`Recommendation run ${item.recommendationRun.id} has no resolvable company org — data integrity violation.`);
    }
    assertActiveMember(actor, requestingOrganizationId);

    const resource = item.resourceVersion.resource;
    const targetAuthorUserId = resource.createdByUserId;
    const targetOrganizationId = resource.ownerOrganizationId;

    const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const created = await this.db.transaction(async (tx) => {
      const row = await this.repository.createRequest(
        {
          recommendationItemId,
          requestingOrganizationId,
          requestedByUserId: actor.userId,
          targetAuthorUserId,
          targetOrganizationId,
          status: "PENDING",
          message: request.message ?? null,
          expiresAt,
        },
        tx,
      );
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: requestingOrganizationId,
          requestId: requestIdHeader,
          action: "case_initiation_request.create",
          entityType: "case_initiation_request",
          entityId: row.id,
          afterData: row,
        },
        tx,
      );
      await this.outboxService.append(
        "case_initiation_request",
        row.id,
        {
          type: "CaseInitiationRequested",
          caseInitiationRequestId: row.id,
          recommendationItemId,
          requestingOrganizationId,
          targetAuthorUserId,
        },
        tx,
      );
      return row;
    });

    return toResponse(created);
  }

  private async loadPendingForAuthor(actor: ActorContext, id: string) {
    const request = await this.repository.findById(id);
    if (!request) {
      throw new NotFoundError(ErrorCode.DISCOVERY_INITIATION_REQUEST_NOT_PENDING, "Case initiation request not found.");
    }
    if (request.targetAuthorUserId !== actor.userId) {
      throw new ForbiddenError(ErrorCode.AUTH_FORBIDDEN, "Only the requested author may respond to this case initiation request.");
    }
    if (request.status !== "PENDING") {
      throw new ConflictError(ErrorCode.DISCOVERY_INITIATION_REQUEST_NOT_PENDING, "This request is no longer pending.");
    }
    return request;
  }

  /** §3 Sprint 5.6 item 21: case created via the same shared `createCaseCore` as Phase 3
   * manual registration and Sprint 5.3's proposal-accept — only `origin` and the initial
   * evidence source differ. The recommendation item's existing citation(s) become the
   * case's starting evidence directly (`EvidenceRepository.createEvidence` +
   * `createEvidenceCitation` reusing the citation row) — no new citation is created,
   * matching the invariant "giữ nguyên recommendation_item/citation làm evidence ban đầu,
   * không tạo evidence trùng lặp". */
  async accept(actor: ActorContext, id: string, requestIdHeader: string | null): Promise<CaseInitiationRequestResponse> {
    const request = await this.loadPendingForAuthor(actor, id);
    if (request.expiresAt && request.expiresAt.getTime() < Date.now()) {
      throw new ConflictError(ErrorCode.DISCOVERY_INITIATION_REQUEST_EXPIRED, "This request has expired.");
    }

    const item = await this.repository.findItemForInitiation(request.recommendationItemId);
    if (!item) {
      throw new Error(`Recommendation item ${request.recommendationItemId} not found — data integrity violation.`);
    }

    const updated = await this.db.transaction(async (tx) => {
      const technologyCase = await this.technologyCaseService.createCaseCore(tx, {
        owningOrganizationId: request.targetOrganizationId,
        title: item.resourceVersion.resource.title,
        description: item.rationale,
        ownerUserId: request.targetAuthorUserId,
        createdByUserId: actor.userId,
        origin: { type: CaseOriginType.DISCOVERY_RECOMMENDATION, recommendationItemId: item.id, caseInitiationRequestId: id },
        partnerOrganizationId: request.requestingOrganizationId,
        partnerMemberUserId: request.requestedByUserId,
        auditActorUserId: actor.userId,
        requestIdHeader,
      });

      for (const rc of item.citations) {
        const createdEvidence = await this.evidenceRepository.createEvidence(
          {
            technologyCaseId: technologyCase.id,
            resourceVersionId: item.resourceVersionId,
            title: item.resourceVersion.resource.title,
            claim: item.rationale,
            relevanceNote: `Bằng chứng ban đầu từ gợi ý AI (match_score=${item.matchScore}).`,
            createdByUserId: actor.userId,
          },
          tx,
        );
        await this.evidenceRepository.createEvidenceCitation(
          { evidenceId: createdEvidence.id, citationId: rc.citationId },
          tx,
        );
      }

      const result = await this.repository.update(
        id,
        request.version,
        { status: "ACCEPTED", respondedByUserId: actor.userId, respondedAt: new Date() },
        tx,
      );
      if (!result) {
        throw new ConflictError(ErrorCode.DISCOVERY_INITIATION_REQUEST_NOT_PENDING, "Request was modified concurrently — retry.");
      }
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: request.targetOrganizationId,
          requestId: requestIdHeader,
          action: "case_initiation_request.accept",
          entityType: "case_initiation_request",
          entityId: id,
          beforeData: request,
          afterData: { ...result, technologyCaseId: technologyCase.id },
        },
        tx,
      );
      await this.outboxService.append(
        "case_initiation_request",
        id,
        {
          type: "CaseInitiationRequestDecided",
          caseInitiationRequestId: id,
          decision: "ACCEPTED",
          requestingOrganizationId: request.requestingOrganizationId,
          requestedByUserId: request.requestedByUserId,
        },
        tx,
      );
      return result;
    });

    return toResponse(updated);
  }

  async decline(
    actor: ActorContext,
    id: string,
    request: DeclineCaseInitiationRequest,
    requestIdHeader: string | null,
  ): Promise<CaseInitiationRequestResponse> {
    const existing = await this.loadPendingForAuthor(actor, id);

    const updated = await this.db.transaction(async (tx) => {
      const result = await this.repository.update(
        id,
        existing.version,
        {
          status: "DECLINED",
          responseNote: request.responseNote ?? null,
          respondedByUserId: actor.userId,
          respondedAt: new Date(),
        },
        tx,
      );
      if (!result) {
        throw new ConflictError(ErrorCode.DISCOVERY_INITIATION_REQUEST_NOT_PENDING, "Request was modified concurrently — retry.");
      }
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: existing.targetOrganizationId,
          requestId: requestIdHeader,
          action: "case_initiation_request.decline",
          entityType: "case_initiation_request",
          entityId: id,
          beforeData: existing,
          afterData: result,
        },
        tx,
      );
      await this.outboxService.append(
        "case_initiation_request",
        id,
        {
          type: "CaseInitiationRequestDecided",
          caseInitiationRequestId: id,
          decision: "DECLINED",
          requestingOrganizationId: existing.requestingOrganizationId,
          requestedByUserId: existing.requestedByUserId,
        },
        tx,
      );
      return result;
    });

    return toResponse(updated);
  }

  async listReceived(actor: ActorContext): Promise<CaseInitiationRequestResponse[]> {
    const rows = await this.repository.listForAuthor(actor.userId);
    return rows.map(toResponse);
  }

  async listSent(actor: ActorContext, organizationId: string): Promise<CaseInitiationRequestResponse[]> {
    assertActiveMember(actor, organizationId);
    const rows = await this.repository.listForOrganization(organizationId);
    return rows.map(toResponse);
  }
}
