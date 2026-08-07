import { randomUUID, createHash } from "node:crypto";
import type {
  OrganizationVerificationDecisionRequest,
  OrganizationVerificationDocumentResponse,
  OrganizationVerificationRequestResponse,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertPlatformReviewerOrAdmin } from "@r2m/authz";
import type { Database } from "@r2m/database";
import {
  assertOrganizationTransition,
  ConflictError,
  ErrorCode,
  ForbiddenError,
  NotFoundError,
} from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { OrganizationsRepository } from "../identity-organization/organizations/organizations.repository";
import { DATABASE } from "../../database/database.module";
import { S3Service } from "../../common/storage/s3.service";
import { AuditService } from "../platform-operations/audit/audit.service";
import { OutboxService } from "../platform-operations/jobs/outbox.service";
import { VerificationRepository } from "./verification.repository";

export interface OrganizationVerificationDocumentUpload {
  documentType: string;
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}

function toResponse(request: {
  id: string;
  organizationId: string;
  status: string;
  submittedByUserId: string;
  reviewerUserId: string | null;
  reviewerNote: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
}): OrganizationVerificationRequestResponse {
  return {
    id: request.id,
    organizationId: request.organizationId,
    status: request.status,
    submittedByUserId: request.submittedByUserId,
    reviewerUserId: request.reviewerUserId,
    reviewerNote: request.reviewerNote,
    submittedAt: request.submittedAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
  };
}

/** UC-VER-02 applied to organization verification (SUC-03). Bounded context: Verification. */
@Injectable()
export class VerificationService {
  constructor(
    private readonly verificationRepository: VerificationRepository,
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    private readonly s3Service: S3Service,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async listPending(actor: ActorContext): Promise<OrganizationVerificationRequestResponse[]> {
    assertPlatformReviewerOrAdmin(actor);
    const rows = await this.verificationRepository.listPending();
    return rows.map(toResponse);
  }

  /** Reviewer-only: each document gets its own freshly-signed download URL so the client
   * never links to a URL that may have already expired by the time it's clicked. */
  async listDocuments(actor: ActorContext, requestId: string): Promise<OrganizationVerificationDocumentResponse[]> {
    assertPlatformReviewerOrAdmin(actor);
    const existing = await this.verificationRepository.findById(requestId);
    if (!existing) {
      throw new NotFoundError(ErrorCode.VERIFICATION_REQUEST_NOT_FOUND, "Verification request not found.");
    }
    const documents = await this.verificationRepository.listDocuments(requestId);
    return Promise.all(
      documents.map(async (doc) => {
        const { url, expiresIn } = await this.s3Service.createVerificationDownloadUrl(doc.storageObjectKey);
        return {
          id: doc.id,
          documentType: doc.documentType,
          originalFilename: doc.originalFilename ?? "",
          downloadUrl: url,
          expiresIn,
        };
      }),
    );
  }

  async claim(actor: ActorContext, requestId: string): Promise<OrganizationVerificationRequestResponse> {
    assertPlatformReviewerOrAdmin(actor);
    const existing = await this.verificationRepository.findById(requestId);
    if (!existing) {
      throw new NotFoundError(ErrorCode.VERIFICATION_REQUEST_NOT_FOUND, "Verification request not found.");
    }
    if (existing.submittedByUserId === actor.userId) {
      throw new ForbiddenError(
        ErrorCode.VERIFICATION_REVIEWER_IS_SUBMITTER,
        "A reviewer cannot claim their own submission.",
      );
    }

    const claimed = await this.verificationRepository.claim(requestId, actor.userId);
    if (!claimed) {
      throw new ConflictError(
        ErrorCode.VERIFICATION_REQUEST_CONFLICT,
        "This request was already claimed or decided by another reviewer.",
      );
    }
    return toResponse(claimed);
  }

  async decide(
    actor: ActorContext,
    requestId: string,
    decision: OrganizationVerificationDecisionRequest,
    requestIdHeader: string | null,
  ): Promise<OrganizationVerificationRequestResponse> {
    assertPlatformReviewerOrAdmin(actor);
    const existing = await this.verificationRepository.findById(requestId);
    if (!existing) {
      throw new NotFoundError(ErrorCode.VERIFICATION_REQUEST_NOT_FOUND, "Verification request not found.");
    }
    if (existing.submittedByUserId === actor.userId) {
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

    const org = await this.organizationsRepository.findById(existing.organizationId);
    if (!org) {
      throw new NotFoundError(ErrorCode.ORG_NOT_FOUND, "Organization not found.");
    }

    if (decision.decision === "APPROVE") {
      const documentCount = await this.verificationRepository.countDocuments(requestId);
      if (documentCount === 0) {
        throw new ConflictError(
          ErrorCode.VERIFICATION_MISSING_DOCUMENT,
          "Cannot approve: no verification_document is attached to this request.",
        );
      }
    }

    const newOrgStatus = decision.decision === "APPROVE" ? "ACTIVE" : "REJECTED";
    assertOrganizationTransition(org.status as never, newOrgStatus);

    const updatedRequest = await this.db.transaction(async (tx) => {
      const decided = await this.verificationRepository.decide(
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

      const updatedOrg = await this.organizationsRepository.updateOrganization(org.id, org.version, {
        status: newOrgStatus,
      });
      if (!updatedOrg) {
        throw new ConflictError(
          ErrorCode.ORG_VERSION_CONFLICT,
          "Organization was modified concurrently — retry the decision.",
        );
      }

      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: org.id,
          requestId: requestIdHeader,
          action: "organization_verification_request.decide",
          entityType: "organization_verification_request",
          entityId: requestId,
          beforeData: existing,
          afterData: decided,
        },
        tx,
      );

      if (decision.decision === "APPROVE") {
        await this.outboxService.append(
          "organization",
          org.id,
          {
            type: "OrganizationActivated",
            organizationId: org.id,
            verificationRequestId: requestId,
            reviewerUserId: actor.userId,
          },
          tx,
        );
      } else {
        await this.outboxService.append(
          "organization",
          org.id,
          {
            type: "OrganizationVerificationRejected",
            organizationId: org.id,
            verificationRequestId: requestId,
            reviewerUserId: actor.userId,
            reason: decision.reviewerNote ?? "",
          },
          tx,
        );
      }

      return decided;
    });

    return toResponse(updatedRequest);
  }

  private assertSubmitterMembership(actor: ActorContext, membership: { status: string; role: string } | undefined): void {
    if (!membership || membership.status !== "ACTIVE" || membership.role === "MEMBER") {
      throw new ForbiddenError(
        ErrorCode.AUTH_FORBIDDEN,
        "Only an active ORG_OWNER or ORG_ADMIN may submit organization verification documents.",
      );
    }
    if (!actor.isEmailVerified) {
      throw new ForbiddenError(
        ErrorCode.AUTH_EMAIL_NOT_VERIFIED,
        "Verify your email address before submitting an organization verification request.",
      );
    }
  }

  private async storeDocument(
    organizationId: string,
    document: OrganizationVerificationDocumentUpload,
  ): Promise<{
    storageObjectKey: string;
    checksumSha256: string;
  }> {
    const safeFilename = document.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageObjectKey = `organization-verification/${organizationId}/${randomUUID()}_${safeFilename}`;
    await this.s3Service.uploadVerificationDocument(storageObjectKey, document.buffer, document.mimeType);
    const checksumSha256 = createHash("sha256").update(document.buffer).digest("hex");
    return { storageObjectKey, checksumSha256 };
  }

  async resubmit(
    actor: ActorContext,
    organizationId: string,
    document: OrganizationVerificationDocumentUpload,
    requestIdHeader: string | null,
  ): Promise<OrganizationVerificationRequestResponse> {
    const membership = await this.organizationsRepository.findMemberByUserId(organizationId, actor.userId);
    this.assertSubmitterMembership(actor, membership);
    const org = await this.organizationsRepository.findById(organizationId);
    if (!org) {
      throw new NotFoundError(ErrorCode.ORG_NOT_FOUND, "Organization not found.");
    }
    if (org.status !== "PENDING_VERIFICATION" && org.status !== "REJECTED") {
      throw new ConflictError(
        ErrorCode.VERIFICATION_ALREADY_PENDING,
        "Organization does not need re-verification in its current status.",
      );
    }
    if (await this.verificationRepository.hasOpenRequest(organizationId)) {
      throw new ConflictError(
        ErrorCode.VERIFICATION_ALREADY_PENDING,
        "A verification request is already open for this organization.",
      );
    }

    const { storageObjectKey, checksumSha256 } = await this.storeDocument(organizationId, document);

    const created = await this.db.transaction(async (tx) => {
      const request = await this.verificationRepository.createResubmission(organizationId, actor.userId, tx);
      await this.verificationRepository.createDocument(
        {
          organizationVerificationRequestId: request.id,
          documentType: document.documentType,
          storageObjectKey,
          originalFilename: document.originalFilename,
          mimeType: document.mimeType,
          sizeBytes: document.sizeBytes,
          checksumSha256,
        },
        tx,
      );
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: organizationId,
          requestId: requestIdHeader,
          action: "organization_verification_request.resubmit",
          entityType: "organization_verification_request",
          entityId: request.id,
          afterData: request,
        },
        tx,
      );
      await this.outboxService.append(
        "organization",
        organizationId,
        {
          type: "OrganizationVerificationRequested",
          organizationId,
          verificationRequestId: request.id,
          submittedByUserId: actor.userId,
        },
        tx,
      );
      return request;
    });

