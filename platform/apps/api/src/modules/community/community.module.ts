import { Module } from "@nestjs/common";
import { FollowsRepository } from "./follows/follows.repository";
import { FollowsService } from "./follows/follows.service";
import { SavesRepository } from "./saves/saves.repository";
import { SavesService } from "./saves/saves.service";
import { VotesRepository } from "./votes/votes.repository";
import { VotesService } from "./votes/votes.service";

/** Community & networking layer (Reddit-style discovery + LinkedIn-style network) — new
 * bounded context, not part of the locked spec (explicitly authorized by the user, same
 * category as the earlier self-service join-organization feature). Built in small batches;
 * đợt 1 (upvote) + đợt 2 (save/bookmark) + đợt 3 (follow) so far.
 *
 * No controllers of its own for the toggle actions: the vote/save mutation routes
 * (`POST/DELETE .../votes`, `.../saves`) live on the EXISTING `ResourcesController`/
 * `ResearchNeedsController`, and the follow routes on `PublicAuthorProfileController`/
 * `PublicOrganizationProfileController`, instead of a dedicated controller here —
 * specifically to avoid a circular module dependency: those controllers need
 * `ResourcesService`/`ResearchNeedsService`/`PublicProfilesService` to build the response
 * after toggling, and if `CommunityModule` also depended on `ResourceCatalogModule`/
 * `CompanyDiscoveryModule` for that, we'd have a cycle. Established precedent in this
 * codebase is to restructure around cycles rather than use `forwardRef()` (see
 * `organizations.service.ts`'s duplicated `createVerificationDocument` for the same
 * reason). `VotesRepository`/`VotesService`/`SavesRepository`/`SavesService`/
 * `FollowsRepository`/`FollowsService` only need DB access, so the dependency runs
 * one-way: `ResourceCatalogModule`/`CompanyDiscoveryModule` import `CommunityModule`,
 * never the reverse.
 *
 * Follow's `@Public()` invariant note: the follow/unfollow/`followerCount` machinery here
 * is actor-independent DB access — the actor-blindness rule (public-profile GET must
 * return identical data regardless of who's asking) is enforced at the controller/service
 * layer in `company-discovery`, not here; see `public-profiles.service.ts`.
 *
 * `GET /me/saved` (which DOES span both `resource` and `research_need`, unlike the
 * per-target toggle routes) lives on a small aggregator controller inside
 * `CompanyDiscoveryModule` instead — that module already imports `ResourceCatalogModule`'s
 * exported `ResourcesService` with no cycle (`ResourceCatalogModule` doesn't depend back on
 * `CompanyDiscoveryModule`), and already has `ResearchNeedsService` as a local provider. */
@Module({
  providers: [VotesRepository, VotesService, SavesRepository, SavesService, FollowsRepository, FollowsService],
  exports: [VotesRepository, VotesService, SavesRepository, SavesService, FollowsRepository, FollowsService],
})
export class CommunityModule {}
