import type {
  CreateDependencyRequest,
  CreateMilestoneRequest,
  CreateRoadmapRequest,
  CreateRoadmapReviewRequest,
  CreateTaskRequest,
  LinkMilestoneGapRequest,
  MilestoneDependencyResponse,
  RoadmapMilestoneResponse,
  RoadmapResponse,
  RoadmapTaskResponse,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import type { Database } from "@r2m/database";
import {
  CaseMemberRole,
  ConflictError,
  ErrorCode,
  ForbiddenError,
  NotFoundError,
  RoadmapStatus,
  TechnologyCaseStatus,
} from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../database/database.module";
import { AuditService } from "../platform-operations/audit/audit.service";
import { OutboxService } from "../platform-operations/jobs/outbox.service";
import { TechnologyCaseRepository } from "../technology-case/technology-case.repository";
import { TechnologyCaseService } from "../technology-case/technology-case.service";
import { GapRepository } from "../assessment-gap/gap.repository";
import { wouldCreateCycle } from "./domain/cycle-detection";
import { assertRoadmapTransition } from "./domain/roadmap.state-machine";
import { RoadmapRepository } from "./roadmap.repository";

const WRITE_ROLES: readonly string[] = [CaseMemberRole.OWNER, CaseMemberRole.TECHNICAL_MEMBER];

function toRoadmapResponse(row: {
  id: string;
  technologyCaseId: string;
  versionNo: number;
  title: string;
  objective: string | null;
  status: string;
  createdByUserId: string;
  submittedByUserId: string | null;
  approvedByUserId: string | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}): RoadmapResponse {
  return {
    id: row.id,
    technologyCaseId: row.technologyCaseId,
    versionNo: row.versionNo,
    title: row.title,
    objective: row.objective,
    status: row.status,
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

function toMilestoneResponse(row: {
  id: string;
  roadmapId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  ownerUserId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): RoadmapMilestoneResponse {
  return {
    id: row.id,
    roadmapId: row.roadmapId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    startDate: row.startDate,
    dueDate: row.dueDate,
    ownerUserId: row.ownerUserId,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTaskResponse(row: {
  id: string;
  milestoneId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeUserId: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: Date | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): RoadmapTaskResponse {
  return {
    id: row.id,
    milestoneId: row.milestoneId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeUserId: row.assigneeUserId,
    startDate: row.startDate,
    dueDate: row.dueDate,
    completedAt: row.completedAt?.toISOString() ?? null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDependencyResponse(row: {
  id: string;
  predecessorMilestoneId: string;
  successorMilestoneId: string;
  dependencyType: string;
  lagDays: number;
  createdAt: Date;
}): MilestoneDependencyResponse {
  return {
    id: row.id,
    predecessorMilestoneId: row.predecessorMilestoneId,
    successorMilestoneId: row.successorMilestoneId,
    dependencyType: row.dependencyType,
    lagDays: row.lagDays,
    createdAt: row.createdAt.toISOString(),
  };
}

/** UC-RDM-01. Bounded context: Roadmap & Transfer (§9.7) — chỉ phần Roadmap ở Phase 4,
 * Transfer thuộc Phase 6. */
@Injectable()
export class RoadmapService {
  constructor(
    private readonly repository: RoadmapRepository,
    private readonly caseRepository: TechnologyCaseRepository,
    private readonly caseService: TechnologyCaseService,
    private readonly gapRepository: GapRepository,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  /** Đã chốt sau review (2026-08-06, theo rule 12 CLAUDE.md) — chỉ OWNER/TECHNICAL_MEMBER
   * tạo roadmap/milestone/dependency (nhóm "làm"); CASE_REVIEWER bị loại vì sẽ duyệt
   * chính roadmap này ở bước review. */
  private async assertWriteAllowed(technologyCaseId: string, actor: ActorContext): Promise<void> {
    const membership = await this.caseRepository.findActiveMembership(technologyCaseId, actor.userId);
    if (!membership || !WRITE_ROLES.includes(membership.role)) {
      throw new ForbiddenError(
        ErrorCode.AUTH_FORBIDDEN,
        "Only an active case OWNER or TECHNICAL_MEMBER may edit a roadmap.",
      );
    }
  }

  private async assertRoadmapEditable(roadmap: { status: string }): Promise<void> {
    if (roadmap.status !== RoadmapStatus.DRAFT) {
      throw new ConflictError(
        ErrorCode.ROADMAP_INVALID_TRANSITION,
        "Roadmap can only be edited (milestones/tasks/dependencies) while it is DRAFT.",
        { status: roadmap.status },
      );
    }
  }

  /** Đã chốt sau review (2026-08-06, xem plan PHẦN D quyết định 3): case chuyển
   * `ROADMAP_DRAFT` khi roadmap đầu tiên được tạo — breakdown/UC-RDM-01 không nói rõ
   * thời điểm, chọn mirror pattern `EVIDENCE_COLLECTION`(Phase 3)/`GAP_IDENTIFIED` (đúng
   * tiền lệ). */
  async create(
    actor: ActorContext,
    technologyCaseId: string,
    input: CreateRoadmapRequest,
    requestIdHeader: string | null,
  ): Promise<RoadmapResponse> {
    const technologyCase = await this.caseRepository.findById(technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.assertWriteAllowed(technologyCaseId, actor);

    const latest = await this.repository.findLatestVersionByCase(technologyCaseId);
    const nextVersionNo = (latest?.versionNo ?? 0) + 1;

    const roadmap = await this.db.transaction(async (tx) => {
      const isFirstRoadmap = !(await this.repository.hasAnyRoadmap(technologyCaseId, tx));

      const created = await this.repository.create(
        {
          technologyCaseId,
          versionNo: nextVersionNo,
          title: input.title,
          objective: input.objective,
          createdByUserId: actor.userId,
        },
        tx,
      );

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "roadmap.create",
          entityType: "roadmap",
          entityId: created.id,
          afterData: created,
        },
        tx,
      );

      if (isFirstRoadmap && technologyCase.lifecycleStatus === TechnologyCaseStatus.GAP_IDENTIFIED) {
        await this.caseService.applyTransition(
          tx,
          actor,
          technologyCase,
          TechnologyCaseStatus.ROADMAP_DRAFT,
          "First roadmap created",
          requestIdHeader,
        );
      }

      return created;
    });

    return toRoadmapResponse(roadmap);
  }

  async createMilestone(
    actor: ActorContext,
    roadmapId: string,
    input: CreateMilestoneRequest,
    requestIdHeader: string | null,
  ): Promise<RoadmapMilestoneResponse> {
    const roadmap = await this.repository.findById(roadmapId);
    if (!roadmap) {
      throw new NotFoundError(ErrorCode.ROADMAP_NOT_FOUND, "Roadmap not found.");
    }
    const technologyCase = await this.caseRepository.findById(roadmap.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.assertWriteAllowed(roadmap.technologyCaseId, actor);
    await this.assertRoadmapEditable(roadmap);

    const sortOrder = await this.repository.countMilestonesByRoadmap(roadmapId);
    const milestone = await this.db.transaction(async (tx) => {
      const created = await this.repository.createMilestone(
        {
          roadmapId,
          title: input.title,
          description: input.description,
          priority: input.priority,
          startDate: input.startDate,
          dueDate: input.dueDate,
          ownerUserId: input.ownerUserId,
          sortOrder,
        },
        tx,
      );
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "roadmap.create_milestone",
          entityType: "roadmap_milestone",
          entityId: created.id,
          afterData: created,
        },
        tx,
      );
      return created;
    });

    return toMilestoneResponse(milestone);
  }

  async createTask(
    actor: ActorContext,
    milestoneId: string,
    input: CreateTaskRequest,
    requestIdHeader: string | null,
  ): Promise<RoadmapTaskResponse> {
    const milestone = await this.repository.findMilestoneById(milestoneId);
    if (!milestone) {
      throw new NotFoundError(ErrorCode.MILESTONE_NOT_FOUND, "Milestone not found.");
    }
    const roadmap = await this.repository.findById(milestone.roadmapId);
    if (!roadmap) {
      throw new NotFoundError(ErrorCode.ROADMAP_NOT_FOUND, "Roadmap not found.");
    }
    const technologyCase = await this.caseRepository.findById(roadmap.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.assertWriteAllowed(roadmap.technologyCaseId, actor);
    await this.assertRoadmapEditable(roadmap);

    const task = await this.db.transaction(async (tx) => {
      const created = await this.repository.createTask(
        {
          milestoneId,
          title: input.title,
          description: input.description,
          priority: input.priority,
          assigneeUserId: input.assigneeUserId,
          startDate: input.startDate,
          dueDate: input.dueDate,
          sortOrder: 0,
        },
        tx,
      );
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "roadmap.create_task",
          entityType: "roadmap_task",
          entityId: created.id,
          afterData: created,
        },
        tx,
      );
      return created;
    });

    return toTaskResponse(task);
  }

  /** Cycle detection (quyết định 5) — port `prevent_milestone_dependency_cycle` sang
   * app layer (`domain/cycle-detection.ts`), unit test riêng, viết TRƯỚC service này
   * (đúng ghi chú Phase 4 mới CLAUDE.md). Self-loop cũng bị chặn bởi
   * `wouldCreateCycle` (xem file đó), không cần check riêng. */
  async createDependency(
    actor: ActorContext,
    roadmapId: string,
    input: CreateDependencyRequest,
    requestIdHeader: string | null,
  ): Promise<MilestoneDependencyResponse> {
    const roadmap = await this.repository.findById(roadmapId);
    if (!roadmap) {
      throw new NotFoundError(ErrorCode.ROADMAP_NOT_FOUND, "Roadmap not found.");
    }
    const technologyCase = await this.caseRepository.findById(roadmap.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.assertWriteAllowed(roadmap.technologyCaseId, actor);
    await this.assertRoadmapEditable(roadmap);

    const predecessor = await this.repository.findMilestoneById(input.predecessorMilestoneId);
    const successor = await this.repository.findMilestoneById(input.successorMilestoneId);
    if (!predecessor || !successor) {
      throw new NotFoundError(ErrorCode.MILESTONE_NOT_FOUND, "Milestone not found.");
    }
    if (predecessor.roadmapId !== roadmapId || successor.roadmapId !== roadmapId) {
      throw new ConflictError(
        ErrorCode.MILESTONE_DEPENDENCIES_MUST_BE_IN_SAME_ROADMAP,
        "Both milestones in a dependency must belong to the same roadmap.",
      );
    }

    const existingEdges = await this.repository.findDependencyEdgesByRoadmap(roadmapId);
    if (wouldCreateCycle(existingEdges, input.predecessorMilestoneId, input.successorMilestoneId)) {
      throw new ConflictError(
        ErrorCode.MILESTONE_DEPENDENCY_CYCLE_DETECTED,
        "Adding this dependency would create a cycle in the milestone dependency graph.",
        { predecessorMilestoneId: input.predecessorMilestoneId, successorMilestoneId: input.successorMilestoneId },
      );
    }

    const dependency = await this.db.transaction(async (tx) => {
      const created = await this.repository.createDependency(
        {
          predecessorMilestoneId: input.predecessorMilestoneId,
          successorMilestoneId: input.successorMilestoneId,
          dependencyType: input.dependencyType,
          lagDays: input.lagDays,
        },
        tx,
      );
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "roadmap.create_dependency",
          entityType: "milestone_dependency",
          entityId: created.id,
          afterData: created,
        },
        tx,
      );
      return created;
    });

    return toDependencyResponse(dependency);
  }

  async linkMilestoneGap(
    actor: ActorContext,
    milestoneId: string,
    input: LinkMilestoneGapRequest,
    requestIdHeader: string | null,
  ): Promise<void> {
    const milestone = await this.repository.findMilestoneById(milestoneId);
    if (!milestone) {
      throw new NotFoundError(ErrorCode.MILESTONE_NOT_FOUND, "Milestone not found.");
    }
    const roadmap = await this.repository.findById(milestone.roadmapId);
    if (!roadmap) {
      throw new NotFoundError(ErrorCode.ROADMAP_NOT_FOUND, "Roadmap not found.");
    }
    const technologyCase = await this.caseRepository.findById(roadmap.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.assertWriteAllowed(roadmap.technologyCaseId, actor);
    await this.assertRoadmapEditable(roadmap);

    const gap = await this.gapRepository.findById(input.gapRecordId);
    if (!gap || gap.technologyCaseId !== roadmap.technologyCaseId) {
      throw new NotFoundError(ErrorCode.GAP_NOT_FOUND, "Gap not found for this case.");
    }

    await this.db.transaction(async (tx) => {
      const created = await this.repository.createMilestoneGapLink({ milestoneId, gapRecordId: input.gapRecordId }, tx);
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "roadmap.link_milestone_gap",
          entityType: "milestone_gap",
          entityId: created.id,
          afterData: created,
        },
        tx,
      );
    });
  }

  async submit(
    actor: ActorContext,
    roadmapId: string,
    requestIdHeader: string | null,
  ): Promise<RoadmapResponse> {
    const roadmap = await this.repository.findById(roadmapId);
    if (!roadmap) {
      throw new NotFoundError(ErrorCode.ROADMAP_NOT_FOUND, "Roadmap not found.");
    }
    const technologyCase = await this.caseRepository.findById(roadmap.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.assertWriteAllowed(roadmap.technologyCaseId, actor);
    assertRoadmapTransition(roadmap.status as RoadmapStatus, RoadmapStatus.IN_REVIEW);

    const updated = await this.db.transaction(async (tx) => {
      const result = await this.repository.updateStatus(roadmapId, roadmap.version, RoadmapStatus.IN_REVIEW, tx, {
        submittedAt: new Date(),
        submittedByUserId: actor.userId,
      });
      if (!result) {
        throw new ConflictError(ErrorCode.ROADMAP_INVALID_TRANSITION, "Roadmap was modified concurrently — retry.");
      }
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "roadmap.submit",
          entityType: "roadmap",
          entityId: roadmapId,
          beforeData: { status: roadmap.status },
          afterData: { status: result.status },
        },
        tx,
      );
      return result;
    });

    return toRoadmapResponse(updated);
  }

  /** Đã chốt sau review (2026-08-06, theo rule 12 CLAUDE.md) — chỉ CASE_REVIEWER được
   * review (KHÔNG gồm OWNER, tránh owner tự tạo roadmap rồi tự duyệt). `decision`→
   * `RoadmapStatus` giữ nguyên 3 nhánh tách biệt (xem `domain/roadmap.state-machine.ts`):
   * APPROVED→APPROVED, REJECTED→REJECTED (terminal), CHANGES_REQUESTED→DRAFT. Port
   * `validate_roadmap_approval` (gate: không CRITICAL gap mở + có ≥1 milestone) sang
   * app layer, không dùng DB trigger (đúng quyết định 6). */
  async review(
    actor: ActorContext,
    roadmapId: string,
    input: CreateRoadmapReviewRequest,
    requestIdHeader: string | null,
  ): Promise<RoadmapResponse> {
    const roadmap = await this.repository.findById(roadmapId);
    if (!roadmap) {
      throw new NotFoundError(ErrorCode.ROADMAP_NOT_FOUND, "Roadmap not found.");
    }
    const technologyCase = await this.caseRepository.findById(roadmap.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    const membership = await this.caseRepository.findActiveMembership(roadmap.technologyCaseId, actor.userId);
    if (membership?.role !== CaseMemberRole.CASE_REVIEWER) {
      throw new ForbiddenError(
        ErrorCode.AUTH_FORBIDDEN,
        "Only an active case CASE_REVIEWER may review a roadmap.",
      );
    }

    const targetStatus =
      input.decision === "APPROVED"
        ? RoadmapStatus.APPROVED
        : input.decision === "REJECTED"
          ? RoadmapStatus.REJECTED
          : RoadmapStatus.DRAFT;
    assertRoadmapTransition(roadmap.status as RoadmapStatus, targetStatus);

    if (targetStatus === RoadmapStatus.APPROVED) {
      const milestoneCount = await this.repository.countMilestonesByRoadmap(roadmapId);
      if (milestoneCount === 0) {
        throw new ConflictError(ErrorCode.ROADMAP_HAS_NO_MILESTONES, "Roadmap has no milestones — cannot approve.");
      }
      const openCriticalGaps = await this.gapRepository.findOpenCriticalGaps(roadmap.technologyCaseId);
      if (openCriticalGaps.length > 0) {
        throw new ConflictError(
          ErrorCode.ROADMAP_HAS_UNRESOLVED_CRITICAL_GAPS,
          "Cannot approve roadmap while CRITICAL gaps remain OPEN or IN_PROGRESS.",
          { openCriticalGapIds: openCriticalGaps.map((g) => g.id) },
        );
      }
    }

    const updated = await this.db.transaction(async (tx) => {
      await this.repository.createReview(
        { roadmapId, reviewerUserId: actor.userId, decision: input.decision, comment: input.comment },
        tx,
      );

      const result = await this.repository.updateStatus(roadmapId, roadmap.version, targetStatus, tx, {
        approvedAt: targetStatus === RoadmapStatus.APPROVED ? new Date() : undefined,
        approvedByUserId: targetStatus === RoadmapStatus.APPROVED ? actor.userId : undefined,
      });
      if (!result) {
        throw new ConflictError(ErrorCode.ROADMAP_INVALID_TRANSITION, "Roadmap was modified concurrently — retry.");
      }

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: technologyCase.owningOrganizationId,
          requestId: requestIdHeader,
          action: "roadmap.review",
          entityType: "roadmap",
          entityId: roadmapId,
          beforeData: { status: roadmap.status },
          afterData: { status: result.status, decision: input.decision },
        },
        tx,
      );

      if (targetStatus === RoadmapStatus.APPROVED) {
        await this.outboxService.append(
          "roadmap",
          roadmapId,
          {
            type: "RoadmapApproved",
            roadmapId,
            technologyCaseId: roadmap.technologyCaseId,
            approvedByUserId: actor.userId,
          },
          tx,
        );
        if (technologyCase.lifecycleStatus === TechnologyCaseStatus.ROADMAP_DRAFT) {
          await this.caseService.applyTransition(
            tx,
            actor,
            technologyCase,
            TechnologyCaseStatus.ROADMAP_APPROVED,
            "Roadmap approved",
            requestIdHeader,
          );
        }
      }

      return result;
    });

    return toRoadmapResponse(updated);
  }

  async getById(actor: ActorContext, id: string): Promise<RoadmapResponse> {
    const roadmap = await this.repository.findById(id);
    if (!roadmap) {
      throw new NotFoundError(ErrorCode.ROADMAP_NOT_FOUND, "Roadmap not found.");
    }
    const technologyCase = await this.caseRepository.findById(roadmap.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.caseService.assertVisible(actor, technologyCase);
    return toRoadmapResponse(roadmap);
  }

  async listByCase(actor: ActorContext, technologyCaseId: string): Promise<RoadmapResponse[]> {
    const technologyCase = await this.caseRepository.findById(technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.caseService.assertVisible(actor, technologyCase);
    const rows = await this.repository.listByCase(technologyCaseId);
    return rows.map(toRoadmapResponse);
  }

  async listMilestones(actor: ActorContext, roadmapId: string): Promise<RoadmapMilestoneResponse[]> {
    const roadmap = await this.repository.findById(roadmapId);
    if (!roadmap) {
      throw new NotFoundError(ErrorCode.ROADMAP_NOT_FOUND, "Roadmap not found.");
    }
    const technologyCase = await this.caseRepository.findById(roadmap.technologyCaseId);
    if (!technologyCase) {
      throw new NotFoundError(ErrorCode.CASE_NOT_FOUND, "Technology case not found.");
    }
    await this.caseService.assertVisible(actor, technologyCase);
    const rows = await this.repository.listMilestonesByRoadmap(roadmapId);
    return rows.map(toMilestoneResponse);
  }
}
