import { randomUUID } from "node:crypto";
import type {
  AddCaseMemberRequest,
  AddCaseOrganizationRequest,
  CaseMemberResponse,
  CaseOrganizationResponse,
  RegisterTechnologyCaseRequest,
  TechnologyCaseResponse,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertActiveMember, isOrgOwnerOrAdmin } from "@r2m/authz";
import type { Database } from "@r2m/database";
import {
  AuthorVerificationStatus,
  CaseMemberRole,
  CaseOrganizationRole,
  CaseOriginType,
  ConflictError,
  ErrorCode,
  ForbiddenError,
  NotFoundError,
  TechnologyCaseStatus,
} from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../database/database.module";
import { slugify } from "../identity-organization/organizations/slug.util";
import { AuditService } from "../platform-operations/audit/audit.service";
import { OutboxService } from "../platform-operations/jobs/outbox.service";
import { SUPPORTED_TRANSITION_TARGETS, assertCaseTransition } from "./domain/technology-case.state-machine";
import { TechnologyCaseRepository } from "./technology-case.repository";

interface TechnologyCaseRow {
  id: string;
  owningOrganizationId: string;
  title: string;
  slug: string;
  description: string | null;
  lifecycleStatus: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  version: number;
}

function toCaseResponse(row: TechnologyCaseRow): TechnologyCaseResponse {
  return {
    id: row.id,
    owningOrganizationId: row.owningOrganizationId,
    title: row.title,
    slug: row.slug,
    description: row.description,
    lifecycleStatus: row.lifecycleStatus,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() ?? null,
    version: row.version,
  };
}

