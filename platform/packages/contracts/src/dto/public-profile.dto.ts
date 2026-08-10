/** Sprint 5.7 (§3 items 26-28) — public, unauthenticated author/organization profile
 * pages. Deliberately narrow: no case/evidence/assessment data, only `PUBLIC`
 * resources, only `VERIFIED` authors — see `06_phase5_full_design.md` §5 invariants. */

export interface PublicResourceSummaryResponse {
  id: string;
  title: string;
  type: string;
  summary: string | null;
}

/** Community đợt 6 — `expertiseTags` was `string[]` before this batch; `endorsementCount`
 * is plain/actor-independent (safe here), `endorsedByMe` is NOT included (same
 * actor-blindness split as `votedByMe`/`followedByMe` — see `GET /me/endorsements/
 * authors/:slug` instead). */
export interface ExpertiseTagResponse {
  tag: string;
  endorsementCount: number;
}

export interface PublicAuthorProfileResponse {
  displayName: string;
  publicSlug: string;
  affiliationOrganizationName: string | null;
  affiliationOrganizationSlug: string | null;
  expertiseTags: ExpertiseTagResponse[];
  orcid: string | null;
  bio: string | null;
  resources: PublicResourceSummaryResponse[];
  /** Community đợt 3 — plain count, actor-independent, safe on this `@Public()` response
   * (unlike `followedByMe`, which is actor-specific and deliberately NOT here — see
   * `GET /me/follows/authors/:slug` instead, same actor-blindness rule as `votedByMe`). */
  followerCount: number;
  /** Community đợt 5 — điểm ghi nhận tác giả. 2 con số minh bạch, riêng biệt (đã chốt:
   * KHÔNG gộp thành 1 "điểm karma" mập mờ/bịa công thức). `totalUpvotesReceived` = tổng
   * upvote trên các resource PUBLIC của tác giả; `acceptedProposalCount` = số đề xuất
   * nghiên cứu (research_proposal) của tác giả đã được doanh nghiệp chấp nhận. */
  totalUpvotesReceived: number;
  acceptedProposalCount: number;
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

/** `POST/DELETE /authors/:slug/expertise/:tag/endorsements` (đợt 6) — mirrors
 * `FollowActionResponse`: returns the new state directly, no second round-trip needed. */
export interface EndorseActionResponse {
  tag: string;
  endorsed: boolean;
  endorsementCount: number;
}

/** `GET /me/endorsements/authors/:slug` — every tag of this author the actor has already
 * endorsed, in one call instead of one per tag (same actor-blindness split as
 * `FollowStatusResponse` above). */
export interface MyEndorsementsResponse {
  endorsedTags: string[];
}
