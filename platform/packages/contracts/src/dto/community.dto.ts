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

/** `GET /activity-feed` (đợt 4, Cộng đồng) — resources/needs from authors & organizations
 * the actor follows, merged into one time-ordered list. Same discriminated-union shape as
 * `SavedItemResponse`; `occurredAt` is the resource's `createdAt` or the need's
 * `publishedAt` (whichever marks "this became visible to followers"), not a separate
 * feed-event timestamp — there's no event log, this is computed fresh on every read. */
export type ActivityFeedItemResponse =
  | { type: "RESOURCE"; occurredAt: string; resource: ResourceResponse }
  | { type: "RESEARCH_NEED"; occurredAt: string; researchNeed: ResearchNeedResponse };
