import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@r2m/authz";
import { EvidenceService } from "./evidence.service";
import type { EvidenceRepository } from "./evidence.repository";
import type { TechnologyCaseRepository } from "./technology-case.repository";
import type { TechnologyCaseService } from "./technology-case.service";
import type { ResourcesRepository } from "../resource-catalog/resources.repository";
import type { ResourcesService } from "../resource-catalog/resources.service";
import type { AuditService } from "../platform-operations/audit/audit.service";
import type { OutboxService } from "../platform-operations/jobs/outbox.service";

const owner: ActorContext = {
  userId: "owner-1",
  platformRole: "USER",
  memberships: [{ organizationId: "org-1", role: "MEMBER", status: "ACTIVE" }],
  authorVerificationStatus: "VERIFIED",
};
const outsider: ActorContext = {
  userId: "outsider-1",
  platformRole: "USER",
  memberships: [],
  authorVerificationStatus: "UNVERIFIED",
};

const draftCase = {
  id: "case-1",
  owningOrganizationId: "org-1",
  lifecycleStatus: "DRAFT",
  version: 1,
};

const evidenceCollectionCase = { ...draftCase, lifecycleStatus: "EVIDENCE_COLLECTION" };

const createInput = {
  resourceVersionId: "ver-1",
  title: "Benchmark result",
  claim: "Model achieves 95% accuracy",
  relevanceNote: "Directly supports readiness for pilot",
  citation: { snippet: "accuracy reached 95%" },
};

function buildService() {
  const evidenceRepository = {
    createCitation: vi.fn(),
    createEvidence: vi.fn(),
    createEvidenceCitation: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    hasAnyEvidence: vi.fn().mockResolvedValue(false),
  } as unknown as EvidenceRepository;

  const caseRepository = {
    findById: vi.fn(),
    findActiveMembership: vi.fn(),
  } as unknown as TechnologyCaseRepository;

  const caseService = {
    applyTransition: vi.fn().mockResolvedValue(undefined),
  } as unknown as TechnologyCaseService;

  const resourcesRepository = {
    findVersionById: vi.fn(),
    findById: vi.fn(),
  } as unknown as ResourcesRepository;

  const resourcesService = {
    assertVisible: vi.fn().mockResolvedValue(undefined),
  } as unknown as ResourcesService;

  const auditService = { write: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const outboxService = { append: vi.fn().mockResolvedValue(undefined) } as unknown as OutboxService;
  const db = { transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb({})) };

  const service = new EvidenceService(
    evidenceRepository,
    caseRepository,
    caseService,
    resourcesRepository,
    resourcesService,
    auditService,
    outboxService,
    db as never,
  );

  return { service, evidenceRepository, caseRepository, caseService, resourcesRepository, resourcesService, auditService, outboxService };
}

