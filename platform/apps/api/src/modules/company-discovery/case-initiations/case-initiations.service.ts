import type {
  CaseInitiationRequestResponse,
  CreateCaseInitiationRequest,
  CreateResourceCaseInitiationRequest,
  DeclineCaseInitiationRequest,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertActiveMember } from "@r2m/authz";
import type { Database } from "@r2m/database";
import { CaseOriginType, ConflictError, ErrorCode, ForbiddenError, NotFoundError } from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../../database/database.module";
import { ResourcesService } from "../../resource-catalog/resources.service";
import { AuditService } from "../../platform-operations/audit/audit.service";
import { OutboxService } from "../../platform-operations/jobs/outbox.service";
import { TechnologyCaseService } from "../../technology-case/technology-case.service";
import { EvidenceRepository } from "../../technology-case/evidence.repository";
import { ResearchNeedsRepository } from "../research-needs/research-needs.repository";
import { CaseInitiationsRepository } from "./case-initiations.repository";

const EXPIRY_DAYS = 14;

/** Both possible sources are loaded via `with` (see repository's `withResourceTitle`) so
 * this can resolve the display title regardless of which one is set — exactly one ever
 * is. Falls back defensively; in practice the referenced resource always exists (no hard
 * delete once a case-initiation-request references it). */
function resolveResourceTitle(row: {
  recommendationItem?: { resourceVersion?: { resource?: { title: string } | null } | null } | null;
  resourceVersion?: { resource?: { title: string } | null } | null;
}): string {
  return (
    row.recommendationItem?.resourceVersion?.resource?.title ?? row.resourceVersion?.resource?.title ?? "(tài liệu không xác định)"
  );
}

