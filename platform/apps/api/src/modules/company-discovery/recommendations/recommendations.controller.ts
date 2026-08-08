import type { RecommendationItemResponse, RecommendationRunResponse } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { RecommendationsService } from "./recommendations.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

@Controller("research-needs/:id/recommendation-runs")
export class ResearchNeedRecommendationRunsController {
  constructor(private readonly service: RecommendationsService) {}

  @Post()
  create(@CurrentActor() actor: ActorContext, @Param("id") id: string, @Req() req: Request): Promise<RecommendationRunResponse> {
    return this.service.createFocusedRun(actor, id, requestId(req));
  }
}

@Controller("recommendation-runs")
export class RecommendationRunsController {
  constructor(private readonly service: RecommendationsService) {}

  @Get(":id")
  getRun(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<RecommendationRunResponse> {
    return this.service.getRun(actor, id);
  }

  @Get(":id/items")
  listItems(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<RecommendationItemResponse[]> {
    return this.service.listItems(actor, id);
  }
}

@Controller("organizations/:id/company-profile/feed")
export class CompanyProfileFeedController {
  constructor(private readonly service: RecommendationsService) {}

  @Get()
  getFeed(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<RecommendationItemResponse[]> {
    return this.service.getFeed(actor, id);
  }

  @Post("refresh")
  refresh(@CurrentActor() actor: ActorContext, @Param("id") id: string, @Req() req: Request): Promise<RecommendationRunResponse> {
    return this.service.createFeedRun(actor, id, requestId(req));
  }
}

@Controller("recommendation-items")
export class RecommendationItemsController {
  constructor(private readonly service: RecommendationsService) {}

  @Post(":id/dismiss")
  dismiss(@CurrentActor() actor: ActorContext, @Param("id") id: string, @Req() req: Request): Promise<RecommendationItemResponse> {
    return this.service.dismissItem(actor, id, requestId(req));
  }
}
