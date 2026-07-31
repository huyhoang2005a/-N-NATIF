import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@r2m/authz";
import { OrganizationsService } from "./organizations.service";
import type { OrganizationsRepository } from "./organizations.repository";
import type { AuditService } from "../audit/audit.service";
import type { OutboxService } from "../jobs/outbox.service";

const registerRequest = {
  organizationName: "Acme Research Unit",
  organizationType: "RESEARCH_UNIT" as const,
  ownerEmail: "owner@acme.example",
  ownerPassword: "supersecret1",
  ownerDisplayName: "Owner Name",
};

function buildService() {
  const organizationsRepository = {
    findBySlug: vi.fn().mockResolvedValue(null),
    findUserByEmail: vi.fn().mockResolvedValue(null),
    createUserAccount: vi.fn().mockResolvedValue({ id: "user-1" }),
    createUserIdentity: vi.fn().mockResolvedValue(undefined),
    createUserProfile: vi.fn().mockResolvedValue(undefined),
    createOrganization: vi.fn().mockResolvedValue({
      id: "org-1",
      name: registerRequest.organizationName,
      slug: "acme-research-unit",
      type: "RESEARCH_UNIT",
      status: "PENDING_VERIFICATION",
      website: null,
      taxCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    }),
    createOrganizationDomain: vi.fn().mockResolvedValue(undefined),
    createOrganizationMember: vi.fn().mockResolvedValue({
      id: "member-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "ORG_OWNER",
      status: "ACTIVE",
      invitedAt: null,
      joinedAt: new Date(),
      leftAt: null,
    }),
    createVerificationRequest: vi.fn().mockResolvedValue({ id: "verification-1" }),
    findById: vi.fn(),
    findMemberById: vi.fn(),
    findMemberByUserId: vi.fn(),
    listMembersForActiveOrganizations: vi.fn(),
    updateOrganizationMember: vi.fn(),
  } as unknown as OrganizationsRepository;

  const auditService = { write: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const outboxService = { append: vi.fn().mockResolvedValue(undefined) } as unknown as OutboxService;
  const db = { transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb({})) };

  const service = new OrganizationsService(
    organizationsRepository,
    auditService,
    outboxService,
    db as never,
  );

  return { service, organizationsRepository, auditService, outboxService };
}

describe("OrganizationsService.register (UC-ORG-01)", () => {
  it("creates the user + organization + owner membership + verification request atomically", async () => {
    const { service, organizationsRepository, outboxService } = buildService();

    const result = await service.register(registerRequest, "req-1");

    expect(result.slug).toBe("acme-research-unit");
    expect(organizationsRepository.createOrganizationMember).toHaveBeenCalledWith(
      expect.objectContaining({ role: "ORG_OWNER", status: "ACTIVE" }),
      {},
    );
    expect(organizationsRepository.createVerificationRequest).toHaveBeenCalled();
    expect(outboxService.append).toHaveBeenCalledWith(
      "organization",
      "org-1",
      expect.objectContaining({ type: "OrganizationRegistered" }),
      {},
    );
  });

  it("rejects a duplicate organization name/slug with ORG_ALREADY_EXISTS", async () => {
    const { service, organizationsRepository } = buildService();
    vi.mocked(organizationsRepository.findBySlug).mockResolvedValue({ id: "existing" } as never);

    await expect(service.register(registerRequest, null)).rejects.toMatchObject({
      code: "ORG_ALREADY_EXISTS",
    });
  });

  it("rejects an already-registered owner email with AUTH_EMAIL_ALREADY_REGISTERED", async () => {
    const { service, organizationsRepository } = buildService();
    vi.mocked(organizationsRepository.findUserByEmail).mockResolvedValue({ id: "existing" } as never);

    await expect(service.register(registerRequest, null)).rejects.toMatchObject({
      code: "AUTH_EMAIL_ALREADY_REGISTERED",
    });
  });
});

describe("OrganizationsService member management (SUC-02)", () => {
  const ownerActor: ActorContext = {
    userId: "owner-1",
    platformRole: "USER",
    memberships: [{ organizationId: "org-1", role: "ORG_OWNER", status: "ACTIVE" }],
  };
  const plainMemberActor: ActorContext = {
    userId: "member-1",
    platformRole: "USER",
    memberships: [{ organizationId: "org-1", role: "MEMBER", status: "ACTIVE" }],
  };

  let deps: ReturnType<typeof buildService>;

  beforeEach(() => {
    deps = buildService();
    vi.mocked(deps.organizationsRepository.findById).mockResolvedValue({
      id: "org-1",
      status: "ACTIVE",
    } as never);
  });

  it("rejects invite from a plain MEMBER (not owner/admin)", async () => {
    await expect(
      deps.service.inviteMember(plainMemberActor, "org-1", { email: "new@x.com", role: "MEMBER" }, null),
    ).rejects.toMatchObject({ code: "AUTH_FORBIDDEN" });
  });

  it("rejects inviting a user who is already a member", async () => {
    vi.mocked(deps.organizationsRepository.findUserByEmail).mockResolvedValue({ id: "user-2" } as never);
    vi.mocked(deps.organizationsRepository.findMemberByUserId).mockResolvedValue({
      id: "member-2",
    } as never);

    await expect(
      deps.service.inviteMember(ownerActor, "org-1", { email: "existing@x.com", role: "MEMBER" }, null),
    ).rejects.toMatchObject({ code: "ORG_MEMBER_ALREADY_EXISTS" });
  });

  it("blocks demoting the organization's only active ORG_OWNER", async () => {
    vi.mocked(deps.organizationsRepository.findMemberById).mockResolvedValue({
      id: "member-1",
      role: "ORG_OWNER",
      status: "ACTIVE",
    } as never);

    await expect(
      deps.service.updateMember(ownerActor, "org-1", "member-1", { status: "SUSPENDED" }, null),
    ).rejects.toMatchObject({ code: "ORG_CANNOT_REMOVE_LAST_OWNER" });
  });

  it("allows changing a plain MEMBER to ORG_ADMIN", async () => {
    vi.mocked(deps.organizationsRepository.findMemberById).mockResolvedValue({
      id: "member-2",
      role: "MEMBER",
      status: "ACTIVE",
    } as never);
    vi.mocked(deps.organizationsRepository.updateOrganizationMember).mockResolvedValue({
      id: "member-2",
      organizationId: "org-1",
      userId: "user-2",
      role: "ORG_ADMIN",
      status: "ACTIVE",
      invitedAt: null,
      joinedAt: new Date(),
    } as never);

    const result = await deps.service.updateMember(
      ownerActor,
      "org-1",
      "member-2",
      { role: "ORG_ADMIN" },
      null,
    );
    expect(result.role).toBe("ORG_ADMIN");
  });
});
