/** Sprint 5.7 (§3 items 26-28) — public, unauthenticated author/organization profile
 * pages. Deliberately narrow: no case/evidence/assessment data, only `PUBLIC`
 * resources, only `VERIFIED` authors — see `06_phase5_full_design.md` §5 invariants. */

export interface PublicResourceSummaryResponse {
  id: string;
  title: string;
  type: string;
  summary: string | null;
}

export interface PublicAuthorProfileResponse {
  displayName: string;
  publicSlug: string;
  affiliationOrganizationName: string | null;
  affiliationOrganizationSlug: string | null;
  expertiseTags: string[];
  orcid: string | null;
  bio: string | null;
  resources: PublicResourceSummaryResponse[];
}

export interface PublicOrganizationAuthorResponse {
  displayName: string;
  publicSlug: string | null;
}

export interface PublicOrganizationProfileResponse {
  name: string;
  slug: string;
  description: string | null;
  authors: PublicOrganizationAuthorResponse[];
  resources: PublicResourceSummaryResponse[];
}
