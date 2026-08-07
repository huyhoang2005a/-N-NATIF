import { randomUUID, createHash } from "node:crypto";
import type {
  InviteMemberRequest,
  JoinOrganizationRequest,
  OrganizationMemberResponse,
  OrganizationResponse,
  PendingMembershipResponse,
  RegisterOrganizationWithDocumentRequest,
  UpdateMemberRequest,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertOrgOwnerOrAdmin } from "@r2m/authz";
import type { Database } from "@r2m/database";
import { ConflictError, ErrorCode, ForbiddenError, NotFoundError } from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import type { MultipartDocumentUpload } from "../../../common/multipart/document-upload.util";
import { S3Service } from "../../../common/storage/s3.service";
import { DATABASE } from "../../../database/database.module";
import { AuditService } from "../../platform-operations/audit/audit.service";
import { OutboxService } from "../../platform-operations/jobs/outbox.service";
import { EmailVerificationRepository } from "../email-verification/email-verification.repository";
import { assertNotRemovingLastActiveOwner } from "./organizations.policy";
import { OrganizationsRepository } from "./organizations.repository";
import { emailDomain, slugify } from "./slug.util";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

function toOrganizationResponse(org: {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  website: string | null;
  taxCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}): OrganizationResponse {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    type: org.type as OrganizationResponse["type"],
    status: org.status,
    website: org.website,
    taxCode: org.taxCode,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
    version: org.version,
  };
}

function toMemberResponse(
  member: {
    id: string;
    organizationId: string;
    userId: string;
    role: string;
    status: string;
    invitedAt: Date | null;
    joinedAt: Date | null;
  },
  user?: { primaryEmail: string; profile?: { displayName: string } | null },
): OrganizationMemberResponse {
  return {
    id: member.id,
    organizationId: member.organizationId,
    userId: member.userId,
    displayName: user?.profile?.displayName ?? "",
    email: user?.primaryEmail ?? "",
    role: member.role as OrganizationMemberResponse["role"],
    status: member.status,
    invitedAt: member.invitedAt?.toISOString() ?? null,
    joinedAt: member.joinedAt?.toISOString() ?? null,
  };
}

