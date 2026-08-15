import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@r2m/authz";
import { RoadmapService } from "./roadmap.service";
import type { RoadmapRepository } from "./roadmap.repository";
import type { GapRepository } from "../assessment-gap/gap.repository";
import type { TechnologyCaseRepository } from "../technology-case/technology-case.repository";
import type { TechnologyCaseService } from "../technology-case/technology-case.service";
import type { AuditService } from "../platform-operations/audit/audit.service";
import type { OutboxService } from "../platform-operations/jobs/outbox.service";
import type { GeminiClient } from "../assistant/gemini.client";

const owner: ActorContext = {
  userId: "owner-1",
  platformRole: "USER",
  memberships: [{ organizationId: "org-1", role: "MEMBER", status: "ACTIVE" }],
  authorVerificationStatus: "VERIFIED",
  isEmailVerified: true,
};
const reviewer: ActorContext = {
  userId: "reviewer-1",
  platformRole: "USER",
  memberships: [{ organizationId: "org-1", role: "MEMBER", status: "ACTIVE" }],
  authorVerificationStatus: "VERIFIED",
  isEmailVerified: true,
};

const gapIdentifiedCase = {
  id: "case-1",
  owningOrganizationId: "org-1",
  lifecycleStatus: "GAP_IDENTIFIED",
  version: 1,
};

const draftRoadmap = {
  id: "roadmap-1",
  technologyCaseId: "case-1",
  versionNo: 1,
  title: "Q1 roadmap",
  objective: null,
  status: "DRAFT",
  createdByUserId: "owner-1",
  submittedByUserId: null,
  approvedByUserId: null,
  submittedAt: null,
  approvedAt: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  version: 1,
};

const inReviewRoadmap = { ...draftRoadmap, status: "IN_REVIEW" };

const milestoneA = { id: "milestone-a", roadmapId: "roadmap-1" };
const milestoneB = { id: "milestone-b", roadmapId: "roadmap-1" };

function buildService() {
  const repository = {
    create: vi.fn(),
    findById: vi.fn(),
    listByCase: vi.fn(),
    findLatestVersionByCase: vi.fn().mockResolvedValue(undefined),
    hasAnyRoadmap: vi.fn().mockResolvedValue(false),
    updateStatus: vi.fn(),
    createMilestone: vi.fn(),
    findMilestoneById: vi.fn(),
    listMilestonesByRoadmap: vi.fn().mockResolvedValue([]),
    countMilestonesByRoadmap: vi.fn().mockResolvedValue(0),
    createTask: vi.fn(),
    findDependencyEdgesByRoadmap: vi.fn().mockResolvedValue([]),
    createDependency: vi.fn(),
    createMilestoneGapLink: vi.fn(),
    listGapLinksByMilestone: vi.fn(),
    createReview: vi.fn().mockResolvedValue({ id: "review-1" }),
    listReviewsByRoadmap: vi.fn(),
    listTasksByMilestone: vi.fn(),
  } as unknown as RoadmapRepository;

  const caseRepository = {
    findById: vi.fn(),
    findActiveMembership: vi.fn(),
  } as unknown as TechnologyCaseRepository;

  const caseService = {
    applyTransition: vi.fn().mockResolvedValue(undefined),
    assertVisible: vi.fn().mockResolvedValue(undefined),
  } as unknown as TechnologyCaseService;

  const gapRepository = {
    findById: vi.fn(),
    findOpenCriticalGaps: vi.fn().mockResolvedValue([]),
    listByCase: vi.fn().mockResolvedValue([]),
  } as unknown as GapRepository;

  const auditService = { write: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const outboxService = { append: vi.fn().mockResolvedValue(undefined) } as unknown as OutboxService;
  const geminiClient = { isConfigured: vi.fn().mockReturnValue(false), generateJson: vi.fn() } as unknown as GeminiClient;
  const db = { transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb({})) };

  const service = new RoadmapService(
    repository,
    caseRepository,
    caseService,
    gapRepository,
    auditService,
    outboxService,
    geminiClient,
    db as never,
  );

  return { service, repository, caseRepository, caseService, gapRepository, auditService, outboxService, geminiClient };
}

