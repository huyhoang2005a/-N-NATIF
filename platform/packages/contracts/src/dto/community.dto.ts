import type { ResearchNeedResponse } from "./company-discovery.dto";
import type { ResourceResponse } from "./resource.dto";

/** `GET /me/saved` — bookmarks span both `resource` and `research_need`, merged into one
 * time-ordered list (đợt 2, Cộng đồng). Discriminated on `type` since the two payloads
 * carry different response shapes; `savedAt` is the bookmark's own timestamp so the list
 * can stay sorted newest-first regardless of when the underlying item was created. */
export type SavedItemResponse =
  | { type: "RESOURCE"; savedAt: string; resource: ResourceResponse }
  | { type: "RESEARCH_NEED"; savedAt: string; researchNeed: ResearchNeedResponse };

/** `POST/DELETE /authors/:slug/follow` and `/organizations/:slug/follow` (đợt 3, Cộng
 * đồng) — returns the new state directly so the frontend doesn't need a second round-trip
 * to refresh the count after toggling. */
export interface FollowActionResponse {
  followed: boolean;
  followerCount: number;
}

/** Who a feed item is shown as posted "by" — an author, an organization, or both (a
 * resource can be attributed through either the followed-author or followed-org
 * relationship). Names/slugs are denormalized here (not just IDs) so the card can render
 * a byline + avatar without a second round-trip per item. `avatarUrl` is a fresh presigned
 * URL (same resolve-on-read pattern as `MeResponse.avatarUrl`), null when there's no
 * author attribution or the author has no avatar set. */
export interface ActivityFeedAttribution {
  authorName: string | null;
  authorSlug: string | null;
  avatarUrl: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
}

/** `GET /activity-feed` (đợt 4, Cộng đồng) — resources/needs from authors & organizations
 * the actor follows, merged into one time-ordered list. Same discriminated-union shape as
 * `SavedItemResponse`; `occurredAt` is the resource's `createdAt` or the need's
 * `publishedAt` (whichever marks "this became visible to followers"), not a separate
 * feed-event timestamp — there's no event log, this is computed fresh on every read.
 * `attribution` and `summary` were added for the card-per-post feed layout — `summary` is
 * the resource's own `description` for RESOURCE items (already on `ResourceResponse`) or
 * the need's latest version `problemStatement` for RESEARCH_NEED items (not otherwise on
 * `ResearchNeedResponse`, which is why it's denormalized onto the feed item instead). */
export type ActivityFeedItemResponse =
  | { type: "RESOURCE"; occurredAt: string; attribution: ActivityFeedAttribution; summary: string | null; resource: ResourceResponse }
  | { type: "RESEARCH_NEED"; occurredAt: string; attribution: ActivityFeedAttribution; summary: string | null; researchNeed: ResearchNeedResponse };
