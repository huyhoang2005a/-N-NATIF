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
