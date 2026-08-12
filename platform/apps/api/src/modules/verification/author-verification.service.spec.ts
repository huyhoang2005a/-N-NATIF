import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActorContext } from "@r2m/authz";
import { AuthorVerificationService } from "./author-verification.service";
import type { AuthorVerificationRepository } from "./author-verification.repository";
import type { AuditService } from "../platform-operations/audit/audit.service";
import type { OutboxService } from "../platform-operations/jobs/outbox.service";
import type { S3Service } from "../../common/storage/s3.service";
import type { FileSafetyService } from "../../common/file-safety/file-safety.service";

const author: ActorContext = {
  userId: "author-1",
  platformRole: "USER",
  memberships: [],
  authorVerificationStatus: "UNVERIFIED",
  isEmailVerified: true,
};
const reviewer: ActorContext = {
  userId: "reviewer-1",
  platformRole: "PLATFORM_REVIEWER",
  memberships: [],
  authorVerificationStatus: "UNVERIFIED",
  isEmailVerified: true,
};

function buildService() {
  const authorVerificationRepository = {
    findAuthorProfile: vi.fn(),
    createAuthorProfile: vi.fn(),
    updateAuthorProfileStatus: vi.fn(),
    findById: vi.fn(),
    listPending: vi.fn(),
    hasOpenRequest: vi.fn(),
    createRequest: vi.fn(),
    createDocument: vi.fn(),
    claim: vi.fn(),
    decide: vi.fn(),
    findDocumentByRequestId: vi.fn(),
    findAuthorProfileBySlug: vi.fn().mockResolvedValue(undefined),
    findUserDisplayName: vi.fn().mockResolvedValue("Test Author"),
  } as unknown as AuthorVerificationRepository;

  const auditService = { write: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const outboxService = { append: vi.fn().mockResolvedValue(undefined) } as unknown as OutboxService;
  const s3Service = {
    createVerificationUploadUrl: vi.fn(),
    createVerificationDownloadUrl: vi.fn(),
    getVerificationDocumentBuffer: vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4 fake")),
    deleteVerificationDocument: vi.fn().mockResolvedValue(undefined),
  } as unknown as S3Service;
  const fileSafetyService = {
    sniffMimeType: vi.fn().mockReturnValue("application/pdf"),
    scanForMalware: vi.fn().mockResolvedValue({ clean: true }),
  } as unknown as FileSafetyService;
  const db = { transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb({})) };

  const service = new AuthorVerificationService(
    authorVerificationRepository,
    auditService,
    outboxService,
    s3Service,
    fileSafetyService,
    db as never,
  );

  return { service, authorVerificationRepository, auditService, outboxService, s3Service, fileSafetyService };
}

const submitInput = {
  affiliationOrgId: "org-1",
  documentStorageObjectKey: "author-verification/author-1/doc.pdf",
  documentType: "IDENTITY_DOCUMENT" as const,
  originalFilename: "id.pdf",
  mimeType: "application/pdf" as const,
  sizeBytes: 1024,
};

describe("AuthorVerificationService.submit (UC-VER-01)", () => {
  it("refuses to submit when the author is already verified", async () => {
    const { service, authorVerificationRepository } = buildService();
    vi.mocked(authorVerificationRepository.findAuthorProfile).mockResolvedValue({
      userId: author.userId,
      verificationStatus: "VERIFIED",
    } as never);

    await expect(service.submit(author, submitInput, null)).rejects.toMatchObject({
      code: "AUTHOR_ALREADY_VERIFIED",
    });
  });

  it("refuses to submit a second request while one is already open", async () => {
    const { service, authorVerificationRepository } = buildService();
    vi.mocked(authorVerificationRepository.findAuthorProfile).mockResolvedValue(undefined);
    vi.mocked(authorVerificationRepository.hasOpenRequest).mockResolvedValue(true);

    await expect(service.submit(author, submitInput, null)).rejects.toMatchObject({
      code: "VERIFICATION_ALREADY_PENDING",
    });
  });

  it("rejects when the uploaded document cannot be found in the bucket", async () => {
    const { service, authorVerificationRepository, s3Service } = buildService();
    vi.mocked(authorVerificationRepository.findAuthorProfile).mockResolvedValue(undefined);
    vi.mocked(authorVerificationRepository.hasOpenRequest).mockResolvedValue(false);
    vi.mocked(s3Service.getVerificationDocumentBuffer).mockRejectedValue(new Error("NoSuchKey"));

    await expect(service.submit(author, submitInput, null)).rejects.toMatchObject({
      code: "AUTHOR_VERIFICATION_DOCUMENT_INVALID",
    });
  });

  it("creates a fresh author_profile, the request and its document in one transaction", async () => {
    const { service, authorVerificationRepository, auditService, outboxService } = buildService();
    vi.mocked(authorVerificationRepository.findAuthorProfile).mockResolvedValue(undefined);
    vi.mocked(authorVerificationRepository.hasOpenRequest).mockResolvedValue(false);
    vi.mocked(authorVerificationRepository.createRequest).mockResolvedValue({
      id: "req-1",
      authorUserId: author.userId,
      affiliationOrgId: "org-1",
      status: "PENDING",
      submittedNote: null,
      reviewerUserId: null,
      reviewerNote: null,
      submittedAt: new Date("2024-01-01T00:00:00Z"),
      reviewedAt: null,
    } as never);

    const result = await service.submit(author, submitInput, null);

    expect(authorVerificationRepository.createAuthorProfile).toHaveBeenCalledWith(author.userId, {});
    expect(authorVerificationRepository.updateAuthorProfileStatus).toHaveBeenCalledWith(
      author.userId,
      "PENDING",
      {},
    );
    expect(authorVerificationRepository.createDocument).toHaveBeenCalled();
    expect(auditService.write).toHaveBeenCalled();
    expect(outboxService.append).toHaveBeenCalledWith(
      "author_profile",
      author.userId,
      expect.objectContaining({ type: "AuthorVerificationSubmitted" }),
      {},
    );
    expect(result.status).toBe("PENDING");
  });
});