/** UC-ORG-01 (registration) + SUC-02 (member management). Bounded context: Identity & Organization. */
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    private readonly emailVerificationRepository: EmailVerificationRepository,
    private readonly s3Service: S3Service,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async register(
    request: RegisterOrganizationWithDocumentRequest,
    document: MultipartDocumentUpload,
    requestId: string | null,
  ): Promise<OrganizationResponse> {
    const slug = slugify(request.organizationName);
    const domain = emailDomain(request.ownerEmail);

    const existingBySlug = await this.organizationsRepository.findBySlug(slug);
    if (existingBySlug) {
      throw new ConflictError(
        ErrorCode.ORG_ALREADY_EXISTS,
        "An organization with this name already exists.",
      );
    }
    const existingUser = await this.organizationsRepository.findUserByEmail(request.ownerEmail);
    if (existingUser) {
      throw new ConflictError(
        ErrorCode.AUTH_EMAIL_ALREADY_REGISTERED,
        "This email is already registered to an account.",
      );
    }
    // Domain is globally unique (organization_domain) — surface this specifically instead
    // of letting it fall through to the generic ORG_ALREADY_EXISTS catch below, so the
    // client can offer "join that organization instead" (see joinRequest()).
    const existingOrgByDomain = await this.organizationsRepository.findOrganizationByDomain(domain);
    if (existingOrgByDomain) {
      throw new ConflictError(
        ErrorCode.ORG_DOMAIN_ALREADY_REGISTERED,
        "An organization with this email domain is already registered.",
        {
          organizationId: existingOrgByDomain.id,
          organizationName: existingOrgByDomain.name,
          organizationStatus: existingOrgByDomain.status,
        },
      );
    }

    // Generated up front (not left to the DB default) so the S3 object key can reference it
    // — the upload happens outside the transaction (S3 isn't transactional), mirroring
    // verification.service.ts::storeDocument.
    const organizationId = randomUUID();
    const safeFilename = document.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageObjectKey = `organization-verification/${organizationId}/${randomUUID()}_${safeFilename}`;
    await this.s3Service.uploadVerificationDocument(storageObjectKey, document.buffer, document.mimeType);
    const checksumSha256 = createHash("sha256").update(document.buffer).digest("hex");

    try {
      const org = await this.db.transaction(async (tx) => {
        const passwordHash = await bcrypt.hash(request.ownerPassword, 10);
        const owner = await this.organizationsRepository.createUserAccount(
          { primaryEmail: request.ownerEmail, status: "ACTIVE" },
          tx,
        );
        await this.organizationsRepository.createUserIdentity(
          { userId: owner.id, provider: "LOCAL", providerSubject: request.ownerEmail, passwordHash },
          tx,
        );
        await this.organizationsRepository.createUserProfile(
          { userId: owner.id, displayName: request.ownerDisplayName },
          tx,
        );

        const { row: verificationToken, rawToken: emailVerificationRawToken } =
          await this.emailVerificationRepository.createToken(owner.id, "EMAIL_VERIFICATION", tx);

        const createdOrg = await this.organizationsRepository.createOrganization(
          {
            id: organizationId,
            name: request.organizationName,
            slug,
            type: request.organizationType,
            status: "PENDING_VERIFICATION",
            website: request.website ?? null,
            taxCode: request.taxCode ?? null,
            institutionIdentifier: request.institutionIdentifier ?? null,
            createdByUserId: owner.id,
            primaryContactUserId: owner.id,
          },
          tx,
        );

        await this.organizationsRepository.createOrganizationDomain(
          { organizationId: createdOrg.id, domain, isPrimary: true },
          tx,
        );

        await this.organizationsRepository.createOrganizationMember(
          {
            organizationId: createdOrg.id,
            userId: owner.id,
            role: "ORG_OWNER",
            status: "ACTIVE",
            joinedAt: new Date(),
          },
          tx,
        );

        // Phase 1 has no defined auto-verification policy criteria in the spec, so every
        // new organization always goes through manual review — see packages/database README.
        const verificationRequest = await this.organizationsRepository.createVerificationRequest(
          { organizationId: createdOrg.id, submittedByUserId: owner.id, status: "PENDING" },
          tx,
        );

        // Mandatory verification document, submitted in the same call as registration
        // (no separate post-registration upload step for the founding request).
        await this.organizationsRepository.createVerificationDocument(
          {
            organizationVerificationRequestId: verificationRequest.id,
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
            actorUserId: owner.id,
            scopeOrganizationId: createdOrg.id,
            requestId,
            action: "organization.register",
            entityType: "organization",
            entityId: createdOrg.id,
            afterData: createdOrg,
          },
          tx,
        );

        await this.outboxService.append(
          "organization",
          createdOrg.id,
          {
            type: "OrganizationRegistered",
            organizationId: createdOrg.id,
            ownerUserId: owner.id,
            organizationType: createdOrg.type,
            requiresManualVerification: true,
          },
          tx,
        );
        await this.outboxService.append(
          "organization",
          createdOrg.id,
          {
            type: "OrganizationVerificationRequested",
            organizationId: createdOrg.id,
            verificationRequestId: verificationRequest.id,
            submittedByUserId: owner.id,
          },
          tx,
        );
        await this.outboxService.append(
          "user_account",
          owner.id,
          {
            type: "EmailVerificationRequested",
            userId: owner.id,
            email: request.ownerEmail,
            token: emailVerificationRawToken,
            expiresAt: verificationToken.expiresAt.toISOString(),
          },
          tx,
        );

        return createdOrg;
      });

      return toOrganizationResponse(org);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          ErrorCode.ORG_ALREADY_EXISTS,
          "An organization or account with these details already exists.",
        );
      }
      throw error;
    }
  }

  async getById(actor: ActorContext, organizationId: string): Promise<OrganizationResponse> {
    const org = await this.organizationsRepository.findById(organizationId);
    if (!org) {
      throw new NotFoundError(ErrorCode.ORG_NOT_FOUND, "Organization not found.");
    }
    const isPrivileged = actor.platformRole !== "USER";
    const membership = await this.organizationsRepository.findMemberByUserId(organizationId, actor.userId);
    if (!isPrivileged && (!membership || membership.status !== "ACTIVE")) {
      throw new ForbiddenError(ErrorCode.ORG_NOT_MEMBER, "Actor is not a member of this organization.");
    }
    return toOrganizationResponse(org);
  }

  async listMine(actor: ActorContext): Promise<OrganizationResponse[]> {
    const memberships = await this.organizationsRepository.listMembersForActiveOrganizations(actor.userId);
    return memberships.map((membership) => toOrganizationResponse(membership.organization));
  }

  async inviteMember(
    actor: ActorContext,
    organizationId: string,
    request: InviteMemberRequest,
    requestId: string | null,
  ): Promise<OrganizationMemberResponse> {
    assertOrgOwnerOrAdmin(actor, organizationId);
    const org = await this.organizationsRepository.findById(organizationId);
    if (!org) {
      throw new NotFoundError(ErrorCode.ORG_NOT_FOUND, "Organization not found.");
    }
    if (org.status !== "ACTIVE") {
      throw new ConflictError(ErrorCode.ORG_NOT_ACTIVE, "Organization must be ACTIVE to invite members.");
    }

    let invitedUser = await this.organizationsRepository.findUserByEmail(request.email);
    const wasNewUser = !invitedUser;
    if (!invitedUser) {
      invitedUser = await this.db.transaction((tx) =>
        this.organizationsRepository.createUserAccount(
          { primaryEmail: request.email, status: "INVITED" },
          tx,
        ),
      );
    }

    const existingMembership = await this.organizationsRepository.findMemberByUserId(
      organizationId,
      invitedUser.id,
    );
    if (existingMembership) {
      throw new ConflictError(
        ErrorCode.ORG_MEMBER_ALREADY_EXISTS,
        "This user is already a member of the organization.",
      );
    }

    const member = await this.organizationsRepository.createOrganizationMember({
      organizationId,
      userId: invitedUser.id,
      role: request.role,
      status: "INVITED",
      invitedByUserId: actor.userId,
      invitedAt: new Date(),
    });

    await this.auditService.write({
      actorUserId: actor.userId,
      scopeOrganizationId: organizationId,
      requestId,
      action: "organization_member.invite",
      entityType: "organization_member",
      entityId: member.id,
      afterData: { ...member, wasNewUser },
    });
    await this.outboxService.append("organization_member", member.id, {
      type: "OrganizationMemberInvited",
      organizationId,
      memberId: member.id,
      invitedUserId: invitedUser.id,
      invitedByUserId: actor.userId,
      role: request.role,
    });

    return toMemberResponse(member, invitedUser);
  }

  /** Self-service join request for an organization already registered under the
   * requester's email domain — no invite token needed, but membership starts
   * PENDING_APPROVAL and only an ORG_OWNER/ORG_ADMIN can activate it (via updateMember). */
  async joinRequest(
    organizationId: string,
    request: JoinOrganizationRequest,
    requestId: string | null,
  ): Promise<OrganizationMemberResponse> {
    const org = await this.organizationsRepository.findById(organizationId);
    if (!org) {
      throw new NotFoundError(ErrorCode.ORG_NOT_FOUND, "Organization not found.");
    }
    if (org.status !== "ACTIVE") {
      throw new ConflictError(ErrorCode.ORG_NOT_ACTIVE, "Organization must be ACTIVE to accept join requests.");
    }
    const existingUser = await this.organizationsRepository.findUserByEmail(request.email);
    if (existingUser) {
      throw new ConflictError(
        ErrorCode.AUTH_EMAIL_ALREADY_REGISTERED,
        "This email is already registered to an account.",
      );
    }

    const member = await this.db.transaction(async (tx) => {
      const passwordHash = await bcrypt.hash(request.password, 10);
      const user = await this.organizationsRepository.createUserAccount(
        { primaryEmail: request.email, status: "ACTIVE" },
        tx,
      );
      await this.organizationsRepository.createUserIdentity(
        { userId: user.id, provider: "LOCAL", providerSubject: request.email, passwordHash },
        tx,
      );
      await this.organizationsRepository.createUserProfile(
        { userId: user.id, displayName: request.displayName },
        tx,
      );

      const { row: verificationToken, rawToken: emailVerificationRawToken } =
        await this.emailVerificationRepository.createToken(user.id, "EMAIL_VERIFICATION", tx);

      const createdMember = await this.organizationsRepository.createOrganizationMember(
        {
          organizationId,
          userId: user.id,
          role: "MEMBER",
          status: "PENDING_APPROVAL",
        },
        tx,
      );

      await this.auditService.write(
        {
          actorUserId: user.id,
          scopeOrganizationId: organizationId,
          requestId,
          action: "organization_member.join_request",
          entityType: "organization_member",
          entityId: createdMember.id,
          afterData: createdMember,
        },
        tx,
      );

      await this.outboxService.append(
        "organization_member",
        createdMember.id,
        {
          type: "OrganizationJoinRequested",
          organizationId,
          memberId: createdMember.id,
          requestingUserId: user.id,
        },
        tx,
      );
      await this.outboxService.append(
        "user_account",
        user.id,
        {
          type: "EmailVerificationRequested",
          userId: user.id,
          email: request.email,
          token: emailVerificationRawToken,
          expiresAt: verificationToken.expiresAt.toISOString(),
        },
        tx,
      );

      return { member: createdMember, user };
    });

    return toMemberResponse(member.member, { primaryEmail: member.user.primaryEmail, profile: { displayName: request.displayName } });
  }

  async listMembers(actor: ActorContext, organizationId: string): Promise<OrganizationMemberResponse[]> {
    assertOrgOwnerOrAdmin(actor, organizationId);
    const rows = await this.organizationsRepository.listMembers(organizationId);
    return rows.map((row) => toMemberResponse(row, row.user));
  }

  async listPendingMemberships(actor: ActorContext): Promise<PendingMembershipResponse[]> {
    const rows = await this.organizationsRepository.listPendingMembershipsForUser(actor.userId);
    return rows.map((row) => ({
      organizationId: row.organizationId,
      organizationName: row.organization.name,
      status: row.status,
    }));
  }

  async updateMember(
    actor: ActorContext,
    organizationId: string,
    memberId: string,
    request: UpdateMemberRequest,
    requestId: string | null,
  ): Promise<OrganizationMemberResponse> {
    assertOrgOwnerOrAdmin(actor, organizationId);
    const member = await this.organizationsRepository.findMemberById(organizationId, memberId);
    if (!member) {
      throw new NotFoundError(ErrorCode.ORG_MEMBER_NOT_FOUND, "Membership not found.");
    }

    assertNotRemovingLastActiveOwner(member, request.status, request.role);

    const updated = await this.organizationsRepository.updateOrganizationMember(memberId, {
      role: request.role,
      status: request.status,
      leftAt: request.status === "LEFT" ? new Date() : member.leftAt,
    });

    await this.auditService.write({
      actorUserId: actor.userId,
      scopeOrganizationId: organizationId,
      requestId,
      action: "organization_member.update",
      entityType: "organization_member",
      entityId: memberId,
      beforeData: member,
      afterData: updated,
    });
    if (request.role && request.role !== member.role) {
      await this.outboxService.append("organization_member", memberId, {
        type: "OrganizationMemberRoleChanged",
        organizationId,
        memberId,
        previousRole: member.role,
        newRole: request.role,
        changedByUserId: actor.userId,
      });
    }
    if (member.status === "PENDING_APPROVAL" && request.status) {
      await this.outboxService.append("organization_member", memberId, {
        type: "OrganizationJoinRequestDecided",
        organizationId,
        memberId,
        userId: member.userId,
        decision: request.status === "ACTIVE" ? "APPROVED" : "REJECTED",
      });
    }

    const withUser = await this.organizationsRepository.findMemberWithUserById(organizationId, memberId);
    return toMemberResponse(updated, withUser?.user);
  }
}
