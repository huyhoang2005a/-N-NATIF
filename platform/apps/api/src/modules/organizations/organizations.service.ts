import type {
  InviteMemberRequest,
  OrganizationMemberResponse,
  OrganizationResponse,
  RegisterOrganizationRequest,
  UpdateMemberRequest,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertOrgOwnerOrAdmin } from "@r2m/authz";
import type { Database } from "@r2m/db";
import { ConflictError, ErrorCode, ForbiddenError, NotFoundError } from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { DATABASE } from "../../database/database.module";
import type { AuditService } from "../audit/audit.service";
import type { OutboxService } from "../jobs/outbox.service";
import { assertNotRemovingLastActiveOwner } from "./organizations.policy";
import type { OrganizationsRepository } from "./organizations.repository";
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

function toMemberResponse(member: {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  status: string;
  invitedAt: Date | null;
  joinedAt: Date | null;
}): OrganizationMemberResponse {
  return {
    id: member.id,
    organizationId: member.organizationId,
    userId: member.userId,
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
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async register(
    request: RegisterOrganizationRequest,
    requestId: string | null,
  ): Promise<OrganizationResponse> {
    const slug = slugify(request.organizationName);

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

        const createdOrg = await this.organizationsRepository.createOrganization(
          {
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
          { organizationId: createdOrg.id, domain: emailDomain(request.ownerEmail), isPrimary: true },
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
        // new organization always goes through manual review — see packages/db README.
        const verificationRequest = await this.organizationsRepository.createVerificationRequest(
          { organizationId: createdOrg.id, submittedByUserId: owner.id, status: "PENDING" },
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

    return toMemberResponse(member);
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

    return toMemberResponse(updated);
  }
}
