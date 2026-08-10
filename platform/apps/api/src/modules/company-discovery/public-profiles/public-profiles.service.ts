import type { PublicAuthorProfileResponse, PublicOrganizationProfileResponse, PublicResourceSummaryResponse } from "@r2m/contracts";
import { ErrorCode, NotFoundError } from "@r2m/domain";
import { Injectable } from "@nestjs/common";
import { FollowsService } from "../../community/follows/follows.service";
import { PublicProfilesRepository } from "./public-profiles.repository";

function toResourceSummary(resource: {
  id: string;
  title: string;
  type: string;
  description: string | null;
  paperMetadata: { abstract: string | null } | null;
}): PublicResourceSummaryResponse {
  return {
    id: resource.id,
    title: resource.title,
    type: resource.type,
    summary: (resource.type === "PAPER" ? resource.paperMetadata?.abstract : resource.description) ?? null,
  };
}

/** UC public author/organization profile pages (Sprint 5.7, §3 items 26-28). No
 * `ActorContext` — these endpoints are `@Public()`, and per the invariant in §5, they
 * behave identically regardless of who's asking (an actor with a `resource_access_grant`
 * still only sees `PUBLIC` resources here — this is not a permissioned endpoint). */
@Injectable()
export class PublicProfilesService {
  constructor(
    private readonly repository: PublicProfilesRepository,
    private readonly followsService: FollowsService,
  ) {}

  async getAuthorProfile(slug: string): Promise<PublicAuthorProfileResponse> {
    const author = await this.repository.findVerifiedAuthorBySlug(slug);
    if (!author) {
      throw new NotFoundError(ErrorCode.PUBLIC_PROFILE_NOT_FOUND, "Author profile not found.");
    }
    const userProfile = await this.repository.findUserProfile(author.userId);
    if (!userProfile) {
      throw new Error(`author_profile ${author.userId} has no user_profile — data integrity violation.`);
    }
    const [resources, followerCount] = await Promise.all([
      this.repository.listPublicResourcesByAuthor(author.userId),
      this.followsService.countAuthorFollowers(author.userId),
    ]);

    return {
      displayName: userProfile.displayName,
      publicSlug: author.publicSlug!,
      affiliationOrganizationName: author.currentAffiliationOrg?.name ?? null,
      affiliationOrganizationSlug: author.currentAffiliationOrg?.slug ?? null,
      expertiseTags: author.expertiseTags ?? [],
      orcid: author.orcid,
      bio: author.bio,
      resources: resources.map(toResourceSummary),
      followerCount,
    };
  }

  /** Shared by `getOrganizationProfile` and `resolveOrganizationIdBySlug` (used by follow
   * actions) — `companyProfile.publicSlug` takes priority over `organization.slug`, same
   * resolution order either way so a follow always targets whatever org the public-profile
   * page under that slug actually renders. */
  private async findActiveOrganizationBySlug(slug: string) {
    const companyProfile = await this.repository.findCompanyProfileBySlug(slug);
    const org = companyProfile
      ? await this.repository.findOrganizationById(companyProfile.organizationId)
      : await this.repository.findOrganizationBySlug(slug);

    if (!org || org.status !== "ACTIVE") {
      throw new NotFoundError(ErrorCode.PUBLIC_PROFILE_NOT_FOUND, "Organization profile not found.");
    }
    return { org, companyProfile };
  }

  async getOrganizationProfile(slug: string): Promise<PublicOrganizationProfileResponse> {
    const { org, companyProfile } = await this.findActiveOrganizationBySlug(slug);

    const [authorRows, resources, followerCount] = await Promise.all([
      this.repository.listVerifiedAuthorsByOrganization(org.id),
      this.repository.listPublicResourcesByOrganization(org.id),
      this.followsService.countOrganizationFollowers(org.id),
    ]);

    return {
      name: org.name,
      slug: org.slug,
      description: companyProfile?.description ?? org.description,
      authors: authorRows
        .filter((row) => row.userProfile)
        .map((row) => ({ displayName: row.userProfile!.displayName, publicSlug: row.profile.publicSlug })),
      resources: resources.map(toResourceSummary),
      followerCount,
    };
  }

  /** Đợt 3 — resolves the slug an authenticated follow action targets. Not used by
   * `getAuthorProfile` above (that needs the full row, not just the id), only by
   * `FollowActionsService`. */
  async resolveAuthorUserIdBySlug(slug: string): Promise<string> {
    const author = await this.repository.findVerifiedAuthorBySlug(slug);
    if (!author) {
      throw new NotFoundError(ErrorCode.PUBLIC_PROFILE_NOT_FOUND, "Author profile not found.");
    }
    return author.userId;
  }

  async resolveOrganizationIdBySlug(slug: string): Promise<string> {
    const { org } = await this.findActiveOrganizationBySlug(slug);
    return org.id;
  }
}
