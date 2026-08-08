import type { RecommendationItemResponse, RecommendationRunResponse } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertActiveMember } from "@r2m/authz";
import type { Database } from "@r2m/database";
import { ConflictError, ErrorCode, NotFoundError } from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../../database/database.module";
import { AuditService } from "../../platform-operations/audit/audit.service";
import { OutboxService } from "../../platform-operations/jobs/outbox.service";
import { CompanyProfileRepository } from "../company-profile/company-profile.repository";
import { ResearchNeedsRepository } from "../research-needs/research-needs.repository";
import { RecommendationsRepository } from "./recommendations.repository";

function toItemResponse(item: {
  id: string;
  recommendationRunId: string;
  resourceVersionId: string;
  rank: number;
  matchScore: string;
  rationale: string;
  status: string;
  createdAt: Date;
  citations: { id: string; citationId: string; citation: { resourceVersionId: string; snippet: string } }[];
  resourceVersion: {
    resource: {
      title: string;
      type: string;
      description: string | null;
      paperMetadata: { abstract: string | null; publicationDate: string | null } | null;
    };
  };
}): RecommendationItemResponse {
  const resource = item.resourceVersion.resource;
  const isPaper = resource.type === "PAPER";
  return {
    id: item.id,
    recommendationRunId: item.recommendationRunId,
    resourceVersionId: item.resourceVersionId,
    rank: item.rank,
    matchScore: Number(item.matchScore),
    rationale: item.rationale,
    status: item.status,
    citations: item.citations.map((rc) => ({
      id: rc.id,
      citationId: rc.citationId,
      resourceVersionId: rc.citation.resourceVersionId,
      snippet: rc.citation.snippet,
    })),
    createdAt: item.createdAt.toISOString(),
    resourceTitle: resource.title,
    resourceType: resource.type,
    summary: (isPaper ? resource.paperMetadata?.abstract : resource.description) ?? null,
    publicationDate: isPaper ? (resource.paperMetadata?.publicationDate ?? null) : null,
  };
}

function toRunResponse(row: {
  id: string;
  researchNeedId: string | null;
  needStatementVersionId: string | null;
  companyOrganizationId: string | null;
  runType: string;
  requestedByUserId: string;
  status: string;
  modelProvider: string | null;
  modelName: string | null;
  promptVersion: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
}): RecommendationRunResponse {
  return {
    id: row.id,
    researchNeedId: row.researchNeedId,
    needStatementVersionId: row.needStatementVersionId,
    companyOrganizationId: row.companyOrganizationId,
    runType: row.runType,
    requestedByUserId: row.requestedByUserId,
    status: row.status,
    modelProvider: row.modelProvider,
    modelName: row.modelName,
    promptVersion: row.promptVersion,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
  };
}

/** UC-DIS-03. Bounded context: Company & Discovery. Phase 5a — Postgres full-text search
 * only (`06_phase5_full_design.md` §3 Sprint 5.4), no LLM/embedding. */