function toResponse(
  row: {
    id: string;
    recommendationItemId: string | null;
    resourceVersionId: string | null;
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
  },
  resourceTitle: string,
): CaseInitiationRequestResponse {
  return {
    id: row.id,
    recommendationItemId: row.recommendationItemId,
    resourceVersionId: row.resourceVersionId,
    resourceTitle,
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
    private readonly resourcesService: ResourcesService,
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

    return toResponse(created, resource.title);
  }

  /** Resource-sourced path (2026-08-19) — sent straight from a resource/version a company
   * browsed, no recommendation run involved. Shares the request/response shape and the
   * insert+audit+outbox transaction body with `create()` above, but has a different way to
   * derive `requestingOrganizationId`/`targetAuthorUserId`/`targetOrganizationId`: the
   * requesting org is explicit in the body (no run to infer it from — an actor can belong
   * to multiple ENTERPRISE orgs), and the target author/org come straight off the
   * resource. Reuses `ResourcesService.loadVisibleVersion` — the same non-manager-safe
   * visibility check already used by the content-url/summarize endpoints, deliberately NOT
   * the stricter manage-only check. */
  async createFromResourceVersion(
    actor: ActorContext,
    resourceId: string,
    versionId: string,
    request: CreateResourceCaseInitiationRequest,
    requestIdHeader: string | null,
  ): Promise<CaseInitiationRequestResponse> {
    const { resource } = await this.resourcesService.loadVisibleVersion(actor, resourceId, versionId);

    assertActiveMember(actor, request.requestingOrganizationId);
    if (request.requestingOrganizationId === resource.ownerOrganizationId) {
      throw new ConflictError(
        ErrorCode.DISCOVERY_INITIATION_REQUEST_SELF_TARGET,
        "A company cannot send a case-initiation request to itself for a resource its own organization owns.",
      );
    }

    const targetAuthorUserId = resource.createdByUserId;
    const targetOrganizationId = resource.ownerOrganizationId;
    const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const created = await this.db.transaction(async (tx) => {
      const row = await this.repository.createRequest(
        {
          recommendationItemId: null,
          resourceVersionId: versionId,
          requestingOrganizationId: request.requestingOrganizationId,
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
          scopeOrganizationId: request.requestingOrganizationId,
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
          resourceVersionId: versionId,
          requestingOrganizationId: request.requestingOrganizationId,
          targetAuthorUserId,
        },
        tx,
      );
      return row;
    });

    return toResponse(created, resource.title);
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
   * evidence source differ. For a recommendation-item-sourced request, the item's
   * existing citation(s) become the case's starting evidence directly
   * (`EvidenceRepository.createEvidence` + `createEvidenceCitation` reusing the citation
   * row) — no new citation is created, matching the invariant "giữ nguyên
   * recommendation_item/citation làm evidence ban đầu, không tạo evidence trùng lặp". A
   * resource-sourced request (2026-08-19) has no recommendation item and no pre-existing
   * citation to reuse — it gets exactly ONE evidence row citing the resource version
   * directly, with no linked citation row (nothing to link). */
  async accept(actor: ActorContext, id: string, requestIdHeader: string | null): Promise<CaseInitiationRequestResponse> {
    const request = await this.loadPendingForAuthor(actor, id);
    if (request.expiresAt && request.expiresAt.getTime() < Date.now()) {
      throw new ConflictError(ErrorCode.DISCOVERY_INITIATION_REQUEST_EXPIRED, "This request has expired.");
    }

    // Branch on which source this request carries — exactly one of the two is ever set
    // (enforced by the DB CHECK constraint). Both branches resolve the same 4 values the
    // shared transaction body below needs: title, description/rationale for the case,
    // the resource version to cite as evidence, and the origin's `recommendationItemId`
    // (undefined for the resource-sourced branch).
    let title: string;
    let rationale: string;
    let evidenceResourceVersionId: string;
    let originRecommendationItemId: string | undefined;
    let originType: CaseOriginType = CaseOriginType.DISCOVERY_DIRECT_REQUEST;
    let citationsToLink: { citationId: string }[] = [];
    let matchScore: string | undefined;

    if (request.recommendationItemId) {
      const item = await this.repository.findItemForInitiation(request.recommendationItemId);
      if (!item) {
        throw new Error(`Recommendation item ${request.recommendationItemId} not found — data integrity violation.`);
      }
      title = item.resourceVersion.resource.title;
      rationale = item.rationale;
      evidenceResourceVersionId = item.resourceVersionId;
      originRecommendationItemId = item.id;
      originType = CaseOriginType.DISCOVERY_RECOMMENDATION;
      citationsToLink = item.citations;
      matchScore = item.matchScore;
    } else {
      const resourceVersionId = request.resourceVersionId;
      if (!resourceVersionId) {
        throw new Error(`Case initiation request ${id} has neither recommendationItemId nor resourceVersionId — data integrity violation.`);
      }
      const rv = await this.repository.findResourceVersionWithResource(resourceVersionId);
      if (!rv) {
        throw new Error(`Resource version ${resourceVersionId} not found — data integrity violation.`);
      }
      title = rv.resource.title;
      rationale = request.message ?? `Yêu cầu khởi tạo case trực tiếp từ tài liệu "${rv.resource.title}".`;
      evidenceResourceVersionId = rv.id;
    }

    const updated = await this.db.transaction(async (tx) => {
      const technologyCase = await this.technologyCaseService.createCaseCore(tx, {
        owningOrganizationId: request.targetOrganizationId,
        title,
        description: rationale,
        ownerUserId: request.targetAuthorUserId,
        createdByUserId: actor.userId,
        origin: {
          type: originType,
          recommendationItemId: originRecommendationItemId,
          caseInitiationRequestId: id,
        },
        partnerOrganizationId: request.requestingOrganizationId,
        partnerMemberUserId: request.requestedByUserId,
        auditActorUserId: actor.userId,
        requestIdHeader,
      });

      if (citationsToLink.length > 0) {
        for (const rc of citationsToLink) {
          const createdEvidence = await this.evidenceRepository.createEvidence(
            {
              technologyCaseId: technologyCase.id,
              resourceVersionId: evidenceResourceVersionId,
              title,
              claim: rationale,
              relevanceNote: `Bằng chứng ban đầu từ gợi ý AI (match_score=${matchScore}).`,
              createdByUserId: actor.userId,
            },
            tx,
          );
          await this.evidenceRepository.createEvidenceCitation(
            { evidenceId: createdEvidence.id, citationId: rc.citationId },
            tx,
          );
        }
      } else {
        // No recommendation-item citation to reuse (resource-sourced request) — every
        // ACTIVE evidence row still needs at least one `evidence_citation`
        // (`trg_evidence_requires_citation`, 0004_phase3_case_constraints.sql), so a new
        // whole-document citation is created here, same shape `EvidenceService.create()`
        // makes when a case member manually attaches evidence.
        const citation = await this.evidenceRepository.createCitation(
          {
            resourceVersionId: evidenceResourceVersionId,
            snippet: `Toàn bộ tài liệu "${title}" — đính kèm tự động khi công ty gửi yêu cầu khởi tạo case trực tiếp từ tài liệu này.`,
            createdByUserId: actor.userId,
          },
          tx,
        );
        const createdEvidence = await this.evidenceRepository.createEvidence(
          {
            technologyCaseId: technologyCase.id,
            resourceVersionId: evidenceResourceVersionId,
            title,
            claim: rationale,
            relevanceNote: "Bằng chứng ban đầu từ yêu cầu khởi tạo case trực tiếp từ tài liệu.",
            createdByUserId: actor.userId,
          },
          tx,
        );
        await this.evidenceRepository.createEvidenceCitation(
          { evidenceId: createdEvidence.id, citationId: citation.id },
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

    return toResponse(updated, title);
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

    return toResponse(updated, resolveResourceTitle(existing));
  }

  async listReceived(actor: ActorContext): Promise<CaseInitiationRequestResponse[]> {
    const rows = await this.repository.listForAuthor(actor.userId);
    return rows.map((row) => toResponse(row, resolveResourceTitle(row)));
  }

  async listSent(actor: ActorContext, organizationId: string): Promise<CaseInitiationRequestResponse[]> {
    assertActiveMember(actor, organizationId);
    const rows = await this.repository.listForOrganization(organizationId);
    return rows.map((row) => toResponse(row, resolveResourceTitle(row)));
  }
}
