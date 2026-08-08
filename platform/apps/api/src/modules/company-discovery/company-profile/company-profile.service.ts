import type { CompanyProfileResponse, CreateCompanyProfileRequest, UpdateCompanyProfileRequest } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertActiveMember, assertOrgOwnerOrAdmin } from "@r2m/authz";
import type { Database } from "@r2m/database";
import { ConflictError, ErrorCode, NotFoundError } from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../../database/database.module";
import { AuditService } from "../../platform-operations/audit/audit.service";
import { OrganizationsRepository } from "../../identity-organization/organizations/organizations.repository";
import { slugify } from "../../identity-organization/organizations/slug.util";
import { CompanyProfileRepository } from "./company-profile.repository";

function toResponse(profile: {
  organizationId: string;
  publicSlug: string;
  industryCode: string | null;
  companySize: string | null;
  description: string | null;
  contactUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CompanyProfileResponse {
  return {
    organizationId: profile.organizationId,
    publicSlug: profile.publicSlug,
    industryCode: profile.industryCode,
    companySize: profile.companySize,
    description: profile.description,
    contactUserId: profile.contactUserId,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

/** UC-CMP-01. Bounded context: Company & Discovery. */
@Injectable()
export class CompanyProfileService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly repository: CompanyProfileRepository,
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly auditService: AuditService,
  ) {}

  private async assertEnterpriseActive(organizationId: string): Promise<void> {
    const org = await this.organizationsRepository.findById(organizationId);
    if (!org) {
      throw new NotFoundError(ErrorCode.ORG_NOT_FOUND, "Organization not found.");
    }
    if (org.type !== "ENTERPRISE") {
      throw new ConflictError(
        ErrorCode.DISCOVERY_ORG_NOT_ENTERPRISE,
        "Only an ENTERPRISE organization may have a company profile.",
      );
    }
    if (org.status !== "ACTIVE") {
      throw new ConflictError(ErrorCode.ORG_NOT_ACTIVE, "Organization must be ACTIVE.");
    }
  }

  /** Auto-generated, never user-chosen — appends `-2`, `-3`... on collision, same
   * defensive pattern the spec calls for on `author_profile.public_slug`. */
  private async generateUniqueSlug(organizationName: string): Promise<string> {
    const base = slugify(organizationName) || "company";
    let candidate = base;
    let suffix = 2;
    while (await this.repository.findBySlug(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  async getProfile(actor: ActorContext, organizationId: string): Promise<CompanyProfileResponse> {
    assertActiveMember(actor, organizationId);
    const profile = await this.repository.findByOrganizationId(organizationId);
    if (!profile) {
      throw new NotFoundError(
        ErrorCode.DISCOVERY_COMPANY_PROFILE_NOT_FOUND,
        "This organization has no company profile yet.",
      );
    }
    return toResponse(profile);
  }

  async createProfile(
    actor: ActorContext,
    organizationId: string,
    request: CreateCompanyProfileRequest,
    requestIdHeader: string | null,
  ): Promise<CompanyProfileResponse> {
    assertOrgOwnerOrAdmin(actor, organizationId);
    const org = await this.organizationsRepository.findById(organizationId);
    await this.assertEnterpriseActive(organizationId);

    const existing = await this.repository.findByOrganizationId(organizationId);
    if (existing) {
      throw new ConflictError(
        ErrorCode.DISCOVERY_COMPANY_PROFILE_ALREADY_EXISTS,
        "This organization already has a company profile.",
      );
    }

    const publicSlug = await this.generateUniqueSlug(org!.name);
    const created = await this.db.transaction(async (tx) => {
      const row = await this.repository.create(
        {
          organizationId,
          publicSlug,
          industryCode: request.industryCode ?? null,
          companySize: request.companySize ?? null,
          description: request.description ?? null,
          contactUserId: actor.userId,
        },
        tx,
      );
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: organizationId,
          requestId: requestIdHeader,
          action: "company_profile.create",
          entityType: "company_profile",
          entityId: organizationId,
          afterData: row,
        },
        tx,
      );
      return row;
    });
    return toResponse(created);
  }

  async updateProfile(
    actor: ActorContext,
    organizationId: string,
    request: UpdateCompanyProfileRequest,
    requestIdHeader: string | null,
  ): Promise<CompanyProfileResponse> {
    assertOrgOwnerOrAdmin(actor, organizationId);
    await this.assertEnterpriseActive(organizationId);

    const existing = await this.repository.findByOrganizationId(organizationId);
    if (!existing) {
      throw new NotFoundError(
        ErrorCode.DISCOVERY_COMPANY_PROFILE_NOT_FOUND,
        "This organization has no company profile yet.",
      );
    }

    const updated = await this.db.transaction(async (tx) => {
      const row = await this.repository.update(
        organizationId,
        {
          industryCode: request.industryCode ?? existing.industryCode,
          companySize: request.companySize ?? existing.companySize,
          description: request.description ?? existing.description,
        },
        tx,
      );
      await this.auditService.write(
        {
          actorUserId: actor.userId,
          scopeOrganizationId: organizationId,
          requestId: requestIdHeader,
          action: "company_profile.update",
          entityType: "company_profile",
          entityId: organizationId,
          beforeData: existing,
          afterData: row,
        },
        tx,
      );
      return row;
    });
    return toResponse(updated!);
  }
}
