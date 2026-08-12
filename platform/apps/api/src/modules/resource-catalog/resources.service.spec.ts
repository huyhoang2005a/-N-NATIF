import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@r2m/authz";
import { ResourcesService } from "./resources.service";
import type { ResourcesRepository } from "./resources.repository";
import type { AuditService } from "../platform-operations/audit/audit.service";
import type { OutboxService } from "../platform-operations/jobs/outbox.service";
import type { S3Service } from "../../common/storage/s3.service";
import type { SavesService } from "../community/saves/saves.service";
import type { VotesService } from "../community/votes/votes.service";

const verifiedAuthorInOrg: ActorContext = {
  userId: "author-1",
  platformRole: "USER",
  memberships: [{ organizationId: "org-1", role: "MEMBER", status: "ACTIVE" }],
  authorVerificationStatus: "VERIFIED",
  isEmailVerified: true,
};
const unverifiedUser: ActorContext = {
  userId: "user-1",
  platformRole: "USER",
  memberships: [{ organizationId: "org-1", role: "MEMBER", status: "ACTIVE" }],
  authorVerificationStatus: "UNVERIFIED",
  isEmailVerified: true,
};
const orgOwner: ActorContext = {
  userId: "owner-1",
  platformRole: "USER",
  memberships: [{ organizationId: "org-1", role: "ORG_OWNER", status: "ACTIVE" }],
  authorVerificationStatus: "UNVERIFIED",
  isEmailVerified: true,
};

function buildService() {
  const resourcesRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    listVisible: vi.fn(),
    updateStatus: vi.fn(),
    createVersion: vi.fn(),
    findVersionById: vi.fn(),
    findLatestVersionByResource: vi.fn(),
    findPublishedVersionByResource: vi.fn(),
    updateVersionStatus: vi.fn(),
    createPaperMetadata: vi.fn(),
    createIngestionJob: vi.fn().mockResolvedValue({ id: "job-1" }),
    findLatestIngestionJobByVersion: vi.fn().mockResolvedValue({ id: "job-1", status: "COMPLETED" }),
    hasActiveGrantForActor: vi.fn().mockResolvedValue(false),
  } as unknown as ResourcesRepository;

  const auditService = { write: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const outboxService = { append: vi.fn().mockResolvedValue(undefined) } as unknown as OutboxService;
  const s3Service = {
    createResourceUploadUrl: vi.fn(),
    computeResourceContentSha256: vi.fn().mockResolvedValue("deadbeef"),
  } as unknown as S3Service;
  const db = { transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb({})) };
  const votesService = {
    voteInfoForResource: vi.fn().mockResolvedValue({ voteCount: 0, votedByMe: false }),
    voteInfoForResources: vi.fn().mockResolvedValue(new Map()),
    voteResource: vi.fn().mockResolvedValue(undefined),
    unvoteResource: vi.fn().mockResolvedValue(undefined),
  } as unknown as VotesService;
  const savesService = {
    savedByMeForResource: vi.fn().mockResolvedValue(false),
    savedByMeForResources: vi.fn().mockResolvedValue(new Map()),
    saveResource: vi.fn().mockResolvedValue(undefined),
    unsaveResource: vi.fn().mockResolvedValue(undefined),
  } as unknown as SavesService;

  const service = new ResourcesService(
    resourcesRepository,
    auditService,
    outboxService,
    s3Service,
    votesService,
    savesService,
    db as never,
  );

  return { service, resourcesRepository, auditService, outboxService, s3Service, votesService, savesService };
}

const registerInput = {
  ownerOrganizationId: "org-1",
  type: "DATASET" as const,
  title: "Sample dataset",
  accessLevel: "PUBLIC" as const,
  sourceUrl: "https://example.com/data.csv",
};

