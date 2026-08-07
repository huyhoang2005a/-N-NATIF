import { randomUUID } from "node:crypto";
import type {
  AuthorVerificationDecisionRequest,
  AuthorVerificationRequestResponse,
  AuthorVerificationUploadResponse,
  RequestAuthorVerificationUploadRequest,
  SubmitAuthorVerificationRequest,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertPlatformReviewerOrAdmin } from "@r2m/authz";
import type { Database } from "@r2m/database";
import {
  AuthorVerificationStatus,
  ConflictError,
  ErrorCode,
  ForbiddenError,
  NotFoundError,
} from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../database/database.module";
import { S3Service } from "../../common/storage/s3.service";
import { AuditService } from "../platform-operations/audit/audit.service";
import { OutboxService } from "../platform-operations/jobs/outbox.service";
import { assertAuthorProfileTransition } from "./domain/author-profile.state-machine";
import { AuthorVerificationRepository } from "./author-verification.repository";

function toRequestResponse(request: {
  id: string;
  authorUserId: string;
  affiliationOrgId: string;
  status: string;
  submittedNote: string | null;
  reviewerUserId: string | null;
  reviewerNote: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
}): AuthorVerificationRequestResponse {
  return {
    id: request.id,
    authorUserId: request.authorUserId,
    affiliationOrgId: request.affiliationOrgId,
    status: request.status,
    submittedNote: request.submittedNote,
    reviewerUserId: request.reviewerUserId,
    reviewerNote: request.reviewerNote,
    submittedAt: request.submittedAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
  };
}

/** UC-VER-01/02 applied to author verification. Bounded context: Verification. */
@Injectable()
export class AuthorVerificationService {
  constructor(
    private readonly authorVerificationRepository: AuthorVerificationRepository,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    private readonly s3Service: S3Service,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async requestUpload(
    actor: ActorContext,
    input: RequestAuthorVerificationUploadRequest,
  ): Promise<AuthorVerificationUploadResponse> {
    const safeFilename = input.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageObjectKey = `author-verification/${actor.userId}/${randomUUID()}_${safeFilename}`;
    const { url, expiresIn } = await this.s3Service.createVerificationUploadUrl(
      storageObjectKey,
      input.mimeType,
    );
    return { uploadUrl: url, storageObjectKey, expiresIn };
  }

  async submit(
    actor: ActorContext,
    input: SubmitAuthorVerificationRequest,
    requestIdHeader: string | null,
  ): Promise<AuthorVerificationRequestResponse> {
    if (!actor.isEmailVerified) {
      throw new ForbiddenError(
        ErrorCode.AUTH_EMAIL_NOT_VERIFIED,
        "Verify your email address before submitting an author verification request.",
      );
    }
    const existingProfile = await this.authorVerificationRepository.findAuthorProfile(actor.userId);
    if (existingProfile?.verificationStatus === AuthorVerificationStatus.VERIFIED) {
      throw new ConflictError(ErrorCode.AUTHOR_ALREADY_VERIFIED, "Author is already verified.");
    }
    if (await this.authorVerificationRepository.hasOpenRequest(actor.userId)) {
      throw new ConflictError(
        ErrorCode.VERIFICATION_ALREADY_PENDING,
        "An author verification request is already open.",
      );
    }

    let checksumSha256: string;
    try {
      checksumSha256 = await this.s3Service.computeVerificationDocumentSha256(
        input.documentStorageObjectKey,
      );
    } catch {
      throw new ConflictError(
        ErrorCode.AUTHOR_VERIFICATION_DOCUMENT_INVALID,
        "The uploaded document could not be found — request a new upload URL and try again.",
      );
    }

    const created = await this.db.transaction(async (tx) => {
      if (!existingProfile) {
        await this.authorVerificationRepository.createAuthorProfile(actor.userId, tx);
      } else {
        assertAuthorProfileTransition(
          existingProfile.verificationStatus as AuthorVerificationStatus,
          AuthorVerificationStatus.PENDING,
        );
      }
      await this.authorVerificationRepository.updateAuthorProfileStatus(
        actor.userId,
        AuthorVerificationStatus.PENDING,
        tx,
      );

      const request = await this.authorVerificationRepository.createRequest(
        actor.userId,
        input.affiliationOrgId,
        input.submittedNote,
        tx,
      );

      await this.authorVerificationRepository.createDocument(
        {
          authorVerificationRequestId: request.id,
          documentType: input.documentType,
          storageObjectKey: input.documentStorageObjectKey,
          originalFilename: input.originalFilename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          checksumSha256,
        },
        tx,
      );

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          action: "author_verification_request.submit",
          entityType: "author_verification_request",
          entityId: request.id,
          requestId: requestIdHeader,
          afterData: request,
        },
        tx,
      );

      await this.outboxService.append(
        "author_profile",
        actor.userId,
        {
          type: "AuthorVerificationSubmitted",
          authorUserId: actor.userId,
          verificationRequestId: request.id,
        },
        tx,
      );

      return request;
    });