describe("EvidenceService.create (UC-EVD-01)", () => {
  it("refuses an actor with no active case membership", async () => {
    const { service, caseRepository } = buildService();
    vi.mocked(caseRepository.findById).mockResolvedValue(draftCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue(undefined);

    await expect(service.create(outsider, "case-1", createInput, null)).rejects.toMatchObject({
      code: "AUTH_FORBIDDEN",
    });
  });

  it("refuses a VIEWER — chỉ 'chỉ xem', không được ghi evidence", async () => {
    const { service, caseRepository } = buildService();
    vi.mocked(caseRepository.findById).mockResolvedValue(draftCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "VIEWER" } as never);

    await expect(service.create(owner, "case-1", createInput, null)).rejects.toMatchObject({
      code: "AUTH_FORBIDDEN",
    });
  });

  it("propagates RESOURCE_ACCESS_DENIED when the actor can't read the resource version", async () => {
    const { service, caseRepository, resourcesRepository, resourcesService } = buildService();
    vi.mocked(caseRepository.findById).mockResolvedValue(draftCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);
    vi.mocked(resourcesRepository.findVersionById).mockResolvedValue({
      id: "ver-1",
      resourceId: "res-1",
    } as never);
    vi.mocked(resourcesRepository.findById).mockResolvedValue({
      id: "res-1",
      accessLevel: "PRIVATE",
      ownerOrganizationId: "org-2",
    } as never);
    vi.mocked(resourcesService.assertVisible).mockRejectedValue(
      Object.assign(new Error("denied"), { code: "RESOURCE_ACCESS_DENIED" }),
    );

    await expect(service.create(owner, "case-1", createInput, null)).rejects.toMatchObject({
      code: "RESOURCE_ACCESS_DENIED",
    });
  });

  it("creates citation + evidence + evidence_citation and auto-transitions a DRAFT case on its first evidence", async () => {
    const { service, evidenceRepository, caseRepository, caseService, resourcesRepository, outboxService } =
      buildService();
    vi.mocked(caseRepository.findById).mockResolvedValue(draftCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);
    vi.mocked(resourcesRepository.findVersionById).mockResolvedValue({
      id: "ver-1",
      resourceId: "res-1",
    } as never);
    vi.mocked(resourcesRepository.findById).mockResolvedValue({
      id: "res-1",
      accessLevel: "PUBLIC",
      ownerOrganizationId: "org-1",
    } as never);
    vi.mocked(evidenceRepository.hasAnyEvidence).mockResolvedValue(false);
    vi.mocked(evidenceRepository.createCitation).mockResolvedValue({ id: "citation-1" } as never);
    vi.mocked(evidenceRepository.createEvidence).mockResolvedValue({
      id: "evidence-1",
      technologyCaseId: "case-1",
      resourceVersionId: "ver-1",
      annotationId: null,
      title: createInput.title,
      claim: createInput.claim,
      relevanceNote: createInput.relevanceNote,
      status: "ACTIVE",
      createdByUserId: owner.userId,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    } as never);

    const result = await service.create(owner, "case-1", createInput, null);

    expect(evidenceRepository.createEvidenceCitation).toHaveBeenCalledWith(
      { evidenceId: "evidence-1", citationId: "citation-1" },
      {},
    );
    expect(caseService.applyTransition).toHaveBeenCalledWith(
      {},
      owner,
      draftCase,
      "EVIDENCE_COLLECTION",
      expect.any(String),
      null,
    );
    expect(outboxService.append).toHaveBeenCalledWith(
      "evidence",
      "evidence-1",
      expect.objectContaining({ type: "EvidenceLinked" }),
      {},
    );
    expect(result.id).toBe("evidence-1");
  });

  it("does not auto-transition when the case is already past DRAFT", async () => {
    const { service, evidenceRepository, caseRepository, caseService, resourcesRepository } = buildService();
    vi.mocked(caseRepository.findById).mockResolvedValue(evidenceCollectionCase as never);
    vi.mocked(caseRepository.findActiveMembership).mockResolvedValue({ role: "TECHNICAL_MEMBER" } as never);
    vi.mocked(resourcesRepository.findVersionById).mockResolvedValue({
      id: "ver-1",
      resourceId: "res-1",
    } as never);
    vi.mocked(resourcesRepository.findById).mockResolvedValue({
      id: "res-1",
      accessLevel: "PUBLIC",
      ownerOrganizationId: "org-1",
    } as never);
    vi.mocked(evidenceRepository.hasAnyEvidence).mockResolvedValue(true);
    vi.mocked(evidenceRepository.createCitation).mockResolvedValue({ id: "citation-2" } as never);
    vi.mocked(evidenceRepository.createEvidence).mockResolvedValue({
      id: "evidence-2",
      technologyCaseId: "case-1",
      resourceVersionId: "ver-1",
      annotationId: null,
      title: createInput.title,
      claim: createInput.claim,
      relevanceNote: createInput.relevanceNote,
      status: "ACTIVE",
      createdByUserId: owner.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await service.create(owner, "case-1", createInput, null);

    expect(caseService.applyTransition).not.toHaveBeenCalled();
  });
});
