import type { ActivityFeedItemResponse } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Controller, Get } from "@nestjs/common";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { ActivityFeedService } from "./activity-feed.service";

@Controller("activity-feed")
export class ActivityFeedController {
  constructor(private readonly service: ActivityFeedService) {}

  @Get()
  getFeed(@CurrentActor() actor: ActorContext): Promise<ActivityFeedItemResponse[]> {
    return this.service.getFeed(actor);
  }
}
