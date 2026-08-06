import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@r2m/authz";
import { TechnologyCaseService } from "./technology-case.service";
import type { TechnologyCaseRepository } from "./technology-case.repository";
import type { AuditService } from "../platform-operations/audit/audit.service";
import type { OutboxService } from "../platform-operations/jobs/outbox.service";

const verifiedAuthorInOrg: ActorContext = {
  userId: "author-1",
  platformRole: "USER",
  memberships: [{ organizationId: "org-1", role: "MEMBER", status: "ACTIVE" }],
  authorVerificationStatus: "VERIFIED",
};
const unverifiedUser: ActorContext = {
  userId: "user-1",
  platformRole: "USER",
  memberships: [{ organizationId: "org-1", role: "MEMBER", status: "ACTIVE" }],
  authorVerificationStatus: "UNVERIFIED",
};
const orgAdmin: ActorContext = {
  userId: "admin-1",
  platformRole: "USER",
  memberships: [{ organizationId: "org-1", role: "ORG_ADMIN", status: "ACTIVE" }],
  authorVerificationStatus: "UNVERIFIED",
};

function buildService() {
  const repository = {
    create: vi.fn(),
    createOrigin: vi.fn().mockResolvedValue(undefined),
    createProfile: vi.fn().mockResolvedValue(undefined),
    createOrganization: vi.fn(),
    createMember: vi.fn(),
    insertStatusHistory: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn(),
    findById: vi.fn(),
    findBySlugInOrganization: vi.fn().mockResolvedValue(undefined),
    listVisible: vi.fn(),
    listMembers: vi.fn(),
    listOrganizations: vi.fn(),
    findActiveOwner: vi.fn(),
    findActiveMembership: vi.fn(),
    findExistingMember: vi.fn().mockResolvedValue(undefined),
    hasOrganizationRole: vi.fn().mockResolvedValue(false),
    hasOrganizationLink: vi.fn().mockResolvedValue(false),
    isActiveOrgMember: vi.fn().mockResolvedValue(true),
  } as unknown as TechnologyCaseRepository;

  const auditService = { write: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const outboxService = { append: vi.fn().mockResolvedValue(undefined) } as unknown as OutboxService;
  const db = { transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb({})) };

  const service = new TechnologyCaseService(repository, auditService, outboxService, db as never);

  return { service, repository, auditService, outboxService };
}

const registerInput = {
  owningOrganizationId: "org-1",
  title: "AI-assisted diagnostics",
};

describe("TechnologyCaseService.register (UC-CASE-01)", () => {
  it("refuses a non-verified author", async () => {
    const { service } = buildService();
    await expect(service.register(unverifiedUser, registerInput, null)).rejects.toMatchObject({
      code: "CASE_CREATOR_NOT_VERIFIED_AUTHOR",
    });
  });

  it("refuses when the actor is not an active member of the owning organization", async () => {
    const { service } = buildService();
    const outsider: ActorContext = { ...verifiedAuthorInOrg, memberships: [] };
    await expect(service.register(outsider, registerInput, null)).rejects.toMatchObject({
      code: "ORG_NOT_MEMBER",
    });
  });

  it("creates case + origin + profile + owning organization + OWNER member + DRAFT history in one transaction", async () => {
    const { service, repository, auditService, outboxService } = buildService();
    vi.mocked(repository.create).mockResolvedValue({
      id: "case-1",
      owningOrganizationId: "org-1",
      title: "AI-assisted diagnostics",
      slug: "ai-assisted-diagnostics",
      description: null,
      lifecycleStatus: "DRAFT",
      createdByUserId: "author-1",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
      archivedAt: null,
      version: 1,
    } as never);

    const result = await service.register(verifiedAuthorInOrg, registerInput, null);

    expect(repository.createOrigin).toHaveBeenCalledWith(
      expect.objectContaining({ technologyCaseId: "case-1", originType: "MANUAL" }),
      {},
    );
    expect(repository.createOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", role: "OWNING_ORGANIZATION" }),
      {},
    );
    expect(repository.createMember).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "author-1", role: "OWNER" }),
      {},
    );
    expect(repository.insertStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({ fromStatus: null, toStatus: "DRAFT" }),
      {},
    );
    expect(auditService.write).toHaveBeenCalled();
    expect(outboxService.append).toHaveBeenCalledWith(
      "technology_case",
      "case-1",
      expect.objectContaining({ type: "TechnologyCaseCreated" }),
      {},
    );
    expect(result.id).toBe("case-1");
  });
});

const existingCase = {
  id: "case-1",
  owningOrganizationId: "org-1",
  title: "AI-assisted diagnostics",
  slug: "ai-assisted-diagnostics",
  description: null,
  lifecycleStatus: "DRAFT",
  createdByUserId: "author-1",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  archivedAt: null,
  version: 1,
};

