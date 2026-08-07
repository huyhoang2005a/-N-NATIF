import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@r2m/authz";
import { AssessmentService } from "./assessment.service";
import type { AssessmentFrameworkRepository } from "./assessment-framework.repository";
import type { AssessmentRepository } from "./assessment.repository";
import type { TechnologyCaseRepository } from "../technology-case/technology-case.repository";
import type { TechnologyCaseService } from "../technology-case/technology-case.service";
import type { AuditService } from "../platform-operations/audit/audit.service";
import type { OutboxService } from "../platform-operations/jobs/outbox.service";

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

const evidenceCollectionCase = {
  id: "case-1",
  owningOrganizationId: "org-1",
  lifecycleStatus: "EVIDENCE_COLLECTION",
  version: 1,
};

const draftAssessment = {
  id: "assessment-1",
  technologyCaseId: "case-1",
  frameworkId: "framework-1",
  status: "DRAFT",
  compositeScore: null,
  createdByUserId: "owner-1",
  submittedByUserId: null,
  approvedByUserId: null,
  submittedAt: null,
  approvedAt: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  version: 1,
};

const submittedAssessment = { ...draftAssessment, status: "SUBMITTED" };

const criterion = {
  id: "criterion-1",
  frameworkId: "framework-1",
  criterionCode: "TECHNICAL_MATURITY",
  minScore: "0",
  maxScore: "10",
  weight: "1.5",
  requiresEvidence: true,
  requiresCitation: false,
};

function buildService() {
  const repository = {
    create: vi.fn(),
    findById: vi.fn(),
    listByCase: vi.fn(),
    findApprovedByCase: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn(),
    upsertScore: vi.fn(),
    replaceScoreEvidenceLinks: vi.fn().mockResolvedValue(undefined),
    replaceScoreCitationLinks: vi.fn().mockResolvedValue(undefined),
    findScoresWithCriteriaByAssessment: vi.fn(),
  } as unknown as AssessmentRepository;

  const frameworkRepository = {
    findById: vi.fn(),
    findActiveFramework: vi.fn(),
    findCriteriaByFramework: vi.fn(),
    findCriterionById: vi.fn(),
  } as unknown as AssessmentFrameworkRepository;

  const caseRepository = {
    findById: vi.fn(),
    findActiveMembership: vi.fn(),
  } as unknown as TechnologyCaseRepository;

  const caseService = {
    applyTransition: vi.fn().mockResolvedValue(undefined),
    assertVisible: vi.fn().mockResolvedValue(undefined),
  } as unknown as TechnologyCaseService;

  const auditService = { write: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const outboxService = { append: vi.fn().mockResolvedValue(undefined) } as unknown as OutboxService;
  const db = { transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb({})) };

  const service = new AssessmentService(
    repository,
    frameworkRepository,
    caseRepository,
    caseService,
    auditService,
    outboxService,
    db as never,
  );

  return { service, repository, frameworkRepository, caseRepository, caseService, auditService, outboxService };
}

