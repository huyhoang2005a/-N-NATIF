import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@r2m/authz";
import type { CreateGapRequest } from "@r2m/contracts";
import { GapService } from "./gap.service";
import type { GapRepository } from "./gap.repository";
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
const technicalMember: ActorContext = {
  userId: "tm-1",
  platformRole: "USER",
  memberships: [{ organizationId: "org-1", role: "MEMBER", status: "ACTIVE" }],
  authorVerificationStatus: "VERIFIED",
  isEmailVerified: true,
};

const underAssessmentCase = {
  id: "case-1",
  owningOrganizationId: "org-1",
  lifecycleStatus: "UNDER_ASSESSMENT",
  version: 1,
};

const createInput: CreateGapRequest = {
  title: "Missing IP filing",
  description: "No patent filed yet",
  severity: "CRITICAL",
  evidenceIds: [],
};

const existingGap = {
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
};

function buildService() {
  const repository = {
    create: vi.fn(),
    createEvidenceLinks: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    listByCase: vi.fn(),
    hasAnyGap: vi.fn().mockResolvedValue(false),
    findOpenCriticalGaps: vi.fn(),
    update: vi.fn(),
  } as unknown as GapRepository;

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

  const service = new GapService(repository, caseRepository, caseService, auditService, outboxService, db as never);

  return { service, repository, caseRepository, caseService, auditService, outboxService };
}

describe("GapService.create (UC-GAP-01)", () => {
  it("refuses when neither a source assessment nor any evidence is given", async () => {
    const { service, caseRepository } = buildService();
    vi.mocked(caseRepository.findById).mockResolvedValue(underAssessmentCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);

    await expect(service.create(owner, "case-1", createInput, null)).rejects.toMatchObject({
      code: "GAP_MISSING_SUPPORT",
    });
  });

  it("allows OWNER, TECHNICAL_MEMBER and CASE_REVIEWER to create a gap (UC-GAP-01 actor list is alternation, not AND — rule 11)", async () => {
    const { service, repository, caseRepository } = buildService();
    vi.mocked(caseRepository.findById).mockResolvedValue(underAssessmentCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "CASE_REVIEWER" } as never);
    vi.mocked(repository.create).mockResolvedValue(existingGap as never);

    const result = await service.create(owner, "case-1", { ...createInput, evidenceIds: ["ev-1"] }, null);
    expect(result.id).toBe("gap-1");
  });

  it("emits CriticalGapRaised only when severity is CRITICAL", async () => {
    const { service, repository, outboxService, caseRepository } = buildService();
    vi.mocked(caseRepository.findById).mockResolvedValue(underAssessmentCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);
    vi.mocked(repository.create).mockResolvedValue({ ...existingGap, severity: "LOW" } as never);

    await service.create(owner, "case-1", { ...createInput, severity: "LOW", evidenceIds: ["ev-1"] }, null);

    expect(outboxService.append).not.toHaveBeenCalled();
  });

  it("emits CriticalGapRaised and auto-transitions the case on the first gap after assessment", async () => {
    const { service, repository, outboxService, caseService, caseRepository } = buildService();
    vi.mocked(caseRepository.findById).mockResolvedValue(underAssessmentCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);
    vi.mocked(repository.hasAnyGap).mockResolvedValue(false);
    vi.mocked(repository.create).mockResolvedValue(existingGap as never);

    await service.create(owner, "case-1", { ...createInput, evidenceIds: ["ev-1"] }, null);

    expect(outboxService.append).toHaveBeenCalledWith(
      "gap_record",
      "gap-1",
      expect.objectContaining({ type: "CriticalGapRaised" }),
      {},
    );
    expect(caseService.applyTransition).toHaveBeenCalledWith(
      {},
      owner,
      underAssessmentCase,
      "GAP_IDENTIFIED",
      expect.any(String),
      null,
    );
  });

  it("does not auto-transition the case on a second gap", async () => {
    const { service, repository, caseService, caseRepository } = buildService();
    vi.mocked(caseRepository.findById).mockResolvedValue(underAssessmentCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);
    vi.mocked(repository.hasAnyGap).mockResolvedValue(true);
    vi.mocked(repository.create).mockResolvedValue(existingGap as never);

    await service.create(owner, "case-1", { ...createInput, evidenceIds: ["ev-1"] }, null);

    expect(caseService.applyTransition).not.toHaveBeenCalled();
  });
});

describe("GapService.transition", () => {
  it("refuses an actor who is neither the gap's creator/owner nor case OWNER/CASE_REVIEWER", async () => {
    const { service, repository, caseRepository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(existingGap as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(underAssessmentCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "TECHNICAL_MEMBER" } as never);

    await expect(
      service.transition(technicalMember, "gap-1", { toStatus: "IN_PROGRESS" }, null),
    ).rejects.toMatchObject({ code: "AUTH_FORBIDDEN" });
  });

  it("allows the gap's owner to transition it and sets resolvedAt/resolvedByUserId on a resolution status", async () => {
    const { service, repository, caseRepository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue({ ...existingGap, status: "IN_PROGRESS", ownerUserId: "tm-1" } as never);
    vi.mocked(caseRepository.findById).mockResolvedValue(underAssessmentCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "TECHNICAL_MEMBER" } as never);
    vi.mocked(repository.update).mockResolvedValue({
      ...existingGap,
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedByUserId: "tm-1",
      resolutionNote: "Filed provisional patent",
    } as never);

    const result = await service.transition(
      technicalMember,
      "gap-1",
      { toStatus: "RESOLVED", resolutionNote: "Filed provisional patent" },
      null,
    );

    expect(repository.update).toHaveBeenCalledWith(
      "gap-1",
      1,
      expect.objectContaining({
        status: "RESOLVED",
        resolvedByUserId: "tm-1",
        resolutionNote: "Filed provisional patent",
      }),
      {},
    );
    expect(result.status).toBe("RESOLVED");
  });
});
