import type { PublicAuthorProfileResponse, PublicOrganizationProfileResponse, PublicResourceSummaryResponse } from "@r2m/contracts";
import { ErrorCode, NotFoundError } from "@r2m/domain";
import { Injectable } from "@nestjs/common";
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
  constructor(private readonly repository: PublicProfilesRepository) {}

  async getAuthorProfile(slug: string): Promise<PublicAuthorProfileResponse> {
    const author = await this.repository.findVerifiedAuthorBySlug(slug);
    if (!author) {
      throw new NotFoundError(ErrorCode.PUBLIC_PROFILE_NOT_FOUND, "Author profile not found.");
    }
    const userProfile = await this.repository.findUserProfile(author.userId);
    if (!userProfile) {
      throw new Error(`author_profile ${author.userId} has no user_profile — data integrity violation.`);
    }
    const resources = await this.repository.listPublicResourcesByAuthor(author.userId);

    return {
      displayName: userProfile.displayName,
      publicSlug: author.publicSlug!,
      affiliationOrganizationName: author.currentAffiliationOrg?.name ?? null,
      affiliationOrganizationSlug: author.currentAffiliationOrg?.slug ?? null,
      expertiseTags: author.expertiseTags ?? [],
      orcid: author.orcid,
      bio: author.bio,
      resources: resources.map(toResourceSummary),
    };
  }

  async getOrganizationProfile(slug: string): Promise<PublicOrganizationProfileResponse> {
    const companyProfile = await this.repository.findCompanyProfileBySlug(slug);
    const org = companyProfile
      ? await this.repository.findOrganizationById(companyProfile.organizationId)
      : await this.repository.findOrganizationBySlug(slug);

    if (!org || org.status !== "ACTIVE") {
      throw new NotFoundError(ErrorCode.PUBLIC_PROFILE_NOT_FOUND, "Organization profile not found.");
    }

    const [authorRows, resources] = await Promise.all([
      this.repository.listVerifiedAuthorsByOrganization(org.id),
      this.repository.listPublicResourcesByOrganization(org.id),
    ]);

    return {
      name: org.name,
      slug: org.slug,
      description: companyProfile?.description ?? org.description,
      authors: authorRows
        .filter((row) => row.userProfile)
        .map((row) => ({ displayName: row.userProfile!.displayName, publicSlug: row.profile.publicSlug })),
      resources: resources.map(toResourceSummary),
    };
  }
}