describe("ResourcesService.register (UC-RES-01)", () => {
  it("refuses registration by a non-verified author", async () => {
    const { service } = buildService();
    await expect(service.register(unverifiedUser, registerInput, null)).rejects.toMatchObject({
      code: "RESOURCE_AUTHOR_NOT_VERIFIED",
    });
  });

  it("refuses registration when the actor is not a member of the owning organization", async () => {
    const { service } = buildService();
    const outsider: ActorContext = { ...verifiedAuthorInOrg, memberships: [] };
    await expect(service.register(outsider, registerInput, null)).rejects.toMatchObject({
      code: "ORG_NOT_MEMBER",
    });
  });

  it("rejects paper metadata fields on a non-PAPER resource", async () => {
    const { service } = buildService();
    await expect(
      service.register(verifiedAuthorInOrg, { ...registerInput, doi: "10.1000/xyz" }, null),
    ).rejects.toMatchObject({ code: "RESOURCE_INVALID_TYPE_FOR_PAPER_METADATA" });
  });

  it("creates the resource, version 1 and an ingestion job in one transaction", async () => {
    const { service, resourcesRepository, auditService, outboxService } = buildService();
    vi.mocked(resourcesRepository.create).mockResolvedValue({
      id: "res-1",
      ownerOrganizationId: "org-1",
      createdByUserId: verifiedAuthorInOrg.userId,
      type: "DATASET",
      title: "Sample dataset",
      description: null,
      accessLevel: "PUBLIC",
      status: "DRAFT",
      moderationStatus: "ACTIVE",
      externalIdentifier: null,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
      version: 1,
    } as never);
    vi.mocked(resourcesRepository.createVersion).mockResolvedValue({ id: "ver-1" } as never);

    const result = await service.register(verifiedAuthorInOrg, registerInput, null);

    expect(resourcesRepository.create).toHaveBeenCalled();
    expect(resourcesRepository.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: "res-1", versionNo: 1 }),
      {},
    );
    expect(resourcesRepository.createIngestionJob).toHaveBeenCalledWith("ver-1", {});
    expect(auditService.write).toHaveBeenCalled();
    expect(outboxService.append).toHaveBeenCalledWith(
      "resource",
      "res-1",
      expect.objectContaining({ type: "ResourceRegistered" }),
      {},
    );
    expect(result.id).toBe("res-1");
  });
});

