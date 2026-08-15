import type {
  CreateDependencyRequest,
  CreateMilestoneRequest,
  CreateRoadmapRequest,
  CreateRoadmapReviewRequest,
  CreateTaskRequest,
  GapResponse,
  LinkMilestoneGapRequest,
  MilestoneDependencyResponse,
  RoadmapMilestoneResponse,
  RoadmapResponse,
  RoadmapReviewResponse,
  RoadmapSuggestion,
  RoadmapTaskResponse,
} from "@r2m/contracts";
import {
  CreateDependencyRequestSchema,
  CreateMilestoneRequestSchema,
  CreateRoadmapRequestSchema,
  CreateRoadmapReviewRequestSchema,
  CreateTaskRequestSchema,
  LinkMilestoneGapRequestSchema,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Get, Param, Post, Req, UseGuards, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RoadmapService } from "./roadmap.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

/** Path tự đặt ngoài catalogue §13.2 (`GET .../roadmaps`) — đúng tiền lệ Phase 3
 * (catalogue không liệt kê hết read endpoint). */
@Controller("technology-cases")
export class RoadmapCaseController {
  constructor(private readonly roadmapService: RoadmapService) {}

  @Post(":id/roadmaps")
  @UsePipes(new ZodValidationPipe(CreateRoadmapRequestSchema))
  create(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: CreateRoadmapRequest,
    @Req() req: Request,
  ): Promise<RoadmapResponse> {
    return this.roadmapService.create(actor, id, body, requestId(req));
  }

  @Get(":id/roadmaps")
  listByCase(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<RoadmapResponse[]> {
    return this.roadmapService.listByCase(actor, id);
  }

  /** AI-copilot draft (2026-08) — returns a suggestion only, never writes. */
  @UseGuards(RateLimitGuard)
  @RateLimit({ keyPrefix: "roadmap-suggestions", points: 10, durationSeconds: 60 })
  @Post(":id/roadmaps/suggestions")
  suggestRoadmap(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<RoadmapSuggestion> {
    return this.roadmapService.suggestDraft(actor, id);
  }
}

@Controller("roadmaps")
export class RoadmapsController {
  constructor(private readonly roadmapService: RoadmapService) {}

  @Get(":id")
  getById(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<RoadmapResponse> {
    return this.roadmapService.getById(actor, id);
  }

  @Post(":id/milestones")
  @UsePipes(new ZodValidationPipe(CreateMilestoneRequestSchema))
  createMilestone(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: CreateMilestoneRequest,
    @Req() req: Request,
  ): Promise<RoadmapMilestoneResponse> {
    return this.roadmapService.createMilestone(actor, id, body, requestId(req));
  }

  /** Path tự đặt ngoài catalogue §13.2 (read). */
  @Get(":id/milestones")
  listMilestones(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
  ): Promise<RoadmapMilestoneResponse[]> {
    return this.roadmapService.listMilestones(actor, id);
  }

  @Post(":id/dependencies")
  @UsePipes(new ZodValidationPipe(CreateDependencyRequestSchema))
  createDependency(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: CreateDependencyRequest,
    @Req() req: Request,
  ): Promise<MilestoneDependencyResponse> {
    return this.roadmapService.createDependency(actor, id, body, requestId(req));
  }

  /** Path tự đặt ngoài catalogue §13.2 (read). */
  @Get(":id/dependencies")
  listDependencies(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
  ): Promise<MilestoneDependencyResponse[]> {
    return this.roadmapService.listDependencies(actor, id);
  }

  @Post(":id/submit")
  submit(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<RoadmapResponse> {
    return this.roadmapService.submit(actor, id, requestId(req));
  }

  @Post(":id/reviews")
  @UsePipes(new ZodValidationPipe(CreateRoadmapReviewRequestSchema))
  review(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: CreateRoadmapReviewRequest,
    @Req() req: Request,
  ): Promise<RoadmapResponse> {
    return this.roadmapService.review(actor, id, body, requestId(req));
  }

  /** Path tự đặt ngoài catalogue §13.2 (read). */
  @Get(":id/reviews")
  listReviews(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
  ): Promise<RoadmapReviewResponse[]> {
    return this.roadmapService.listReviews(actor, id);
  }
}

/** Path tự đặt ngoài catalogue §13.2 — breakdown Sprint 4.4 mục 14/15 yêu cầu task +
 * milestone_gap nhưng §13.2 không liệt kê endpoint riêng (xem plan PHẦN D quyết định 8). */
@Controller("milestones")
export class MilestonesController {
  constructor(private readonly roadmapService: RoadmapService) {}

  @Post(":id/tasks")
  @UsePipes(new ZodValidationPipe(CreateTaskRequestSchema))
  createTask(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: CreateTaskRequest,
    @Req() req: Request,
  ): Promise<RoadmapTaskResponse> {
    return this.roadmapService.createTask(actor, id, body, requestId(req));
  }

  /** Path tự đặt ngoài catalogue §13.2 (read). */
  @Get(":id/tasks")
  listTasks(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<RoadmapTaskResponse[]> {
    return this.roadmapService.listMilestoneTasks(actor, id);
  }

  @Post(":id/gaps")
  @UsePipes(new ZodValidationPipe(LinkMilestoneGapRequestSchema))
  linkGap(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: LinkMilestoneGapRequest,
    @Req() req: Request,
  ): Promise<void> {
    return this.roadmapService.linkMilestoneGap(actor, id, body, requestId(req));
  }

  /** Path tự đặt ngoài catalogue §13.2 (read). */
  @Get(":id/gaps")
  listGaps(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<GapResponse[]> {
    return this.roadmapService.listMilestoneGaps(actor, id);
  }
}
