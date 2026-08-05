import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@r2m/authz";
import { AnnotationsService } from "./annotations.service";
import type { AnnotationsRepository } from "./annotations.repository";
import type { ResourcesRepository } from "./resources.repository";
import type { AuditService } from "../platform-operations/audit/audit.service";
import type { OutboxService } from "../platform-operations/jobs/outbox.service";

const manager: ActorContext = {
  userId: "manager-1",
  platformRole: "USER",
  memberships: [{ organizationId: "org-1", role: "ORG_ADMIN", status: "ACTIVE" }],
  authorVerificationStatus: "UNVERIFIED",
};
const outsider: ActorContext = {
  userId: "outsider-1",
  platformRole: "USER",
  memberships: [],
  authorVerificationStatus: "UNVERIFIED",
};

function buildService() {
  const annotationsRepository = {
    findById: vi.fn(),
    findRevision: vi.fn(),
    create: vi.fn(),
    createRevision: vi.fn(),
    bumpLatestRevision: vi.fn(),
    remove: vi.fn(),
  } as unknown as AnnotationsRepository;

  const resourcesRepository = {
    findVersionById: vi.fn(),
    findById: vi.fn(),
  } as unknown as ResourcesRepository;

  const auditService = { write: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const outboxService = { append: vi.fn().mockResolvedValue(undefined) } as unknown as OutboxService;
  const db = { transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb({})) };

  const service = new AnnotationsService(
    annotationsRepository,
    resourcesRepository,
    auditService,
    outboxService,
    db as never,
  );

  return { service, annotationsRepository, resourcesRepository, auditService, outboxService };
}

const createInput = { content: "Interesting finding", targetSnippet: "the original text" };

describe("AnnotationsService.create (UC-RES-02)", () => {
  it("refuses to annotate a withdrawn resource version", async () => {
    const { service, resourcesRepository } = buildService();
    vi.mocked(resourcesRepository.findVersionById).mockResolvedValue({
      id: "ver-1",
      resourceId: "res-1",
      status: "WITHDRAWN",
    } as never);

    await expect(service.create(manager, "ver-1", createInput, null)).rejects.toMatchObject({
      code: "RESOURCE_VERSION_IMMUTABLE",
    });
  });

  it("refuses an actor who does not manage the owning organization", async () => {
    const { service, resourcesRepository } = buildService();
    vi.mocked(resourcesRepository.findVersionById).mockResolvedValue({
      id: "ver-1",
      resourceId: "res-1",
      status: "PUBLISHED",
    } as never);
    vi.mocked(resourcesRepository.findById).mockResolvedValue({
      id: "res-1",
      ownerOrganizationId: "org-1",
    } as never);

    await expect(service.create(outsider, "ver-1", createInput, null)).rejects.toMatchObject({
      code: "RESOURCE_ACCESS_DENIED",
    });
  });

  it("creates the annotation with revision 1 in one transaction", async () => {
    const { service, resourcesRepository, annotationsRepository, outboxService } = buildService();
    vi.mocked(resourcesRepository.findVersionById).mockResolvedValue({
      id: "ver-1",
      resourceId: "res-1",
      status: "PUBLISHED",
    } as never);
    vi.mocked(resourcesRepository.findById).mockResolvedValue({
      id: "res-1",
      ownerOrganizationId: "org-1",
    } as never);
    vi.mocked(annotationsRepository.create).mockResolvedValue({
      id: "ann-1",
      resourceVersionId: "ver-1",
      createdByUserId: manager.userId,
      status: "ACTIVE",
      latestRevisionNo: 1,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    } as never);
    vi.mocked(annotationsRepository.createRevision).mockResolvedValue({
      content: createInput.content,
      targetSnippet: createInput.targetSnippet,
      pageNumber: null,
      sectionLabel: null,
      offsetStart: null,
      offsetEnd: null,
    } as never);

    const result = await service.create(manager, "ver-1", createInput, null);

    expect(annotationsRepository.createRevision).toHaveBeenCalledWith(
      expect.objectContaining({ annotationId: "ann-1", revisionNo: 1 }),
      {},
    );
    expect(outboxService.append).toHaveBeenCalledWith(
      "annotation",
      "ann-1",
      expect.objectContaining({ type: "AnnotationCreated" }),
      {},
    );
    expect(result.content).toBe(createInput.content);
  });
});

describe("AnnotationsService.revise", () => {
  it("never updates the previous revision — always inserts revisionNo + 1", async () => {
    const { service, resourcesRepository, annotationsRepository } = buildService();
    vi.mocked(annotationsRepository.findById).mockResolvedValue({
      id: "ann-1",
      resourceVersionId: "ver-1",
      latestRevisionNo: 2,
    } as never);
    vi.mocked(resourcesRepository.findVersionById).mockResolvedValue({
      id: "ver-1",
      resourceId: "res-1",
      status: "PUBLISHED",
    } as never);
    vi.mocked(resourcesRepository.findById).mockResolvedValue({
      id: "res-1",
      ownerOrganizationId: "org-1",
    } as never);
    vi.mocked(annotationsRepository.createRevision).mockResolvedValue({
      content: "updated",
      targetSnippet: "snippet",
      pageNumber: null,
      sectionLabel: null,
      offsetStart: null,
      offsetEnd: null,
    } as never);
    vi.mocked(annotationsRepository.bumpLatestRevision).mockResolvedValue({
      id: "ann-1",
      resourceVersionId: "ver-1",
      createdByUserId: manager.userId,
      status: "ACTIVE",
      latestRevisionNo: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await service.revise(manager, "ann-1", { content: "updated", targetSnippet: "snippet" }, null);

    expect(annotationsRepository.createRevision).toHaveBeenCalledWith(
      expect.objectContaining({ annotationId: "ann-1", revisionNo: 3 }),
      {},
    );
    expect(annotationsRepository.bumpLatestRevision).toHaveBeenCalledWith("ann-1", 3, {});
  });
});

describe("AnnotationsService.remove", () => {
  it("soft-deletes by setting status REMOVED, not a real delete", async () => {
    const { service, resourcesRepository, annotationsRepository, outboxService } = buildService();
    vi.mocked(annotationsRepository.findById).mockResolvedValue({
      id: "ann-1",
      resourceVersionId: "ver-1",
      latestRevisionNo: 1,
    } as never);
    vi.mocked(resourcesRepository.findVersionById).mockResolvedValue({
      id: "ver-1",
      resourceId: "res-1",
      status: "PUBLISHED",
    } as never);
    vi.mocked(resourcesRepository.findById).mockResolvedValue({
      id: "res-1",
      ownerOrganizationId: "org-1",
    } as never);

    await service.remove(manager, "ann-1", null);

    expect(annotationsRepository.remove).toHaveBeenCalledWith("ann-1", {});
    expect(outboxService.append).toHaveBeenCalledWith(
      "annotation",
      "ann-1",
      expect.objectContaining({ type: "AnnotationRemoved" }),
      {},
    );
  });
});
