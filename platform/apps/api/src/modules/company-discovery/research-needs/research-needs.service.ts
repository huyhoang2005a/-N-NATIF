import type {
  CreateNeedStatementVersionRequest,
  CreateResearchNeedRequest,
  NeedStatementVersionResponse,
  ResearchNeedDetailResponse,
  ResearchNeedResponse,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertActiveMember, findActiveMembership } from "@r2m/authz";
import type { Database } from "@r2m/database";
import { ConflictError, ErrorCode, NotFoundError, ResearchNeedStatus } from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../../database/database.module";
import { AuditService } from "../../platform-operations/audit/audit.service";
import { CompanyProfileRepository } from "../company-profile/company-profile.repository";
import { assertResearchNeedTransition } from "../domain/research-need.state-machine";
import { ResearchNeedsRepository } from "./research-needs.repository";

/** UC-DIS-01 acceptance criteria: "Publish bị chặn khi thiếu trường bắt buộc" — DB already
 * requires `problem_statement`/`technical_field` NOT NULL, this is the application-layer
 * "đủ cụ thể" gate the spec explicitly calls for on top of that (06 §3 Sprint 5.2 item 5).
 * Threshold is a judgment call, not a spec-given number — documented here so it's easy to
 * revisit, not buried as a magic literal. */
const MIN_PROBLEM_STATEMENT_LENGTH = 50;