    return toResponse(created);
  }

  /** Attaches a document to the organization's currently open request — covers the
   * request created implicitly by `OrganizationsService.register()` (no client "create"
   * call exists for it) as well as adding extra evidence while PENDING/IN_REVIEW. */
  async attachDocument(
    actor: ActorContext,
    organizationId: string,
    document: OrganizationVerificationDocumentUpload,
    requestIdHeader: string | null,
  ): Promise<OrganizationVerificationRequestResponse> {
    const membership = await this.organizationsRepository.findMemberByUserId(organizationId, actor.userId);
    this.assertSubmitterMembership(actor, membership);

    const openRequest = await this.verificationRepository.findOpenRequest(organizationId);
    if (!openRequest) {
      throw new NotFoundError(
        ErrorCode.VERIFICATION_REQUEST_NOT_FOUND,
        "This organization has no open verification request to attach a document to.",
      );
    }

    const { storageObjectKey, checksumSha256 } = await this.storeDocument(organizationId, document);

    await this.db.transaction(async (tx) => {
      await this.verificationRepository.createDocument(
        {
          organizationVerificationRequestId: openRequest.id,
          documentType: document.documentType,
          storageObjectKey,
          originalFilename: document.originalFilename,
          mimeType: document.mimeType,
          sizeBytes: document.sizeBytes,
          checksumSha256,
        },
        tx,
      );
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: organizationId,
          requestId: requestIdHeader,
          action: "organization_verification_request.attach_document",
          entityType: "organization_verification_request",
          entityId: openRequest.id,
        },
        tx,
      );
    });

    return toResponse(openRequest);
  }
}
