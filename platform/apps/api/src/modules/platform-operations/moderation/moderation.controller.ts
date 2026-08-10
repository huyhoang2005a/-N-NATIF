import type {
  ContentFlagResponse,
  CreateContentFlagRequest,
  CreateModerationDecisionRequest,
  ModerationDecisionResponse,
} from "@r2m/contracts";
import { CreateContentFlagRequestSchema, CreateModerationDecisionRequestSchema } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Get, Param, Post, Req, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { ModerationService } from "./moderation.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

@Controller("content-flags")
export class ContentFlagsController {
  constructor(private readonly service: ModerationService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(CreateContentFlagRequestSchema))
  create(@CurrentActor() actor: ActorContext, @Body() body: CreateContentFlagRequest, @Req() req: Request): Promise<ContentFlagResponse> {
    return this.service.create(actor, body, requestId(req));
  }
}

@Controller("platform/content-flags")
export class PlatformContentFlagsController {
  constructor(private readonly service: ModerationService) {}

  @Get()
  listQueue(@CurrentActor() actor: ActorContext): Promise<ContentFlagResponse[]> {
    return this.service.listQueue(actor);
  }

  @Post(":id/claim")
  claim(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<ContentFlagResponse> {
    return this.service.claim(actor, id);
  }

  @Post(":id/decision")
  @UsePipes(new ZodValidationPipe(CreateModerationDecisionRequestSchema))
  decide(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: CreateModerationDecisionRequest,
    @Req() req: Request,
  ): Promise<ModerationDecisionResponse> {
    return this.service.decide(actor, id, body, requestId(req));
  }
}
