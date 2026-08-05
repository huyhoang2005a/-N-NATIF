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
import { PHASE_3_SUPPORTED_TARGET, assertCaseTransition } from "./domain/technology-case.state-machine";
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

    let slug = slugify(input.title);
    if (await this.repository.findBySlugInOrganization(input.owningOrganizationId, slug)) {
      slug = `${slug}-${randomUUID().slice(0, 8)}`;
    }

    const technologyCase = await this.db.transaction(async (tx) => {
      const createdCase = await this.repository.create(
        {
          owningOrganizationId: input.owningOrganizationId,
          title: input.title,
          slug,
          description: input.description,
          createdByUserId: actor.userId,
        },
        tx,
      );

      await this.repository.createOrigin(
        { technologyCaseId: createdCase.id, originType: "MANUAL" },
        tx,
      );
      await this.repository.createProfile(
        {
          technologyCaseId: createdCase.id,
          summary: input.summary,
          updatedByUserId: actor.userId,
        },
        tx,
      );
      await this.repository.createOrganization(
        {
          technologyCaseId: createdCase.id,
          organizationId: input.owningOrganizationId,
          role: CaseOrganizationRole.OWNING_ORGANIZATION,
        },
        tx,
      );
      await this.repository.createMember(
        {
          technologyCaseId: createdCase.id,
          userId: actor.userId,
          organizationId: input.owningOrganizationId,
          role: CaseMemberRole.OWNER,
          status: "ACTIVE",
        },
        tx,
      );
      await this.repository.insertStatusHistory(
        {
          technologyCaseId: createdCase.id,
          fromStatus: null,
          toStatus: TechnologyCaseStatus.DRAFT,
          changedByUserId: actor.userId,
          reason: null,
        },
        tx,
      );

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: input.owningOrganizationId,
          requestId: requestIdHeader,
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
          owningOrganizationId: input.owningOrganizationId,
          createdByUserId: actor.userId,
        },
        tx,
      );

      return createdCase;
    });

    return toCaseResponse(technologyCase);
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
    if (toStatus !== PHASE_3_SUPPORTED_TARGET) {
      throw new ConflictError(
        ErrorCode.CASE_INVALID_TRANSITION,
        `Phase 3 only supports transitioning to ${PHASE_3_SUPPORTED_TARGET} — later lifecycle steps require Phase 4+ data that doesn't exist yet.`,
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
