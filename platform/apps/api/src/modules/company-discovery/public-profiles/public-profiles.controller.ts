import type {
  FollowActionResponse,
  FollowStatusResponse,
  PublicAuthorProfileResponse,
  PublicOrganizationProfileResponse,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { FollowActionsService } from "./follow-actions.service";
import { PublicProfilesService } from "./public-profiles.service";

@Controller("authors")
export class PublicAuthorProfileController {
  constructor(
    private readonly service: PublicProfilesService,
    private readonly followActions: FollowActionsService,
  ) {}

  @Public()
  @Get(":slug/public-profile")
  getProfile(@Param("slug") slug: string): Promise<PublicAuthorProfileResponse> {
    return this.service.getAuthorProfile(slug);
  }

  /** Cộng đồng đợt 3 — follow, KHÔNG @Public(): actor-specific, tách biệt hoàn toàn khỏi
   * `GET :slug/public-profile` ở trên để giữ đúng bất biến "public profile giống nhau cho
   * mọi người" (đã chốt Sprint 5.7). Idempotent như vote/save. */
  @Post(":slug/follow")
  follow(@CurrentActor() actor: ActorContext, @Param("slug") slug: string): Promise<FollowActionResponse> {
    return this.followActions.followAuthor(actor, slug);
  }

  @Delete(":slug/follow")
  unfollow(@CurrentActor() actor: ActorContext, @Param("slug") slug: string): Promise<FollowActionResponse> {
    return this.followActions.unfollowAuthor(actor, slug);
  }
}

@Controller("organizations")
export class PublicOrganizationProfileController {
  constructor(
    private readonly service: PublicProfilesService,
    private readonly followActions: FollowActionsService,
  ) {}

  @Public()
  @Get(":slug/public-profile")
  getProfile(@Param("slug") slug: string): Promise<PublicOrganizationProfileResponse> {
    return this.service.getOrganizationProfile(slug);
  }

  @Post(":slug/follow")
  follow(@CurrentActor() actor: ActorContext, @Param("slug") slug: string): Promise<FollowActionResponse> {
    return this.followActions.followOrganization(actor, slug);
  }

  @Delete(":slug/follow")
  unfollow(@CurrentActor() actor: ActorContext, @Param("slug") slug: string): Promise<FollowActionResponse> {
    return this.followActions.unfollowOrganization(actor, slug);
  }
}

/** `GET /me/follows/...` — actor tự hỏi "tôi có đang follow cái này chưa" khi xem trang
 * public-profile, cùng nguyên tắc tách biệt khỏi endpoint `@Public()` như `votedByMe`/
 * `savedByMe` ở đợt 1/2. */
@Controller("me/follows")
export class MeFollowsController {
  constructor(private readonly followActions: FollowActionsService) {}

  @Get("authors/:slug")
  authorStatus(@CurrentActor() actor: ActorContext, @Param("slug") slug: string): Promise<FollowStatusResponse> {
    return this.followActions.authorFollowStatus(actor, slug);
  }

  @Get("organizations/:slug")
  organizationStatus(@CurrentActor() actor: ActorContext, @Param("slug") slug: string): Promise<FollowStatusResponse> {
    return this.followActions.organizationFollowStatus(actor, slug);
  }
}