describe("AuthorVerificationService.claim", () => {
  it("does not let a reviewer claim their own submission", async () => {
    const { service, authorVerificationRepository } = buildService();
    vi.mocked(authorVerificationRepository.findById).mockResolvedValue({
      id: "req-1",
      authorUserId: reviewer.userId,
    } as never);

    await expect(service.claim(reviewer, "req-1")).rejects.toMatchObject({
      code: "VERIFICATION_REVIEWER_IS_SUBMITTER",
    });
  });
});

describe("AuthorVerificationService.decide (UC-VER-02 pattern)", () => {
  let deps: ReturnType<typeof buildService>;

  beforeEach(() => {
    deps = buildService();
    vi.mocked(deps.authorVerificationRepository.findById).mockResolvedValue({
      id: "req-1",
      authorUserId: "author-1",
      reviewerUserId: reviewer.userId,
    } as never);
    vi.mocked(deps.authorVerificationRepository.findAuthorProfile).mockResolvedValue({
      userId: "author-1",
      verificationStatus: "PENDING",
    } as never);
  });

  it("approving verifies the author profile in the same transaction", async () => {
    vi.mocked(deps.authorVerificationRepository.decide).mockResolvedValue({
      id: "req-1",
      authorUserId: "author-1",
      affiliationOrgId: "org-1",
      status: "APPROVED",
      submittedNote: null,
      reviewerUserId: reviewer.userId,
      reviewerNote: null,
      submittedAt: new Date("2024-01-01T00:00:00Z"),
      reviewedAt: new Date("2024-01-02T00:00:00Z"),
    } as never);

    await deps.service.decide(reviewer, "req-1", { decision: "APPROVE" }, null);

    expect(deps.authorVerificationRepository.updateAuthorProfileStatus).toHaveBeenCalledWith(
      "author-1",
      "VERIFIED",
      {},
      { verifiedAt: expect.any(Date), publicSlug: "test-author" },
    );
    expect(deps.outboxService.append).toHaveBeenCalledWith(
      "author_profile",
      "author-1",
      expect.objectContaining({ type: "AuthorVerified" }),
      {},
    );
  });

  it("rejecting declines the author profile and records the reason", async () => {
    vi.mocked(deps.authorVerificationRepository.decide).mockResolvedValue({
      id: "req-1",
      authorUserId: "author-1",
      affiliationOrgId: "org-1",
      status: "REJECTED",
      submittedNote: null,
      reviewerUserId: reviewer.userId,
      reviewerNote: "Document illegible.",
      submittedAt: new Date("2024-01-01T00:00:00Z"),
      reviewedAt: new Date("2024-01-02T00:00:00Z"),
    } as never);

    await deps.service.decide(
      reviewer,
      "req-1",
      { decision: "REJECT", reviewerNote: "Document illegible." },
      null,
    );

    expect(deps.authorVerificationRepository.updateAuthorProfileStatus).toHaveBeenCalledWith(
      "author-1",
      "DECLINED",
      {},
      undefined,
    );
    expect(deps.outboxService.append).toHaveBeenCalledWith(
      "author_profile",
      "author-1",
      expect.objectContaining({ type: "AuthorVerificationRejected", reason: "Document illegible." }),
      {},
    );
  });

  it("refuses to decide when the caller never claimed the request", async () => {
    vi.mocked(deps.authorVerificationRepository.findById).mockResolvedValue({
      id: "req-1",
      authorUserId: "author-1",
      reviewerUserId: "some-other-reviewer",
    } as never);

    await expect(
      deps.service.decide(reviewer, "req-1", { decision: "APPROVE" }, null),
    ).rejects.toMatchObject({ code: "VERIFICATION_REQUEST_CONFLICT" });
  });
});