function toNeedResponse(row: {
  id: string;
  companyOrganizationId: string;
  createdByUserId: string;
  title: string;
  visibility: string;
  status: string;
  publishedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}): ResearchNeedResponse {
  return {
    id: row.id,
    companyOrganizationId: row.companyOrganizationId,
    createdByUserId: row.createdByUserId,
    title: row.title,
    visibility: row.visibility,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

function toVersionResponse(row: {
  id: string;
  researchNeedId: string;
  versionNo: number;
  problemStatement: string;
  technicalField: string;
  desiredOutputType: string;
  timeframeMonths: number | null;
  constraints: string | null;
  successCriteria: string | null;
  createdByUserId: string;
  createdAt: Date;
}): NeedStatementVersionResponse {
  return {
    id: row.id,
    researchNeedId: row.researchNeedId,
    versionNo: row.versionNo,
    problemStatement: row.problemStatement,
    technicalField: row.technicalField,
    desiredOutputType: row.desiredOutputType,
    timeframeMonths: row.timeframeMonths,
    constraints: row.constraints,
    successCriteria: row.successCriteria,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
  };
}

/** UC-DIS-01. Bounded context: Company & Discovery. */
@Injectable()
export class ResearchNeedsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly repository: ResearchNeedsRepository,
    private readonly companyProfileRepository: CompanyProfileRepository,
    private readonly auditService: AuditService,
  ) {}

  /** Visible to: any active member of the owning org (any status/visibility), or anyone
   * else only when OPEN + PUBLIC (UC-DIS-01 invariant: "PRIVATE/ORG_ONLY không xuất hiện
   * trong public browse"). PARTNERS_ONLY has no partner-org model defined yet in Phase 5,
   * so it is treated like ORGANIZATION_ONLY here — not visible to non-members — rather
   * than inventing partner-linkage logic that isn't specified. */
  private async assertVisible(actor: ActorContext, need: { companyOrganizationId: string; status: string; visibility: string }) {
    if (findActiveMembership(actor, need.companyOrganizationId)) return;
    if (need.status === ResearchNeedStatus.OPEN && need.visibility === "PUBLIC") return;
    throw new NotFoundError(ErrorCode.DISCOVERY_NEED_NOT_OPEN, "Research need not found or not visible.");
  }

  async create(
    actor: ActorContext,
    request: CreateResearchNeedRequest,
    requestIdHeader: string | null,
  ): Promise<ResearchNeedDetailResponse> {
    assertActiveMember(actor, request.companyOrganizationId);
    const profile = await this.companyProfileRepository.findByOrganizationId(request.companyOrganizationId);
    if (!profile) {
      throw new ConflictError(
        ErrorCode.DISCOVERY_COMPANY_PROFILE_NOT_FOUND,
        "Organization must have a company profile before creating research needs.",
      );
    }

    const { need, version } = await this.db.transaction(async (tx) => {
      const need = await this.repository.createNeed(
        {
          companyOrganizationId: request.companyOrganizationId,
          createdByUserId: actor.userId,
          title: request.title,
          visibility: request.visibility,
        },
        tx,
      );
      const version = await this.repository.createVersion(
        {
          researchNeedId: need.id,
          versionNo: 1,
          problemStatement: request.problemStatement,
          technicalField: request.technicalField,
          desiredOutputType: request.desiredOutputType,
          timeframeMonths: request.timeframeMonths ?? null,
          constraints: request.constraints ?? null,
          successCriteria: request.successCriteria ?? null,
          createdByUserId: actor.userId,
        },
        tx,
      );
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: request.companyOrganizationId,
          requestId: requestIdHeader,
          action: "research_need.create",
          entityType: "research_need",
          entityId: need.id,
          afterData: { need, version },
        },
        tx,
      );
      return { need, version };
    });

    return { ...toNeedResponse(need), currentVersion: toVersionResponse(version) };
  }

  async createVersion(
    actor: ActorContext,
    researchNeedId: string,
    request: CreateNeedStatementVersionRequest,
    requestIdHeader: string | null,
  ): Promise<NeedStatementVersionResponse> {
    const need = await this.repository.findById(researchNeedId);
    if (!need) {
      throw new NotFoundError(ErrorCode.DISCOVERY_NEED_NOT_OPEN, "Research need not found.");
    }
    assertActiveMember(actor, need.companyOrganizationId);

    const latest = await this.repository.findLatestVersion(researchNeedId);
    const nextVersionNo = (latest?.versionNo ?? 0) + 1;

    const version = await this.db.transaction(async (tx) => {
      const created = await this.repository.createVersion(
        {
          researchNeedId,
          versionNo: nextVersionNo,
          problemStatement: request.problemStatement,
          technicalField: request.technicalField,
          desiredOutputType: request.desiredOutputType,
          timeframeMonths: request.timeframeMonths ?? null,
          constraints: request.constraints ?? null,
          successCriteria: request.successCriteria ?? null,
          createdByUserId: actor.userId,
        },
        tx,
      );
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: need.companyOrganizationId,
          requestId: requestIdHeader,
          action: "research_need.version",
          entityType: "need_statement_version",
          entityId: created.id,
          afterData: created,
        },
        tx,
      );
      return created;
    });

    return toVersionResponse(version);
  }

  private async transition(
    actor: ActorContext,
    researchNeedId: string,
    toStatus: ResearchNeedStatus,
    action: string,
    requestIdHeader: string | null,
    extraFields?: Record<string, unknown>,
  ): Promise<ResearchNeedResponse> {
    const need = await this.repository.findById(researchNeedId);
    if (!need) {
      throw new NotFoundError(ErrorCode.DISCOVERY_NEED_NOT_OPEN, "Research need not found.");
    }
    assertActiveMember(actor, need.companyOrganizationId);
    assertResearchNeedTransition(need.status as ResearchNeedStatus, toStatus);

    if (toStatus === ResearchNeedStatus.OPEN && need.status === ResearchNeedStatus.DRAFT) {
      const latest = await this.repository.findLatestVersion(researchNeedId);
      if (!latest || latest.problemStatement.length < MIN_PROBLEM_STATEMENT_LENGTH || !latest.technicalField.trim()) {
        throw new ConflictError(
          ErrorCode.DISCOVERY_NEED_STATEMENT_INCOMPLETE,
          `Problem statement must be at least ${MIN_PROBLEM_STATEMENT_LENGTH} characters and technical field must be filled in before publishing.`,
        );
      }
    }

    const updated = await this.db.transaction(async (tx) => {
      const result = await this.repository.update(researchNeedId, need.version, { status: toStatus, ...extraFields }, tx);
      if (!result) {
        throw new ConflictError(ErrorCode.DISCOVERY_NEED_INVALID_TRANSITION, "Research need was modified concurrently — retry.");
      }
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: need.companyOrganizationId,
          requestId: requestIdHeader,
          action,
          entityType: "research_need",
          entityId: researchNeedId,
          beforeData: need,
          afterData: result,
        },
        tx,
      );
      return result;
    });

    return toNeedResponse(updated);
  }

  publish(actor: ActorContext, id: string, requestIdHeader: string | null) {
    return this.transition(actor, id, ResearchNeedStatus.OPEN, "research_need.publish", requestIdHeader, {
      publishedAt: new Date(),
    });
  }

  pause(actor: ActorContext, id: string, requestIdHeader: string | null) {
    return this.transition(actor, id, ResearchNeedStatus.PAUSED, "research_need.pause", requestIdHeader);
  }

  resume(actor: ActorContext, id: string, requestIdHeader: string | null) {
    return this.transition(actor, id, ResearchNeedStatus.OPEN, "research_need.resume", requestIdHeader);
  }

  close(actor: ActorContext, id: string, requestIdHeader: string | null) {
    return this.transition(actor, id, ResearchNeedStatus.CLOSED, "research_need.close", requestIdHeader, {
      closedAt: new Date(),
    });
  }

  async getById(actor: ActorContext, id: string): Promise<ResearchNeedDetailResponse> {
    const need = await this.repository.findById(id);
    if (!need) {
      throw new NotFoundError(ErrorCode.DISCOVERY_NEED_NOT_OPEN, "Research need not found.");
    }
    await this.assertVisible(actor, need);
    const latest = await this.repository.findLatestVersion(id);
    if (!latest) {
      throw new Error(`Research need ${id} has no statement version — data integrity violation.`);
    }
    return { ...toNeedResponse(need), currentVersion: toVersionResponse(latest) };
  }

  async listVersions(actor: ActorContext, id: string): Promise<NeedStatementVersionResponse[]> {
    const need = await this.repository.findById(id);
    if (!need) {
      throw new NotFoundError(ErrorCode.DISCOVERY_NEED_NOT_OPEN, "Research need not found.");
    }
    await this.assertVisible(actor, need);
    const versions = await this.repository.listVersions(id);
    return versions.map(toVersionResponse);
  }

  async listForOrganization(actor: ActorContext, organizationId: string): Promise<ResearchNeedResponse[]> {
    assertActiveMember(actor, organizationId);
    const needs = await this.repository.listByOrganization(organizationId);
    return needs.map(toNeedResponse);
  }

  async listPublic(): Promise<ResearchNeedResponse[]> {
    const needs = await this.repository.listPublicOpen();
    return needs.map(toNeedResponse);
  }
}