@Injectable()
export class RecommendationsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly repository: RecommendationsRepository,
    private readonly needsRepository: ResearchNeedsRepository,
    private readonly companyProfileRepository: CompanyProfileRepository,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
  ) {}

  async createFocusedRun(actor: ActorContext, researchNeedId: string, requestIdHeader: string | null): Promise<RecommendationRunResponse> {
    const need = await this.needsRepository.findById(researchNeedId);
    if (!need) {
      throw new NotFoundError(ErrorCode.DISCOVERY_NEED_NOT_OPEN, "Research need not found.");
    }
    assertActiveMember(actor, need.companyOrganizationId);

    const existingRun = await this.repository.findActiveFocusedRunForNeed(researchNeedId);
    if (existingRun) {
      throw new ConflictError(
        ErrorCode.DISCOVERY_RUN_ALREADY_IN_PROGRESS,
        "A recommendation run for this research need is already queued or running.",
      );
    }

    const currentVersion = await this.needsRepository.findLatestVersion(researchNeedId);
    if (!currentVersion) {
      throw new Error(`Research need ${researchNeedId} has no statement version — data integrity violation.`);
    }

    const run = await this.db.transaction(async (tx) => {
      const created = await this.repository.createRun(
        {
          researchNeedId,
          needStatementVersionId: currentVersion.id,
          runType: "FOCUSED",
          requestedByUserId: actor.userId,
          status: "QUEUED",
        },
        tx,
      );
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: need.companyOrganizationId,
          requestId: requestIdHeader,
          action: "recommendation_run.create",
          entityType: "recommendation_run",
          entityId: created.id,
          afterData: created,
        },
        tx,
      );
      await this.outboxService.append(
        "recommendation_run",
        created.id,
        {
          type: "RecommendationRunRequested",
          recommendationRunId: created.id,
          runType: "FOCUSED",
          researchNeedId,
          companyOrganizationId: null,
        },
        tx,
      );
      return created;
    });

    return toRunResponse(run);
  }

  /** Resolves the owning company org for either run type, then guards on membership —
   * shared by both FOCUSED (`researchNeedId` set) and FEED (`companyOrganizationId` set)
   * runs, matching the CHECK constraint's exactly-one-context invariant. */
  private async companyOrgIdForRun(run: { researchNeedId: string | null; companyOrganizationId: string | null }): Promise<string> {
    if (run.researchNeedId) {
      const need = await this.needsRepository.findById(run.researchNeedId);
      if (!need) {
        throw new Error(`Research need ${run.researchNeedId} not found — data integrity violation.`);
      }
      return need.companyOrganizationId;
    }
    if (run.companyOrganizationId) return run.companyOrganizationId;
    throw new Error("Recommendation run has neither researchNeedId nor companyOrganizationId — data integrity violation.");
  }

  private async loadRunForActor(actor: ActorContext, runId: string) {
    const run = await this.repository.findRunById(runId);
    if (!run) {
      throw new NotFoundError(ErrorCode.DISCOVERY_NEED_NOT_OPEN, "Recommendation run not found.");
    }
    const companyOrgId = await this.companyOrgIdForRun(run);
    assertActiveMember(actor, companyOrgId);
    return run;
  }

  async getRun(actor: ActorContext, runId: string): Promise<RecommendationRunResponse> {
    const run = await this.loadRunForActor(actor, runId);
    return toRunResponse(run);
  }

  async listItems(actor: ActorContext, runId: string): Promise<RecommendationItemResponse[]> {
    await this.loadRunForActor(actor, runId);
    const items = await this.repository.listActiveItemsByRun(runId);
    return items.map(toItemResponse);
  }

  /** UC-DISC-F1 / §3 Sprint 5.5 item 16. */
  async createFeedRun(actor: ActorContext, organizationId: string, requestIdHeader: string | null): Promise<RecommendationRunResponse> {
    assertActiveMember(actor, organizationId);
    const profile = await this.companyProfileRepository.findByOrganizationId(organizationId);
    if (!profile) {
      throw new NotFoundError(ErrorCode.DISCOVERY_COMPANY_PROFILE_NOT_FOUND, "Organization has no company profile yet.");
    }

    const existingRun = await this.repository.findActiveFeedRunForOrg(organizationId);
    if (existingRun) {
      throw new ConflictError(
        ErrorCode.DISCOVERY_RUN_ALREADY_IN_PROGRESS,
        "A feed refresh for this organization is already queued or running.",
      );
    }

    const run = await this.db.transaction(async (tx) => {
      const created = await this.repository.createRun(
        {
          companyOrganizationId: organizationId,
          runType: "FEED",
          requestedByUserId: actor.userId,
          status: "QUEUED",
        },
        tx,
      );
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: organizationId,
          requestId: requestIdHeader,
          action: "recommendation_run.create",
          entityType: "recommendation_run",
          entityId: created.id,
          afterData: created,
        },
        tx,
      );
      await this.outboxService.append(
        "recommendation_run",
        created.id,
        {
          type: "RecommendationRunRequested",
          recommendationRunId: created.id,
          runType: "FEED",
          researchNeedId: null,
          companyOrganizationId: organizationId,
        },
        tx,
      );
      return created;
    });

    return toRunResponse(run);
  }

  /** §3 Sprint 5.5 item 18: latest COMPLETED FEED run's ACTIVE items — empty array (not an
   * error) when no FEED run has completed yet, matching the "trạng thái rỗng, gợi ý bấm
   * Làm mới" activity-diagram branch. */
  async getFeed(actor: ActorContext, organizationId: string): Promise<RecommendationItemResponse[]> {
    assertActiveMember(actor, organizationId);
    const latestRun = await this.repository.findLatestCompletedFeedRun(organizationId);
    if (!latestRun) return [];
    const items = await this.repository.listActiveItemsByRun(latestRun.id);
    return items.map(toItemResponse);
  }

  /** §3 Sprint 5.5 item 19 — shared by FOCUSED and FEED items alike. */
  async dismissItem(actor: ActorContext, itemId: string, requestIdHeader: string | null): Promise<RecommendationItemResponse> {
    const item = await this.repository.findItemWithRunById(itemId);
    if (!item) {
      throw new NotFoundError(ErrorCode.DISCOVERY_NEED_NOT_OPEN, "Recommendation item not found.");
    }
    const companyOrgId = await this.companyOrgIdForRun(item.recommendationRun);
    assertActiveMember(actor, companyOrgId);

    if (item.status === "DISMISSED") {
      return toItemResponse(item);
    }

    const updated = await this.repository.dismissItem(itemId);
    if (!updated) {
      throw new ConflictError(ErrorCode.DISCOVERY_RECOMMENDATION_ITEM_NOT_ACTIVE, "Recommendation item was modified concurrently — retry.");
    }
    await this.auditService.write({
      actorUserId: actor.userId,
      scopeOrganizationId: companyOrgId,
      requestId: requestIdHeader,
      action: "recommendation_item.dismiss",
      entityType: "recommendation_item",
      entityId: itemId,
      beforeData: { status: item.status },
      afterData: { status: updated.status },
    });

    return toItemResponse({ ...updated, citations: item.citations, resourceVersion: item.resourceVersion });
  }
}
