import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@r2m/authz";
import { VerificationService } from "./verification.service";
import type { VerificationRepository } from "./verification.repository";
import type { OrganizationsRepository } from "../identity-organization/organizations/organizations.repository";
import type { AuditService } from "../platform-operations/audit/audit.service";
import type { OutboxService } from "../platform-operations/jobs/outbox.service";
import type { S3Service } from "../../common/storage/s3.service";

const reviewer: ActorContext = {
  userId: "reviewer-1",
  platformRole: "PLATFORM_REVIEWER",
  memberships: [],
  authorVerificationStatus: "UNVERIFIED",
  isEmailVerified: true,
};
const plainUser: ActorContext = {
  userId: "user-1",
  platformRole: "USER",
  memberships: [],
  authorVerificationStatus: "UNVERIFIED",
  isEmailVerified: true,
};

function buildService() {
  const verificationRepository = {
    findById: vi.fn(),
    listPending: vi.fn(),
    claim: vi.fn(),
    decide: vi.fn(),
    hasOpenRequest: vi.fn(),
    findOpenRequest: vi.fn(),
    createResubmission: vi.fn(),
    createDocument: vi.fn(),
    countDocuments: vi.fn().mockResolvedValue(1),
  } as unknown as VerificationRepository;

  const organizationsRepository = {
    findById: vi.fn(),
    updateOrganization: vi.fn(),
    findMemberByUserId: vi.fn(),
  } as unknown as OrganizationsRepository;

  const auditService = { write: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const outboxService = { append: vi.fn().mockResolvedValue(undefined) } as unknown as OutboxService;
  const s3Service = {
    uploadVerificationDocument: vi.fn().mockResolvedValue(undefined),
  } as unknown as S3Service;
  const db = { transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb({})) };

  const service = new VerificationService(
    verificationRepository,
    organizationsRepository,
    auditService,
    outboxService,
    s3Service,
    db as never,
  );

  return { service, verificationRepository, organizationsRepository, auditService, outboxService, s3Service };
}

describe("VerificationService (organization verification, UC-VER-02 pattern)", () => {
  it("rejects a non-reviewer platform role", async () => {
    const { service } = buildService();
    await expect(service.listPending(plainUser)).rejects.toMatchObject({ code: "AUTH_FORBIDDEN" });
  });

  it("does not let a reviewer claim their own submission", async () => {
    const { service, verificationRepository } = buildService();
    vi.mocked(verificationRepository.findById).mockResolvedValue({
      id: "req-1",
      submittedByUserId: reviewer.userId,
    } as never);

    await expect(service.claim(reviewer, "req-1")).rejects.toMatchObject({
      code: "VERIFICATION_REVIEWER_IS_SUBMITTER",
    });
  });

  it("returns a conflict when two reviewers race to claim the same PENDING request", async () => {
    const { service, verificationRepository } = buildService();
    vi.mocked(verificationRepository.findById).mockResolvedValue({
      id: "req-1",
      submittedByUserId: "someone-else",
    } as never);
    vi.mocked(verificationRepository.claim).mockResolvedValue(undefined as never);

    await expect(service.claim(reviewer, "req-1")).rejects.toMatchObject({
      code: "VERIFICATION_REQUEST_CONFLICT",
    });
  });

  describe("decide", () => {
    let deps: ReturnType<typeof buildService>;

    beforeEach(() => {
      deps = buildService();
      vi.mocked(deps.verificationRepository.findById).mockResolvedValue({
        id: "req-1",
        organizationId: "org-1",
        submittedByUserId: "submitter-1",
        reviewerUserId: reviewer.userId,
      } as never);
      vi.mocked(deps.organizationsRepository.findById).mockResolvedValue({
        id: "org-1",
        status: "PENDING_VERIFICATION",
        version: 1,
      } as never);
    });

    it("approving activates the organization in the same transaction", async () => {
      vi.mocked(deps.verificationRepository.decide).mockResolvedValue({
        id: "req-1",
        organizationId: "org-1",
        status: "APPROVED",
        submittedByUserId: "submitter-1",
        reviewerUserId: reviewer.userId,
        reviewerNote: null,
        submittedAt: new Date("2024-01-01T00:00:00Z"),
        reviewedAt: new Date("2024-01-02T00:00:00Z"),
      } as never);
      vi.mocked(deps.organizationsRepository.updateOrganization).mockResolvedValue({
        id: "org-1",
        status: "ACTIVE",
      } as never);

      await deps.service.decide(reviewer, "req-1", { decision: "APPROVE" }, null);

      expect(deps.organizationsRepository.updateOrganization).toHaveBeenCalledWith("org-1", 1, {
        status: "ACTIVE",
      });
      expect(deps.outboxService.append).toHaveBeenCalledWith(
        "organization",
        "org-1",
        expect.objectContaining({ type: "OrganizationActivated" }),
        {},
      );
    });

    it("rejecting moves the organization to REJECTED and records the reason", async () => {
      vi.mocked(deps.verificationRepository.decide).mockResolvedValue({
        id: "req-1",
        organizationId: "org-1",
        status: "REJECTED",
        submittedByUserId: "submitter-1",
        reviewerUserId: reviewer.userId,
        reviewerNote: "Tax code mismatch.",
        submittedAt: new Date("2024-01-01T00:00:00Z"),
        reviewedAt: new Date("2024-01-02T00:00:00Z"),
      } as never);
      vi.mocked(deps.organizationsRepository.updateOrganization).mockResolvedValue({
        id: "org-1",
        status: "REJECTED",
      } as never);

      await deps.service.decide(
        reviewer,
        "req-1",
        { decision: "REJECT", reviewerNote: "Tax code mismatch." },
        null,
      );

      expect(deps.outboxService.append).toHaveBeenCalledWith(
        "organization",
        "org-1",
        expect.objectContaining({ type: "OrganizationVerificationRejected", reason: "Tax code mismatch." }),
        {},
      );
    });

    it("refuses to approve when no verification_document is attached", async () => {
      vi.mocked(deps.verificationRepository.countDocuments).mockResolvedValue(0);

      await expect(
        deps.service.decide(reviewer, "req-1", { decision: "APPROVE" }, null),
      ).rejects.toMatchObject({ code: "VERIFICATION_MISSING_DOCUMENT" });
    });

    it("refuses to decide when the caller never claimed the request", async () => {
      vi.mocked(deps.verificationRepository.findById).mockResolvedValue({
        id: "req-1",
        organizationId: "org-1",
        submittedByUserId: "submitter-1",
        reviewerUserId: "some-other-reviewer",
      } as never);

      await expect(
        deps.service.decide(reviewer, "req-1", { decision: "APPROVE" }, null),
      ).rejects.toMatchObject({ code: "VERIFICATION_REQUEST_CONFLICT" });
    });
  });
});