describe("ResourcesService.publishVersion (UC-RES-01 step 5)", () => {
  it("activates a DRAFT resource when publishing its first version", async () => {
    const { service, resourcesRepository, outboxService } = buildService();
    vi.mocked(resourcesRepository.findVersionById).mockResolvedValue({
      id: "ver-1",
      resourceId: "res-1",
      versionNo: 1,
      status: "DRAFT",
    } as never);
    vi.mocked(resourcesRepository.findById).mockResolvedValue({
      id: "res-1",
      ownerOrganizationId: "org-1",
      status: "DRAFT",
      version: 1,
    } as never);
    vi.mocked(resourcesRepository.findPublishedVersionByResource).mockResolvedValue(undefined);
    vi.mocked(resourcesRepository.updateVersionStatus).mockResolvedValue({
      id: "ver-1",
      resourceId: "res-1",
      versionNo: 1,
      versionLabel: null,
      sourceUrl: "https://example.com/data.csv",
      storageObjectKey: null,
      contentHashSha256: null,
      publishedAt: new Date("2024-01-02T00:00:00Z"),
      status: "PUBLISHED",
      createdByUserId: "author-1",
      createdAt: new Date("2024-01-01T00:00:00Z"),
    } as never);
    vi.mocked(resourcesRepository.updateStatus).mockResolvedValue({ id: "res-1", status: "ACTIVE" } as never);

    await service.publishVersion(orgOwner, "ver-1", null);

    expect(resourcesRepository.updateStatus).toHaveBeenCalledWith("res-1", 1, "ACTIVE");
    expect(outboxService.append).toHaveBeenCalledWith(
      "resource",
      "res-1",
      expect.objectContaining({ type: "ResourceVersionPublished" }),
      {},
    );
  });

  it("Phase 7 Sprint 7.4 — rejects publish when the ingestion job hasn't completed (scan still pending/failed)", async () => {
    const { service, resourcesRepository } = buildService();
    vi.mocked(resourcesRepository.findVersionById).mockResolvedValue({
      id: "ver-1",
      resourceId: "res-1",
      versionNo: 1,
      status: "DRAFT",
    } as never);
    vi.mocked(resourcesRepository.findById).mockResolvedValue({
      id: "res-1",
      ownerOrganizationId: "org-1",
      status: "DRAFT",
      version: 1,
    } as never);
    vi.mocked(resourcesRepository.findLatestIngestionJobByVersion).mockResolvedValue({
      id: "job-1",
      status: "FAILED",
      errorCode: "MALWARE_DETECTED",
    } as never);

    await expect(service.publishVersion(orgOwner, "ver-1", null)).rejects.toMatchObject({
      code: "RESOURCE_VERSION_NOT_SCANNED",
    });
    expect(resourcesRepository.updateVersionStatus).not.toHaveBeenCalled();
  });

  it("supersedes the previously published version when publishing a newer one", async () => {
    const { service, resourcesRepository } = buildService();
    vi.mocked(resourcesRepository.findVersionById).mockResolvedValue({
      id: "ver-2",
      resourceId: "res-1",
      versionNo: 2,
      status: "DRAFT",
    } as never);
    vi.mocked(resourcesRepository.findById).mockResolvedValue({
      id: "res-1",
      ownerOrganizationId: "org-1",
      status: "ACTIVE",
      version: 2,
    } as never);
    vi.mocked(resourcesRepository.findPublishedVersionByResource).mockResolvedValue({
      id: "ver-1",
      status: "PUBLISHED",
    } as never);
    vi.mocked(resourcesRepository.updateVersionStatus).mockResolvedValue({
      id: "ver-2",
      resourceId: "res-1",
      versionNo: 2,
      versionLabel: null,
      sourceUrl: null,
      storageObjectKey: null,
      contentHashSha256: null,
      publishedAt: new Date(),
      status: "PUBLISHED",
      createdByUserId: "author-1",
      createdAt: new Date(),
    } as never);

    await service.publishVersion(orgOwner, "ver-2", null);

    expect(resourcesRepository.updateVersionStatus).toHaveBeenCalledWith("ver-1", "SUPERSEDED", {});
    expect(resourcesRepository.updateStatus).not.toHaveBeenCalled();
  });

  it("refuses to publish when the actor does not manage the owning organization", async () => {
    const { service, resourcesRepository } = buildService();
    vi.mocked(resourcesRepository.findVersionById).mockResolvedValue({
      id: "ver-1",
      resourceId: "res-1",
      versionNo: 1,
      status: "DRAFT",
    } as never);
    vi.mocked(resourcesRepository.findById).mockResolvedValue({
      id: "res-1",
      ownerOrganizationId: "org-1",
      status: "DRAFT",
      version: 1,
    } as never);

    await expect(service.publishVersion(unverifiedUser, "ver-1", null)).rejects.toMatchObject({
      code: "RESOURCE_ACCESS_DENIED",
    });
  });

  it("refuses to publish a version that is already PUBLISHED", async () => {
    const { service, resourcesRepository } = buildService();
    vi.mocked(resourcesRepository.findVersionById).mockResolvedValue({
      id: "ver-1",
      resourceId: "res-1",
      versionNo: 1,
      status: "PUBLISHED",
    } as never);
    vi.mocked(resourcesRepository.findById).mockResolvedValue({
      id: "res-1",
      ownerOrganizationId: "org-1",
      status: "ACTIVE",
      version: 1,
    } as never);

    await expect(service.publishVersion(orgOwner, "ver-1", null)).rejects.toMatchObject({
      code: "RESOURCE_INVALID_TRANSITION",
    });
  });
});

describe("ResourcesService.getById (SUC-05 permission filtering)", () => {
  it("denies access to a PRIVATE resource for an outsider with no grant", async () => {
    const { service, resourcesRepository } = buildService();
    vi.mocked(resourcesRepository.findById).mockResolvedValue({
      id: "res-1",
      accessLevel: "PRIVATE",
      ownerOrganizationId: "org-1",
    } as never);

    const outsider: ActorContext = { ...unverifiedUser, memberships: [] };
    await expect(service.getById(outsider, "res-1")).rejects.toMatchObject({
      code: "RESOURCE_ACCESS_DENIED",
    });
  });
});
