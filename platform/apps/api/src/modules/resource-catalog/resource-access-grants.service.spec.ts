import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@r2m/authz";
import { ResourceAccessGrantsService } from "./resource-access-grants.service";
import type { ResourceAccessGrantsRepository } from "./resource-access-grants.repository";
import type { ResourcesRepository } from "./resources.repository";
import type { AuditService } from "../platform-operations/audit/audit.service";
import type { OutboxService } from "../platform-operations/jobs/outbox.service";

const manager: ActorContext = {
  userId: "manager-1",
  platformRole: "USER",
  memberships: [{ organizationId: "org-1", role: "ORG_OWNER", status: "ACTIVE" }],
  authorVerificationStatus: "UNVERIFIED",
};
const outsider: ActorContext = {
  userId: "outsider-1",
  platformRole: "USER",
  memberships: [],
  authorVerificationStatus: "UNVERIFIED",
};

function buildService() {
  const accessGrantsRepository = {
    findById: vi.fn(),
    listByResource: vi.fn(),
    findActiveDuplicate: vi.fn(),
    create: vi.fn(),
    revoke: vi.fn(),
  } as unknown as ResourceAccessGrantsRepository;

  const resourcesRepository = { findById: vi.fn() } as unknown as ResourcesRepository;
  const auditService = { write: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const outboxService = { append: vi.fn().mockResolvedValue(undefined) } as unknown as OutboxService;
  const db = { transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb({})) };

  const service = new ResourceAccessGrantsService(
    accessGrantsRepository,
    resourcesRepository,
    auditService,
    outboxService,
    db as never,
  );

  return { service, accessGrantsRepository, resourcesRepository, auditService, outboxService };
}

describe("ResourceAccessGrantsService.create (SUC-04)", () => {
  it("refuses an actor who does not manage the resource", async () => {
    const { service, resourcesRepository } = buildService();
    vi.mocked(resourcesRepository.findById).mockResolvedValue({
      id: "res-1",
      ownerOrganizationId: "org-1",
    } as never);

    await expect(
      service.create(outsider, "res-1", { recipientUserId: "user-2", permission: "VIEW" }, null),
    ).rejects.toMatchObject({ code: "RESOURCE_ACCESS_DENIED" });
  });

  it("refuses a duplicate ACTIVE grant for the same (resource, recipient, permission)", async () => {
    const { service, resourcesRepository, accessGrantsRepository } = buildService();
    vi.mocked(resourcesRepository.findById).mockResolvedValue({
      id: "res-1",
      ownerOrganizationId: "org-1",
    } as never);
    vi.mocked(accessGrantsRepository.findActiveDuplicate).mockResolvedValue({ id: "grant-existing" } as never);

    await expect(
      service.create(manager, "res-1", { recipientUserId: "user-2", permission: "VIEW" }, null),
    ).rejects.toMatchObject({ code: "ACCESS_GRANT_DUPLICATE" });
  });

  it("creates the grant as ACTIVE immediately — no PENDING step", async () => {
    const { service, resourcesRepository, accessGrantsRepository, outboxService } = buildService();
    vi.mocked(resourcesRepository.findById).mockResolvedValue({
      id: "res-1",
      ownerOrganizationId: "org-1",
    } as never);
    vi.mocked(accessGrantsRepository.findActiveDuplicate).mockResolvedValue(undefined);
    vi.mocked(accessGrantsRepository.create).mockResolvedValue({
      id: "grant-1",
      resourceId: "res-1",
      recipientOrganizationId: null,
      recipientUserId: "user-2",
      permission: "VIEW",
      status: "ACTIVE",
      grantedByUserId: manager.userId,
      expiresAt: null,
      revokedAt: null,
      revokedByUserId: null,
      createdAt: new Date("2024-01-01T00:00:00Z"),
    } as never);

    const result = await service.create(
      manager,
      "res-1",
      { recipientUserId: "user-2", permission: "VIEW" },
      null,
    );

    expect(result.status).toBe("ACTIVE");
    expect(outboxService.append).toHaveBeenCalledWith(
      "resource",
      "res-1",
      expect.objectContaining({ type: "ResourceAccessGranted" }),
      {},
    );
  });
});

describe("ResourceAccessGrantsService.revoke", () => {
  it("refuses to revoke a grant that is already revoked", async () => {
    const { service, resourcesRepository, accessGrantsRepository } = buildService();
    vi.mocked(accessGrantsRepository.findById).mockResolvedValue({
      id: "grant-1",
      resourceId: "res-1",
      status: "REVOKED",
    } as never);
    vi.mocked(resourcesRepository.findById).mockResolvedValue({
      id: "res-1",
      ownerOrganizationId: "org-1",
    } as never);

    await expect(service.revoke(manager, "grant-1", null)).rejects.toMatchObject({
      code: "ACCESS_GRANT_ALREADY_REVOKED",
    });
  });

  it("revokes an ACTIVE grant and records who revoked it", async () => {
    const { service, resourcesRepository, accessGrantsRepository, outboxService } = buildService();
    vi.mocked(accessGrantsRepository.findById).mockResolvedValue({
      id: "grant-1",
      resourceId: "res-1",
      status: "ACTIVE",
    } as never);
    vi.mocked(resourcesRepository.findById).mockResolvedValue({
      id: "res-1",
      ownerOrganizationId: "org-1",
    } as never);
    vi.mocked(accessGrantsRepository.revoke).mockResolvedValue({
      id: "grant-1",
      resourceId: "res-1",
      recipientOrganizationId: null,
      recipientUserId: "user-2",
      permission: "VIEW",
      status: "REVOKED",
      grantedByUserId: "manager-1",
      expiresAt: null,
      revokedAt: new Date("2024-01-03T00:00:00Z"),
      revokedByUserId: manager.userId,
      createdAt: new Date("2024-01-01T00:00:00Z"),
    } as never);

    const result = await service.revoke(manager, "grant-1", null);

    expect(result.status).toBe("REVOKED");
    expect(outboxService.append).toHaveBeenCalledWith(
      "resource",
      "res-1",
      expect.objectContaining({ type: "ResourceAccessRevoked" }),
      {},
    );
  });
});