describe("RoadmapService.create", () => {
  it("refuses a CASE_REVIEWER — rule 12: reviewer must not also author the roadmap it will review", async () => {
    const { service, caseRepository } = buildService();
    vi.mocked(caseRepository.findById).mockResolvedValue(gapIdentifiedCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "CASE_REVIEWER" } as never);

    await expect(service.create(reviewer, "case-1", { title: "Q1 roadmap" }, null)).rejects.toMatchObject({
      code: "AUTH_FORBIDDEN",
    });
  });

  it("auto-transitions a GAP_IDENTIFIED case to ROADMAP_DRAFT on the first roadmap", async () => {
    const { service, repository, caseRepository, caseService } = buildService();
    vi.mocked(caseRepository.findById).mockResolvedValue(gapIdentifiedCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);
    vi.mocked(repository.hasAnyRoadmap).mockResolvedValue(false);
    vi.mocked(repository.create).mockResolvedValue(draftRoadmap as never);

    await service.create(owner, "case-1", { title: "Q1 roadmap" }, null);

    expect(caseService.applyTransition).toHaveBeenCalledWith(
      {},
      owner,
      gapIdentifiedCase,
      "ROADMAP_DRAFT",
      expect.any(String),
      null,
    );
  });
});

describe("RoadmapService.createDependency (cycle + cross-roadmap guards)", () => {
  it("refuses when the two milestones don't share a roadmap", async () => {
    const { service, repository, caseRepository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(draftRoadmap as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(gapIdentifiedCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);
    vi.mocked(repository.findMilestoneById).mockResolvedValueOnce(milestoneA as never).mockResolvedValueOnce({
      id: "milestone-c",
      roadmapId: "other-roadmap",
    } as never);

    await expect(
      service.createDependency(
        owner,
        "roadmap-1",
        { predecessorMilestoneId: "milestone-a", successorMilestoneId: "milestone-c", dependencyType: "FINISH_TO_START", lagDays: 0 },
        null,
      ),
    ).rejects.toMatchObject({ code: "MILESTONE_DEPENDENCIES_MUST_BE_IN_SAME_ROADMAP" });
  });

  it("refuses a dependency that would create a cycle", async () => {
    const { service, repository, caseRepository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(draftRoadmap as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(gapIdentifiedCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);
    vi.mocked(repository.findMilestoneById).mockResolvedValueOnce(milestoneA as never).mockResolvedValueOnce(milestoneB as never);
    vi.mocked(repository.findDependencyEdgesByRoadmap).mockResolvedValue([
      { predecessorMilestoneId: "milestone-b", successorMilestoneId: "milestone-a" },
    ] as never);

    await expect(
      service.createDependency(
        owner,
        "roadmap-1",
        { predecessorMilestoneId: "milestone-a", successorMilestoneId: "milestone-b", dependencyType: "FINISH_TO_START", lagDays: 0 },
        null,
      ),
    ).rejects.toMatchObject({ code: "MILESTONE_DEPENDENCY_CYCLE_DETECTED" });
  });

  it("refuses editing a roadmap that is no longer DRAFT", async () => {
    const { service, repository, caseRepository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(inReviewRoadmap as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(gapIdentifiedCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);

    await expect(
      service.createDependency(
        owner,
        "roadmap-1",
        { predecessorMilestoneId: "milestone-a", successorMilestoneId: "milestone-b", dependencyType: "FINISH_TO_START", lagDays: 0 },
        null,
      ),
    ).rejects.toMatchObject({ code: "ROADMAP_INVALID_TRANSITION" });
  });
});

describe("RoadmapService.review (rule 12 + critical-gap gate)", () => {
  it("refuses an OWNER — only CASE_REVIEWER may review", async () => {
    const { service, repository, caseRepository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(inReviewRoadmap as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(gapIdentifiedCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);

    await expect(
      service.review(owner, "roadmap-1", { decision: "APPROVED" }, null),
    ).rejects.toMatchObject({ code: "AUTH_FORBIDDEN" });
  });

  it("refuses APPROVE when the roadmap has no milestones", async () => {
    const { service, repository, caseRepository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(inReviewRoadmap as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(gapIdentifiedCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "CASE_REVIEWER" } as never);
    vi.mocked(repository.countMilestonesByRoadmap).mockResolvedValue(0);

    await expect(
      service.review(reviewer, "roadmap-1", { decision: "APPROVED" }, null),
    ).rejects.toMatchObject({ code: "ROADMAP_HAS_NO_MILESTONES" });
  });

  it("refuses APPROVE while a CRITICAL gap is still OPEN — port of validate_roadmap_approval", async () => {
    const { service, repository, caseRepository, gapRepository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(inReviewRoadmap as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(gapIdentifiedCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "CASE_REVIEWER" } as never);
    vi.mocked(repository.countMilestonesByRoadmap).mockResolvedValue(1);
    vi.mocked(gapRepository.findOpenCriticalGaps).mockResolvedValue([{ id: "gap-1" }] as never);

    await expect(
      service.review(reviewer, "roadmap-1", { decision: "APPROVED" }, null),
    ).rejects.toMatchObject({ code: "ROADMAP_HAS_UNRESOLVED_CRITICAL_GAPS" });
  });

  it("APPROVE: passes the gate, sets APPROVED, emits RoadmapApproved, and transitions the case", async () => {
    const { service, repository, caseRepository, gapRepository, caseService, outboxService } = buildService();
    const roadmapDraftCase = { ...gapIdentifiedCase, lifecycleStatus: "ROADMAP_DRAFT" };
    vi.mocked(repository.findById).mockResolvedValue(inReviewRoadmap as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(roadmapDraftCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "CASE_REVIEWER" } as never);
    vi.mocked(repository.countMilestonesByRoadmap).mockResolvedValue(1);
    vi.mocked(gapRepository.findOpenCriticalGaps).mockResolvedValue([]);
    vi.mocked(repository.updateStatus).mockResolvedValue({ ...inReviewRoadmap, status: "APPROVED" } as never);

    const result = await service.review(reviewer, "roadmap-1", { decision: "APPROVED", comment: "LGTM" }, null);

    expect(outboxService.append).toHaveBeenCalledWith(
      "roadmap",
      "roadmap-1",
      expect.objectContaining({ type: "RoadmapApproved" }),
      {},
    );
    expect(caseService.applyTransition).toHaveBeenCalledWith(
      {},
      reviewer,
      roadmapDraftCase,
      "ROADMAP_APPROVED",
      expect.any(String),
      null,
    );
    expect(result.status).toBe("APPROVED");
  });

  it("CHANGES_REQUESTED: reverts to DRAFT and does not emit an outbox event", async () => {
    const { service, repository, caseRepository, outboxService } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(inReviewRoadmap as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(gapIdentifiedCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "CASE_REVIEWER" } as never);
    vi.mocked(repository.updateStatus).mockResolvedValue({ ...inReviewRoadmap, status: "DRAFT" } as never);

    const result = await service.review(
      reviewer,
      "roadmap-1",
      { decision: "CHANGES_REQUESTED", comment: "Add milestone dates" },
      null,
    );

    expect(outboxService.append).not.toHaveBeenCalled();
    expect(result.status).toBe("DRAFT");
  });
});

describe("RoadmapService read endpoints (dependencies/reviews/milestone tasks/milestone gaps)", () => {
  it("listDependencies refuses when the roadmap does not exist", async () => {
    const { service, repository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(undefined);

    await expect(service.listDependencies(owner, "roadmap-1")).rejects.toMatchObject({
      code: "ROADMAP_NOT_FOUND",
    });
  });

  it("listReviews returns the roadmap's review history", async () => {
    const { service, repository, caseRepository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(draftRoadmap as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(gapIdentifiedCase as never);
    vi.mocked(repository.listReviewsByRoadmap).mockResolvedValue([
      {
        id: "review-1",
        roadmapId: "roadmap-1",
        reviewerUserId: "reviewer-1",
        decision: "CHANGES_REQUESTED",
        comment: "Add milestone dates",
        createdAt: new Date("2024-01-01T00:00:00Z"),
      },
    ] as never);

    const result = await service.listReviews(owner, "roadmap-1");
    expect(result).toHaveLength(1);
    expect(result[0]?.decision).toBe("CHANGES_REQUESTED");
  });

  it("listMilestoneTasks refuses when the milestone does not exist", async () => {
    const { service, repository } = buildService();
    vi.mocked(repository.findMilestoneById).mockResolvedValue(undefined);

    await expect(service.listMilestoneTasks(owner, "milestone-a")).rejects.toMatchObject({
      code: "MILESTONE_NOT_FOUND",
    });
  });

  it("listMilestoneGaps returns the gaps linked to a milestone", async () => {
    const { service, repository, caseRepository } = buildService();
    vi.mocked(repository.findMilestoneById).mockResolvedValue(milestoneA as never);
    vi.mocked(repository.findById).mockResolvedValue(draftRoadmap as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(gapIdentifiedCase as never);
    vi.mocked(repository.listGapLinksByMilestone).mockResolvedValue([
      {
        id: "link-1",
        milestoneId: "milestone-a",
        gapRecordId: "gap-1",
        gap: {
          id: "gap-1",
          technologyCaseId: "case-1",
          sourceAssessmentId: null,
          sourceAssessmentScoreId: null,
          title: "Missing IP filing",
          description: "No patent filed yet",
          category: null,
          severity: "CRITICAL",
          status: "OPEN",
          ownerUserId: null,
          dueDate: null,
          createdByUserId: "owner-1",
          resolvedByUserId: null,
          resolvedAt: null,
          resolutionNote: null,
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-01T00:00:00Z"),
          version: 1,
        },
      },
    ] as never);

    const result = await service.listMilestoneGaps(owner, "milestone-a");
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("gap-1");
  });
});
