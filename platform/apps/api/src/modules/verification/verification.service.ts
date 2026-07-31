import type {
  OrganizationVerificationDecisionRequest,
  OrganizationVerificationRequestResponse,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertPlatformReviewerOrAdmin } from "@r2m/authz";
import type { Database } from "@r2m/db";
import {
  assertOrganizationTransition,
  ConflictError,
  ErrorCode,
  ForbiddenError,
  NotFoundError,
} from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import type { OrganizationsRepository } from "../organizations/organizations.repository";
import { DATABASE } from "../../database/database.module";
import type { AuditService } from "../audit/audit.service";
import type { OutboxService } from "../jobs/outbox.service";
import type { VerificationRepository } from "./verification.repository";

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
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async listPending(actor: ActorContext): Promise<OrganizationVerificationRequestResponse[]> {
    assertPlatformReviewerOrAdmin(actor);
    const rows = await this.verificationRepository.listPending();
    return rows.map(toResponse);
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

  async resubmit(
    actor: ActorContext,
    organizationId: string,
  ): Promise<OrganizationVerificationRequestResponse> {
    const membership = await this.organizationsRepository.findMemberByUserId(organizationId, actor.userId);
    if (!membership || membership.status !== "ACTIVE" || membership.role === "MEMBER") {
      throw new ForbiddenError(
        ErrorCode.AUTH_FORBIDDEN,
        "Only an active ORG_OWNER or ORG_ADMIN may request re-verification.",
      );
    }
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

    const created = await this.verificationRepository.createResubmission(organizationId, actor.userId);
    await this.auditService.write({
      actorUserId: actor.userId,
      scopeOrganizationId: organizationId,
      action: "organization_verification_request.resubmit",
      entityType: "organization_verification_request",
      entityId: created.id,
      afterData: created,
    });
    await this.outboxService.append("organization", organizationId, {
      type: "OrganizationVerificationRequested",
      organizationId,
      verificationRequestId: created.id,
      submittedByUserId: actor.userId,
    });

    return toResponse(created);
  }
}