function toMemberResponse(row: {
  id: string;
  technologyCaseId: string;
  userId: string;
  organizationId: string;
  role: string;
  status: string;
  invitedByUserId: string | null;
  joinedAt: Date;
  createdAt: Date;
}): CaseMemberResponse {
  return {
    id: row.id,
    technologyCaseId: row.technologyCaseId,
    userId: row.userId,
    organizationId: row.organizationId,
    role: row.role,
    status: row.status,
    invitedByUserId: row.invitedByUserId,
    joinedAt: row.joinedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function toOrganizationResponse(row: {
  id: string;
  technologyCaseId: string;
  organizationId: string;
  role: string;
  joinedAt: Date;
}): CaseOrganizationResponse {
  return {
    id: row.id,
    technologyCaseId: row.technologyCaseId,
    organizationId: row.organizationId,
    role: row.role,
    joinedAt: row.joinedAt.toISOString(),
  };
}

/** UC-CASE-01 applied to Technology Case. Bounded context: Technology Case. */
@Injectable()
export class TechnologyCaseService {
  constructor(
    private readonly repository: TechnologyCaseRepository,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  /** Đã chốt sau review (2026-08-05): actor phải VỪA là verified author VỪA active
   * member của owning organization (AND, không phải OR). "Author VERIFIED / Organization
   * ACTIVE" ở §3.4 01_workflow_theo_phase.md là cách viết tắt AND, không phải lựa chọn
   * lỏng hơn UC-CASE-01 — nếu đọc là OR sẽ tạo lỗ hổng bảo mật thật (bất kỳ verified
   * author nào cũng tự khai owning organization là tổ chức họ không có quan hệ gì),
   * vi phạm rule 4 CLAUDE.md (tenant scope bắt buộc ở application layer). */
  async register(
    actor: ActorContext,
    input: RegisterTechnologyCaseRequest,
    requestIdHeader: string | null,
  ): Promise<TechnologyCaseResponse> {
    if (actor.authorVerificationStatus !== AuthorVerificationStatus.VERIFIED) {
      throw new ForbiddenError(
        ErrorCode.CASE_CREATOR_NOT_VERIFIED_AUTHOR,
        "Only a verified author may create a technology case.",
      );
    }
    assertActiveMember(actor, input.owningOrganizationId);

    const technologyCase = await this.db.transaction((tx) =>
      this.createCaseCore(tx, {
        owningOrganizationId: input.owningOrganizationId,
        title: input.title,
        description: input.description,
        summary: input.summary,
        ownerUserId: actor.userId,
        createdByUserId: actor.userId,
        origin: { type: CaseOriginType.MANUAL },
        auditActorUserId: actor.userId,
        requestIdHeader,
      }),
    );

    return toCaseResponse(technologyCase);
  }

  /** Shared case-creation transaction body — `register()` (Phase 3, `MANUAL` origin, caller
   * IS the owner) and Sprint 5.3's `ProposalsService.accept()` (Phase 5, `RESEARCH_PROPOSAL`
   * origin, the accepting company is a distinct actor from the case owner) both funnel
   * through here so there is exactly one place that creates a technology case + origin +
   * profile + OWNING_ORGANIZATION link + OWNER member + status_history + audit + outbox —
   * per the plan, no second case-creation code path. Caller supplies its own `tx` (either a
   * fresh transaction, or one it already opened for its own atomic write) and decides who
   * `ownerUserId`/`owningOrganizationId` are; this method does not re-derive them from an
   * `ActorContext` so it stays usable when the triggering actor isn't the case owner. */
  async createCaseCore(
    tx: Database,
    params: {
      owningOrganizationId: string;
      title: string;
      description?: string;
      summary?: string;
      ownerUserId: string;
      createdByUserId: string;
      origin: {
        type: CaseOriginType;
        researchProposalId?: string;
        caseInitiationRequestId?: string;
        recommendationItemId?: string;
      };
      partnerOrganizationId?: string;
      partnerMemberUserId?: string;
      auditActorUserId: string;
      requestIdHeader: string | null;
    },
  ): Promise<TechnologyCaseRow> {
    let slug = slugify(params.title);
    if (await this.repository.findBySlugInOrganization(params.owningOrganizationId, slug)) {
      slug = `${slug}-${randomUUID().slice(0, 8)}`;
    }

    const createdCase = await this.repository.create(
      {
        owningOrganizationId: params.owningOrganizationId,
        title: params.title,
        slug,
        description: params.description,
        createdByUserId: params.createdByUserId,
      },
      tx,
    );

    await this.repository.createOrigin(
      {
        technologyCaseId: createdCase.id,
        originType: params.origin.type,
        researchProposalId: params.origin.researchProposalId,
        caseInitiationRequestId: params.origin.caseInitiationRequestId,
        recommendationItemId: params.origin.recommendationItemId,
      },
      tx,
    );
    await this.repository.createProfile(
      {
        technologyCaseId: createdCase.id,
        summary: params.summary,
        updatedByUserId: params.createdByUserId,
      },
      tx,
    );
    await this.repository.createOrganization(
      {
        technologyCaseId: createdCase.id,
        organizationId: params.owningOrganizationId,
        role: CaseOrganizationRole.OWNING_ORGANIZATION,
      },
      tx,
    );
    await this.repository.createMember(
      {
        technologyCaseId: createdCase.id,
        userId: params.ownerUserId,
        organizationId: params.owningOrganizationId,
        role: CaseMemberRole.OWNER,
        status: "ACTIVE",
      },
      tx,
    );

    if (params.partnerOrganizationId) {
      await this.repository.createOrganization(
        {
          technologyCaseId: createdCase.id,
          organizationId: params.partnerOrganizationId,
          role: CaseOrganizationRole.PARTNER_COMPANY,
        },
        tx,
      );
    }
    if (params.partnerMemberUserId && params.partnerOrganizationId) {
      await this.repository.createMember(
        {
          technologyCaseId: createdCase.id,
          userId: params.partnerMemberUserId,
          organizationId: params.partnerOrganizationId,
          role: CaseMemberRole.PARTNER_MEMBER,
          status: "ACTIVE",
        },
        tx,
      );
    }

    await this.repository.insertStatusHistory(
      {
        technologyCaseId: createdCase.id,
        fromStatus: null,
        toStatus: TechnologyCaseStatus.DRAFT,
        changedByUserId: params.auditActorUserId,
        reason: null,
      },
      tx,
    );

    await this.auditService.write(
      {
        actorUserId: params.auditActorUserId,
        scopeOrganizationId: params.owningOrganizationId,
        requestId: params.requestIdHeader,
        action: "technology_case.register",
        entityType: "technology_case",
        entityId: createdCase.id,
        afterData: createdCase,
      },
      tx,
    );
    await this.outboxService.append(
      "technology_case",
      createdCase.id,
      {
        type: "TechnologyCaseCreated",
        technologyCaseId: createdCase.id,
        owningOrganizationId: params.owningOrganizationId,
        createdByUserId: params.createdByUserId,
      },
      tx,
    );

    return createdCase;
  }

  async getById(actor: ActorContext, id: string): Promise<TechnologyCaseResponse> {
    const technologyCase = await this.findByIdOrThrow(id);
    await this.assertVisible(actor, technologyCase);
    return toCaseResponse(technologyCase);
  }

  async list(actor: ActorContext): Promise<TechnologyCaseResponse[]> {
    const actorOrgIds = actor.memberships
      .filter((membership) => membership.status === "ACTIVE")
      .map((membership) => membership.organizationId);
    const rows = await this.repository.listVisible({ actorUserId: actor.userId, actorOrgIds });
    return rows.map(toCaseResponse);
  }

  async listMembers(actor: ActorContext, technologyCaseId: string): Promise<CaseMemberResponse[]> {
    const technologyCase = await this.findByIdOrThrow(technologyCaseId);
    await this.assertVisible(actor, technologyCase);
    const rows = await this.repository.listMembers(technologyCaseId);
    return rows.map(toMemberResponse);
  }

  async listOrganizations(actor: ActorContext, technologyCaseId: string): Promise<CaseOrganizationResponse[]> {
    const technologyCase = await this.findByIdOrThrow(technologyCaseId);
    await this.assertVisible(actor, technologyCase);
    const rows = await this.repository.listOrganizations(technologyCaseId);
    return rows.map(toOrganizationResponse);
  }

  /** §3.5: OWNER/ORG_ADMIN của owning organization có thể mời member; PARTNER_MEMBER
   * phải thuộc org đã có role PARTNER_COMPANY trong case; user được mời phải là active
   * member của organizationId khai báo; đúng 1 OWNER active tại mọi thời điểm. */
  async addMember(
    actor: ActorContext,
    technologyCaseId: string,
    input: AddCaseMemberRequest,
    requestIdHeader: string | null,
  ): Promise<CaseMemberResponse> {
    const technologyCase = await this.findByIdOrThrow(technologyCaseId);
    await this.assertCanManageMembers(actor, technologyCase);

    if (!(await this.repository.isActiveOrgMember(input.userId, input.organizationId))) {
      throw new ForbiddenError(
        ErrorCode.CASE_MEMBER_NOT_ACTIVE_IN_ORGANIZATION,
        "The invited user is not an active member of the given organization.",
        { userId: input.userId, organizationId: input.organizationId },
      );
    }

    if (input.role === CaseMemberRole.OWNER) {
      if (input.organizationId !== technologyCase.owningOrganizationId) {
        throw new ConflictError(
          ErrorCode.CASE_OWNER_NOT_IN_OWNING_ORG,
          "The case owner must belong to the owning organization.",
          { owningOrganizationId: technologyCase.owningOrganizationId },
        );
      }
      if (await this.repository.findActiveOwner(technologyCaseId)) {
        throw new ConflictError(
          ErrorCode.CASE_OWNER_ALREADY_EXISTS,
          "This case already has an active owner.",
        );
      }
    }

    if (input.role === CaseMemberRole.PARTNER_MEMBER) {
      const isLinkedPartner = await this.repository.hasOrganizationRole(
        technologyCaseId,
        input.organizationId,
        CaseOrganizationRole.PARTNER_COMPANY,
      );
      if (!isLinkedPartner) {
        throw new ConflictError(
          ErrorCode.CASE_PARTNER_MEMBER_ORG_NOT_LINKED,
          "A PARTNER_MEMBER must belong to an organization already linked to this case as PARTNER_COMPANY.",
          { organizationId: input.organizationId },
        );
      }
    }

    if (await this.repository.findExistingMember(technologyCaseId, input.userId)) {
      throw new ConflictError(
        ErrorCode.CASE_MEMBER_ALREADY_EXISTS,
        "This user is already a member of this case.",
      );
    }

    const member = await this.db.transaction(async (tx) => {
      const created = await this.repository.createMember(
        {
          technologyCaseId,
          userId: input.userId,
          organizationId: input.organizationId,
          role: input.role,
          invitedByUserId: actor.userId,
        },
        tx,
      );
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "technology_case.add_member",
          entityType: "case_member",
          entityId: created.id,
          afterData: created,
        },
        tx,
      );
      return created;
    });

    return toMemberResponse(member);
  }

  /** §3.4: chỉ case OWNER được thêm partner/reviewer/support organization. */
  async addOrganization(
    actor: ActorContext,
    technologyCaseId: string,
    input: AddCaseOrganizationRequest,
    requestIdHeader: string | null,
  ): Promise<CaseOrganizationResponse> {
    const technologyCase = await this.findByIdOrThrow(technologyCaseId);
    const membership = await this.repository.findActiveMembership(technologyCaseId, actor.userId);
    if (membership?.role !== CaseMemberRole.OWNER) {
      throw new ForbiddenError(
        ErrorCode.AUTH_FORBIDDEN,
        "Only the active case OWNER may add an organization to this case.",
      );
    }

    const organization = await this.db.transaction(async (tx) => {
      const created = await this.repository.createOrganization(
        { technologyCaseId, organizationId: input.organizationId, role: input.role },
        tx,
      );
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "technology_case.add_organization",
          entityType: "case_organization",
          entityId: created.id,
          afterData: created,
        },
        tx,
      );
      return created;
    });

    return toOrganizationResponse(organization);
  }

  /** SUC-07 — HTTP-facing manual transition. Phase 3 chỉ hỗ trợ target
   * `EVIDENCE_COLLECTION` (xem `technology-case.state-machine.ts`); mọi target khác bị
   * từ chối vì cần dữ liệu Assessment/Gap (Phase 4) chưa tồn tại để guard đúng. */
  async transition(
    actor: ActorContext,
    technologyCaseId: string,
    toStatus: string,
    reason: string | undefined,
    requestIdHeader: string | null,
  ): Promise<TechnologyCaseResponse> {
    const technologyCase = await this.findByIdOrThrow(technologyCaseId);
    await this.assertVisible(actor, technologyCase);

    const updated = await this.db.transaction((tx) =>
      this.applyTransition(tx, actor, technologyCase, toStatus as TechnologyCaseStatus, reason, requestIdHeader),
    );
    return toCaseResponse(updated);
  }

  /** Nội bộ — nhận `tx` có sẵn để `EvidenceService.create` gọi lại trong CÙNG
   * transaction khi evidence đầu tiên tự động chuyển case DRAFT→EVIDENCE_COLLECTION
   * (xem plan PHẦN C, quyết định 3). Không mở transaction riêng. */
  async applyTransition(
    tx: Database,
    actor: ActorContext,
    technologyCase: TechnologyCaseRow,
    toStatus: TechnologyCaseStatus,
    reason: string | undefined,
    requestIdHeader: string | null,
  ): Promise<TechnologyCaseRow> {
    if (!SUPPORTED_TRANSITION_TARGETS.includes(toStatus)) {
      throw new ConflictError(
        ErrorCode.CASE_INVALID_TRANSITION,
        `Transitioning to ${toStatus} is not supported yet — later lifecycle steps (Phase 6 Transfer) require data that doesn't exist yet.`,
        { toStatus },
      );
    }
    assertCaseTransition(technologyCase.lifecycleStatus as TechnologyCaseStatus, toStatus);

    const updated = await this.repository.updateStatus(
      technologyCase.id,
      technologyCase.version,
      toStatus,
      tx,
    );
    if (!updated) {
      throw new ConflictError(
        ErrorCode.CASE_INVALID_TRANSITION,
        "Case was modified concurrently — retry the transition.",
      );
    }

    await this.repository.insertStatusHistory(
      {
        technologyCaseId: technologyCase.id,
        fromStatus: technologyCase.lifecycleStatus as TechnologyCaseStatus,
        toStatus,
        changedByUserId: actor.userId,
        reason: reason ?? null,
      },
      tx,
    );
    await this.auditService.write(
      {
        actorUserId: actor.userId,
        scopeOrganizationId: technologyCase.owningOrganizationId,
        requestId: requestIdHeader,
        action: "technology_case.transition",
        entityType: "technology_case",
        entityId: technologyCase.id,
        beforeData: { lifecycleStatus: technologyCase.lifecycleStatus },
        afterData: { lifecycleStatus: toStatus },
      },
      tx,
    );
    await this.outboxService.append(
      "technology_case",
      technologyCase.id,
      {
        type: "CaseStatusChanged",
        technologyCaseId: technologyCase.id,
        fromStatus: technologyCase.lifecycleStatus,
        toStatus,
        changedByUserId: actor.userId,
      },
      tx,
    );

    return updated as TechnologyCaseRow;
  }

  async findByIdOrThrow(id: string): Promise<TechnologyCaseRow> {
    const technologyCase = await this.repository.findById(id);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    return technologyCase as TechnologyCaseRow;
  }

  /** Actor thấy case nếu là active case_member, hoặc thuộc (active org member) một
   * organization đã link qua `case_organization` (bao gồm cả owning organization). */
  async assertVisible(actor: ActorContext, technologyCase: TechnologyCaseRow): Promise<void> {
    const membership = await this.repository.findActiveMembership(technologyCase.id, actor.userId);
    if (membership) return;
    const actorOrgIds = actor.memberships
      .filter((m) => m.status === "ACTIVE")
      .map((m) => m.organizationId);
    if (await this.repository.hasOrganizationLink(technologyCase.id, actorOrgIds)) return;
    throw new ForbiddenError(
      ErrorCode.AUTH_FORBIDDEN,
      "You do not have access to this technology case.",
    );
  }

  private async assertCanManageMembers(actor: ActorContext, technologyCase: TechnologyCaseRow): Promise<void> {
    const membership = await this.repository.findActiveMembership(technologyCase.id, actor.userId);
    if (membership?.role === CaseMemberRole.OWNER) return;
    if (isOrgOwnerOrAdmin(actor, technologyCase.owningOrganizationId)) return;
    throw new ForbiddenError(
      ErrorCode.AUTH_FORBIDDEN,
      "Only the case OWNER or an ORG_OWNER/ORG_ADMIN of the owning organization may manage members.",
    );
  }
}