describe("AssessmentService.upsertScore", () => {
  it("refuses when the assessment is not DRAFT", async () => {
    const { service, repository, caseRepository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(submittedAssessment as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(evidenceCollectionCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);

    await expect(
      service.upsertScore(owner, "assessment-1", "criterion-1", { score: 5, rationale: "ok", evidenceIds: [], citationIds: [] }, null),
    ).rejects.toMatchObject({ code: "ASSESSMENT_INVALID_TRANSITION" });
  });

  it("refuses a criterion from a different framework", async () => {
    const { service, repository, caseRepository, frameworkRepository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(draftAssessment as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(evidenceCollectionCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);
    vi.mocked(frameworkRepository.findCriterionById).mockResolvedValue({
      ...criterion,
      frameworkId: "other-framework",
    } as never);

    await expect(
      service.upsertScore(owner, "assessment-1", "criterion-1", { score: 5, rationale: "ok", evidenceIds: [], citationIds: [] }, null),
    ).rejects.toMatchObject({ code: "ASSESSMENT_CRITERION_FRAMEWORK_MISMATCH" });
  });

  it("refuses a score out of the criterion's [min, max] range", async () => {
    const { service, repository, caseRepository, frameworkRepository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(draftAssessment as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(evidenceCollectionCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);
    vi.mocked(frameworkRepository.findCriterionById).mockResolvedValue(criterion as never);

    await expect(
      service.upsertScore(owner, "assessment-1", "criterion-1", { score: 11, rationale: "ok", evidenceIds: [], citationIds: [] }, null),
    ).rejects.toMatchObject({ code: "ASSESSMENT_SCORE_OUT_OF_RANGE" });
  });

  it("refuses a CASE_REVIEWER — rule 12: only OWNER/TECHNICAL_MEMBER enter scores", async () => {
    const { service, repository, caseRepository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(draftAssessment as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(evidenceCollectionCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "CASE_REVIEWER" } as never);

    await expect(
      service.upsertScore(reviewer, "assessment-1", "criterion-1", { score: 5, rationale: "ok", evidenceIds: [], citationIds: [] }, null),
    ).rejects.toMatchObject({ code: "AUTH_FORBIDDEN" });
  });
});

describe("AssessmentService.submit", () => {
  it("refuses when the assessment has no scores", async () => {
    const { service, repository, caseRepository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(draftAssessment as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(evidenceCollectionCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);
    vi.mocked(repository.findScoresWithCriteriaByAssessment).mockResolvedValue([]);

    await expect(service.submit(owner, "assessment-1", null)).rejects.toMatchObject({
      code: "ASSESSMENT_HAS_NO_SCORES",
    });
  });

  it("refuses when a criterion requiring evidence has none linked", async () => {
    const { service, repository, caseRepository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(draftAssessment as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(evidenceCollectionCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);
    vi.mocked(repository.findScoresWithCriteriaByAssessment).mockResolvedValue([
      { score: "8", criterionId: "criterion-1", criterion, evidenceLinks: [], citationLinks: [] },
    ] as never);

    await expect(service.submit(owner, "assessment-1", null)).rejects.toMatchObject({
      code: "ASSESSMENT_SCORE_MISSING_EVIDENCE",
    });
  });

  it("computes the composite score, sets SUBMITTED, and auto-transitions an EVIDENCE_COLLECTION case", async () => {
    const { service, repository, caseRepository, caseService, outboxService } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(draftAssessment as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(evidenceCollectionCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);
    vi.mocked(repository.findScoresWithCriteriaByAssessment).mockResolvedValue([
      { score: "8", criterionId: "criterion-1", criterion, evidenceLinks: [{ evidenceId: "ev-1" }], citationLinks: [] },
    ] as never);
    vi.mocked(repository.updateStatus).mockResolvedValue({
      ...draftAssessment,
      status: "SUBMITTED",
      compositeScore: "80.0000",
    } as never);

    const result = await service.submit(owner, "assessment-1", null);

    expect(repository.updateStatus).toHaveBeenCalledWith(
      "assessment-1",
      1,
      "SUBMITTED",
      {},
      expect.objectContaining({ compositeScore: "80.0000" }),
    );
    expect(outboxService.append).toHaveBeenCalledWith(
      "readiness_assessment",
      "assessment-1",
      expect.objectContaining({ type: "AssessmentSubmitted" }),
      {},
    );
    expect(caseService.applyTransition).toHaveBeenCalledWith(
      {},
      owner,
      evidenceCollectionCase,
      "UNDER_ASSESSMENT",
      expect.any(String),
      null,
    );
    expect(result.status).toBe("SUBMITTED");
    expect(result.compositeScore).toBe(80);
  });
});

describe("AssessmentService.decide (rule 12 — separation of duties)", () => {
  it("refuses an OWNER — only CASE_REVIEWER may decide", async () => {
    const { service, repository, caseRepository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(submittedAssessment as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(evidenceCollectionCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);

    await expect(service.decide(owner, "assessment-1", { decision: "APPROVE" }, null)).rejects.toMatchObject({
      code: "AUTH_FORBIDDEN",
    });
  });

  it("APPROVE: sets APPROVED, supersedes the previous APPROVED assessment, and emits AssessmentApproved", async () => {
    const { service, repository, caseRepository, outboxService } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(submittedAssessment as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(evidenceCollectionCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "CASE_REVIEWER" } as never);
    vi.mocked(repository.findScoresWithCriteriaByAssessment).mockResolvedValue([
      { score: "8", criterionId: "criterion-1", criterion, evidenceLinks: [{ evidenceId: "ev-1" }], citationLinks: [] },
    ] as never);
    vi.mocked(repository.updateStatus).mockResolvedValue({
      ...submittedAssessment,
      status: "APPROVED",
      compositeScore: "80.0000",
    } as never);
    vi.mocked(repository.findApprovedByCase).mockResolvedValue({ id: "assessment-old", version: 3 } as never);

    const result = await service.decide(reviewer, "assessment-1", { decision: "APPROVE" }, null);

    expect(repository.updateStatus).toHaveBeenCalledWith("assessment-old", 3, "SUPERSEDED", {});
    expect(outboxService.append).toHaveBeenCalledWith(
      "readiness_assessment",
      "assessment-1",
      expect.objectContaining({ type: "AssessmentApproved" }),
      {},
    );
    expect(result.status).toBe("APPROVED");
  });

  it("REJECT: reverts to DRAFT and does not emit an outbox event", async () => {
    const { service, repository, caseRepository, outboxService } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(submittedAssessment as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(evidenceCollectionCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "CASE_REVIEWER" } as never);
    vi.mocked(repository.updateStatus).mockResolvedValue({ ...submittedAssessment, status: "DRAFT" } as never);

    const result = await service.decide(reviewer, "assessment-1", { decision: "REJECT", reason: "Needs more evidence" }, null);

    expect(outboxService.append).not.toHaveBeenCalled();
    expect(result.status).toBe("DRAFT");
  });
});

describe("AssessmentService.listScores", () => {
  it("refuses when the assessment does not exist", async () => {
    const { service, repository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(undefined);

    await expect(service.listScores(owner, "assessment-1")).rejects.toMatchObject({
      code: "ASSESSMENT_NOT_FOUND",
    });
  });

  it("returns scores joined with criterion details", async () => {
    const { service, repository, caseRepository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(draftAssessment as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(evidenceCollectionCase as never);
    vi.mocked(repository.findScoresWithCriteriaByAssessment).mockResolvedValue([
      {
        id: "score-1",
        assessmentId: "assessment-1",
        criterionId: "criterion-1",
        score: "8",
        rationale: "Strong prototype",
        createdByUserId: "owner-1",
        updatedByUserId: "owner-1",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
        criterion,
        evidenceLinks: [{ evidenceId: "ev-1" }],
        citationLinks: [],
      },
    ] as never);

    const result = await service.listScores(owner, "assessment-1");
    expect(result).toHaveLength(1);
    expect(result[0]?.score).toBe(8);
    expect(result[0]?.evidenceIds).toEqual(["ev-1"]);
  });
});
