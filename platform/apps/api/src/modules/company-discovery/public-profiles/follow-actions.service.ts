import type { FollowActionResponse, FollowStatusResponse } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Injectable } from "@nestjs/common";
import { FollowsService } from "../../community/follows/follows.service";
import { OutboxService } from "../../platform-operations/jobs/outbox.service";
import { PublicProfilesService } from "./public-profiles.service";

/** Community đợt 3 — follow. Deliberately separate from `PublicProfilesService`: that
 * service is `@Public()`-only reads (no `ActorContext`, identical output for everyone —
 * see its file comment); these methods are authenticated mutations/actor-specific reads,
 * mixing them in would blur that invariant. Resolves slug → userId/organizationId via
 * `PublicProfilesService` (same lookup the public-profile page itself uses, so a follow
 * always targets whatever that page renders under the slug), then writes through
 * `CommunityModule`'s target-agnostic `FollowsService`. Only fires the outbox event on a
 * genuinely NEW follow (`FollowsService.followAuthor/followOrganization` return whether a
 * row was inserted) — re-following an already-followed author/org is a no-op, not a
 * second notification. */
@Injectable()
export class FollowActionsService {
  constructor(
    private readonly profiles: PublicProfilesService,
    private readonly followsService: FollowsService,
    private readonly outboxService: OutboxService,
  ) {}

  async followAuthor(actor: ActorContext, slug: string): Promise<FollowActionResponse> {
    const authorUserId = await this.profiles.resolveAuthorUserIdBySlug(slug);
    const created = await this.followsService.followAuthor(actor.userId, authorUserId);
    if (created) {
      await this.outboxService.append("author_follow", authorUserId, {
        type: "AuthorFollowed",
        followerUserId: actor.userId,
        followedAuthorUserId: authorUserId,
      });
    }
    const followerCount = await this.followsService.countAuthorFollowers(authorUserId);
    return { followed: true, followerCount };
  }

  async unfollowAuthor(actor: ActorContext, slug: string): Promise<FollowActionResponse> {
    const authorUserId = await this.profiles.resolveAuthorUserIdBySlug(slug);
    await this.followsService.unfollowAuthor(actor.userId, authorUserId);
    const followerCount = await this.followsService.countAuthorFollowers(authorUserId);
    return { followed: false, followerCount };
  }

  async authorFollowStatus(actor: ActorContext, slug: string): Promise<FollowStatusResponse> {
    const authorUserId = await this.profiles.resolveAuthorUserIdBySlug(slug);
    const followed = await this.followsService.isFollowingAuthor(actor.userId, authorUserId);
    return { followed };
  }

  async followOrganization(actor: ActorContext, slug: string): Promise<FollowActionResponse> {
    const organizationId = await this.profiles.resolveOrganizationIdBySlug(slug);
    const created = await this.followsService.followOrganization(actor.userId, organizationId);
    if (created) {
      await this.outboxService.append("organization_follow", organizationId, {
        type: "OrganizationFollowed",
        followerUserId: actor.userId,
        followedOrganizationId: organizationId,
      });
    }
    const followerCount = await this.followsService.countOrganizationFollowers(organizationId);
    return { followed: true, followerCount };
  }

  async unfollowOrganization(actor: ActorContext, slug: string): Promise<FollowActionResponse> {
    const organizationId = await this.profiles.resolveOrganizationIdBySlug(slug);
    await this.followsService.unfollowOrganization(actor.userId, organizationId);
    const followerCount = await this.followsService.countOrganizationFollowers(organizationId);
    return { followed: false, followerCount };
  }

  async organizationFollowStatus(actor: ActorContext, slug: string): Promise<FollowStatusResponse> {
    const organizationId = await this.profiles.resolveOrganizationIdBySlug(slug);
    const followed = await this.followsService.isFollowingOrganization(actor.userId, organizationId);
    return { followed };
  }
}