    return toRequestResponse(created);
  }

  async listPending(actor: ActorContext): Promise<AuthorVerificationRequestResponse[]> {
    assertPlatformReviewerOrAdmin(actor);
    const rows = await this.authorVerificationRepository.listPending();
    return rows.map(toRequestResponse);
  }

  async claim(actor: ActorContext, requestId: string): Promise<AuthorVerificationRequestResponse> {
    assertPlatformReviewerOrAdmin(actor);
    const existing = await this.authorVerificationRepository.findById(requestId);
    if (!existing) {
      throw new NotFoundError(ErrorCode.VERIFICATION_REQUEST_NOT_FOUND, "Verification request not found.");
    }
    if (existing.authorUserId === actor.userId) {
      throw new ForbiddenError(
        ErrorCode.VERIFICATION_REVIEWER_IS_SUBMITTER,
        "A reviewer cannot claim their own submission.",
      );
    }

    const claimed = await this.authorVerificationRepository.claim(requestId, actor.userId);
    if (!claimed) {
      throw new ConflictError(
        ErrorCode.VERIFICATION_REQUEST_CONFLICT,
        "This request was already claimed or decided by another reviewer.",
      );
    }
    return toRequestResponse(claimed);
  }

  /** UC-VER-02 main flow step 3: "Kiểm tra tài liệu qua signed URL có TTL". */
  async getDocumentDownloadUrl(actor: ActorContext, requestId: string): Promise<{ url: string; expiresIn: number }> {
    assertPlatformReviewerOrAdmin(actor);
    const request = await this.authorVerificationRepository.findById(requestId);
    if (!request) {
      throw new NotFoundError(ErrorCode.VERIFICATION_REQUEST_NOT_FOUND, "Verification request not found.");
    }
    const document = await this.authorVerificationRepository.findDocumentByRequestId(requestId);
    if (!document) {
      throw new NotFoundError(
        ErrorCode.AUTHOR_VERIFICATION_DOCUMENT_INVALID,
        "No document is attached to this request.",
      );
    }
    return this.s3Service.createVerificationDownloadUrl(document.storageObjectKey);
  }

  async decide(
    actor: ActorContext,
    requestId: string,
    decision: AuthorVerificationDecisionRequest,
    requestIdHeader: string | null,
  ): Promise<AuthorVerificationRequestResponse> {
    assertPlatformReviewerOrAdmin(actor);
    const existing = await this.authorVerificationRepository.findById(requestId);
    if (!existing) {
      throw new NotFoundError(ErrorCode.VERIFICATION_REQUEST_NOT_FOUND, "Verification request not found.");
    }
    if (existing.authorUserId === actor.userId) {
      throw new ForbiddenError(
        ErrorCode.VERIFICATION_REVIEWER_IS_SUBMITTER,
        "A reviewer cannot decide their own submission.",
      );
    }
    if (existing.reviewerUserId !== actor.userId) {
      throw new ForbiddenError(
        ErrorCode.VERIFICATION_REQUEST_CONFLICT,
        "Only the reviewer who claimed this request may decide it.",
      );
    }

    const profile = await this.authorVerificationRepository.findAuthorProfile(existing.authorUserId);
    if (!profile) {
      throw new NotFoundError(ErrorCode.VERIFICATION_REQUEST_NOT_FOUND, "Author profile not found.");
    }

    const newProfileStatus =
      decision.decision === "APPROVE"
        ? AuthorVerificationStatus.VERIFIED
        : AuthorVerificationStatus.DECLINED;
    assertAuthorProfileTransition(
      profile.verificationStatus as AuthorVerificationStatus,
      newProfileStatus,
    );

    const updatedRequest = await this.db.transaction(async (tx) => {
      const decided = await this.authorVerificationRepository.decide(
        requestId,
        actor.userId,
        decision.decision === "APPROVE" ? "APPROVED" : "REJECTED",
        decision.reviewerNote,
        tx,
      );
      if (!decided) {
        throw new ConflictError(
          ErrorCode.VERIFICATION_REQUEST_CONFLICT,
          "This request is no longer awaiting this reviewer's decision.",
        );
      }

      await this.authorVerificationRepository.updateAuthorProfileStatus(
        existing.authorUserId,
        newProfileStatus,
        tx,
        decision.decision === "APPROVE" ? { verifiedAt: new Date() } : undefined,
      );

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          requestId: requestIdHeader,
          action: "author_verification_request.decide",
          entityType: "author_verification_request",
          entityId: requestId,
          beforeData: existing,
          afterData: decided,
        },
        tx,
      );

      if (decision.decision === "APPROVE") {
        await this.outboxService.append(
          "author_profile",
          existing.authorUserId,
          {
            type: "AuthorVerified",
            authorUserId: existing.authorUserId,
            verificationRequestId: requestId,
            reviewerUserId: actor.userId,
          },
          tx,
        );
      } else {
        await this.outboxService.append(
          "author_profile",
          existing.authorUserId,
          {
            type: "AuthorVerificationRejected",
            authorUserId: existing.authorUserId,
            verificationRequestId: requestId,
            reviewerUserId: actor.userId,
            reason: decision.reviewerNote ?? "",
          },
          tx,
        );
      }

      return decided;
    });

    return toRequestResponse(updatedRequest);
  }
}