describe("TechnologyCaseService.addMember (§3.5)", () => {
  it("refuses an actor who is neither case OWNER nor ORG_OWNER/ORG_ADMIN of the owning org", async () => {
    const { service, repository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(existingCase as never);
    vi.mocked(repository.findActiveMembership).mockResolvedValue(undefined);

    await expect(
      service.addMember(unverifiedUser, "case-1", { userId: "u-2", organizationId: "org-1", role: "TECHNICAL_MEMBER" }, null),
    ).rejects.toMatchObject({ code: "AUTH_FORBIDDEN" });
  });

  it("refuses when the invited user is not an active member of the given organization", async () => {
    const { service, repository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(existingCase as never);
    vi.mocked(repository.isActiveOrgMember).mockResolvedValue(false);

    await expect(
      service.addMember(orgAdmin, "case-1", { userId: "u-2", organizationId: "org-1", role: "TECHNICAL_MEMBER" }, null),
    ).rejects.toMatchObject({ code: "CASE_MEMBER_NOT_ACTIVE_IN_ORGANIZATION" });
  });

  it("refuses a second active OWNER", async () => {
    const { service, repository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(existingCase as never);
    vi.mocked(repository.findActiveOwner).mockResolvedValue({ id: "member-1" } as never);

    await expect(
      service.addMember(orgAdmin, "case-1", { userId: "u-2", organizationId: "org-1", role: "OWNER" }, null),
    ).rejects.toMatchObject({ code: "CASE_OWNER_ALREADY_EXISTS" });
  });

  it("refuses OWNER from an organization other than the owning organization", async () => {
    const { service, repository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(existingCase as never);

    await expect(
      service.addMember(orgAdmin, "case-1", { userId: "u-2", organizationId: "org-2", role: "OWNER" }, null),
    ).rejects.toMatchObject({ code: "CASE_OWNER_NOT_IN_OWNING_ORG" });
  });

  it("refuses PARTNER_MEMBER whose organization isn't linked as PARTNER_COMPANY", async () => {
    const { service, repository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(existingCase as never);
    vi.mocked(repository.hasOrganizationRole).mockResolvedValue(false);

    await expect(
      service.addMember(orgAdmin, "case-1", { userId: "u-2", organizationId: "org-2", role: "PARTNER_MEMBER" }, null),
    ).rejects.toMatchObject({ code: "CASE_PARTNER_MEMBER_ORG_NOT_LINKED" });
  });

  it("adds a TECHNICAL_MEMBER when every check passes", async () => {
    const { service, repository, auditService } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(existingCase as never);
    vi.mocked(repository.createMember).mockResolvedValue({
      id: "member-2",
      technologyCaseId: "case-1",
      userId: "u-2",
      organizationId: "org-1",
      role: "TECHNICAL_MEMBER",
      status: "ACTIVE",
      invitedByUserId: "admin-1",
      joinedAt: new Date("2024-01-02T00:00:00Z"),
      createdAt: new Date("2024-01-02T00:00:00Z"),
    } as never);

    const result = await service.addMember(
      orgAdmin,
      "case-1",
      { userId: "u-2", organizationId: "org-1", role: "TECHNICAL_MEMBER" },
      null,
    );

    expect(result.role).toBe("TECHNICAL_MEMBER");
    expect(auditService.write).toHaveBeenCalled();
  });
});

describe("TechnologyCaseService.transition (SUC-07)", () => {
  it("refuses a target beyond ROADMAP_APPROVED — Phase 6 (Transfer) data doesn't exist yet", async () => {
    const { service, repository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(existingCase as never);
    vi.mocked(repository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);

    await expect(
      service.transition(verifiedAuthorInOrg, "case-1", "PILOT_READY", undefined, null),
    ).rejects.toMatchObject({ code: "CASE_INVALID_TRANSITION" });
  });

  it("transitions DRAFT -> EVIDENCE_COLLECTION and records history + audit + outbox", async () => {
    const { service, repository, auditService, outboxService } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(existingCase as never);
    vi.mocked(repository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);
    vi.mocked(repository.updateStatus).mockResolvedValue({
      ...existingCase,
      lifecycleStatus: "EVIDENCE_COLLECTION",
    } as never);

    const result = await service.transition(verifiedAuthorInOrg, "case-1", "EVIDENCE_COLLECTION", "manual", null);

    expect(repository.updateStatus).toHaveBeenCalledWith("case-1", 1, "EVIDENCE_COLLECTION", {});
    expect(repository.insertStatusHistory).toHaveBeenCalledWith(
      expect.objectContaining({ fromStatus: "DRAFT", toStatus: "EVIDENCE_COLLECTION" }),
      {},
    );
    expect(outboxService.append).toHaveBeenCalledWith(
      "technology_case",
      "case-1",
      expect.objectContaining({ type: "CaseStatusChanged" }),
      {},
    );
    expect(auditService.write).toHaveBeenCalled();
    expect(result.lifecycleStatus).toBe("EVIDENCE_COLLECTION");
  });
});

describe("TechnologyCaseService.listMembers / listOrganizations", () => {
  it("listMembers refuses when the case does not exist", async () => {
    const { service, repository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(undefined);

    await expect(service.listMembers(verifiedAuthorInOrg, "case-1")).rejects.toMatchObject({
      code: "CASE_NOT_FOUND",
    });
  });

  it("listMembers returns members for a visible case", async () => {
    const { service, repository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(existingCase as never);
    vi.mocked(repository.findActiveMembership).mockResolvedValue({ role: "OWNER" } as never);
    vi.mocked(repository.listMembers).mockResolvedValue([
      {
        id: "member-1",
        technologyCaseId: "case-1",
        userId: "author-1",
        organizationId: "org-1",
        role: "OWNER",
        status: "ACTIVE",
        invitedByUserId: null,
        joinedAt: new Date("2024-01-01T00:00:00Z"),
        createdAt: new Date("2024-01-01T00:00:00Z"),
      },
    ] as never);

    const result = await service.listMembers(verifiedAuthorInOrg, "case-1");
    expect(result).toHaveLength(1);
    expect(result[0]?.role).toBe("OWNER");
  });

  it("listOrganizations refuses an actor with no visibility into the case", async () => {
    const { service, repository } = buildService();
    vi.mocked(repository.findById).mockResolvedValue(existingCase as never);
    vi.mocked(repository.findActiveMembership).mockResolvedValue(undefined);
    vi.mocked(repository.hasOrganizationLink).mockResolvedValue(false);

    await expect(service.listOrganizations(unverifiedUser, "case-1")).rejects.toMatchObject({
      code: "AUTH_FORBIDDEN",
    });
  });
});
