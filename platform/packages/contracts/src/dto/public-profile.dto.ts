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
  /** Community đợt 3 — plain count, actor-independent, safe on this `@Public()` response
   * (unlike `followedByMe`, which is actor-specific and deliberately NOT here — see
   * `GET /me/follows/authors/:slug` instead, same actor-blindness rule as `votedByMe`). */
  followerCount: number;
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
  /** Community đợt 3 — see `PublicAuthorProfileResponse.followerCount`. */
  followerCount: number;
}

/** `GET /me/follows/authors/:slug` / `.../organizations/:slug` — actor-specific, so it
 * lives on its own authenticated endpoint rather than in the `@Public()` profile response
 * above (same split as `votedByMe`/`savedByMe` vs. the public listing endpoints). */
export interface FollowStatusResponse {
  followed: boolean;
}
