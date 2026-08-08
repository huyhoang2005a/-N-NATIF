import type {
  CreateNeedStatementVersionRequest,
  CreateResearchNeedRequest,
  NeedStatementVersionResponse,
  ResearchNeedDetailResponse,
  ResearchNeedResponse,
} from "@r2m/contracts";
import { CreateNeedStatementVersionRequestSchema, CreateResearchNeedRequestSchema } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Get, Param, Post, Req, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { ResearchNeedsService } from "./research-needs.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

@Controller("research-needs")
export class ResearchNeedsController {
  constructor(private readonly service: ResearchNeedsService) {}

  @Get()
  listPublic(): Promise<ResearchNeedResponse[]> {
    return this.service.listPublic();
  }

  @Get(":id")
  getById(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<ResearchNeedDetailResponse> {
    return this.service.getById(actor, id);
  }

  @Get(":id/versions")
  listVersions(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<NeedStatementVersionResponse[]> {
    return this.service.listVersions(actor, id);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateResearchNeedRequestSchema))
  create(
    @CurrentActor() actor: ActorContext,
    @Body() body: CreateResearchNeedRequest,
    @Req() req: Request,
  ): Promise<ResearchNeedDetailResponse> {
    return this.service.create(actor, body, requestId(req));
  }

  @Post(":id/versions")
  @UsePipes(new ZodValidationPipe(CreateNeedStatementVersionRequestSchema))
  createVersion(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: CreateNeedStatementVersionRequest,
    @Req() req: Request,
  ): Promise<NeedStatementVersionResponse> {
    return this.service.createVersion(actor, id, body, requestId(req));
  }

  @Post(":id/publish")
  publish(@CurrentActor() actor: ActorContext, @Param("id") id: string, @Req() req: Request): Promise<ResearchNeedResponse> {
    return this.service.publish(actor, id, requestId(req));
  }

  @Post(":id/pause")
  pause(@CurrentActor() actor: ActorContext, @Param("id") id: string, @Req() req: Request): Promise<ResearchNeedResponse> {
    return this.service.pause(actor, id, requestId(req));
  }

  @Post(":id/resume")
  resume(@CurrentActor() actor: ActorContext, @Param("id") id: string, @Req() req: Request): Promise<ResearchNeedResponse> {
    return this.service.resume(actor, id, requestId(req));
  }

  @Post(":id/close")
  close(@CurrentActor() actor: ActorContext, @Param("id") id: string, @Req() req: Request): Promise<ResearchNeedResponse> {
    return this.service.close(actor, id, requestId(req));
  }
}

@Controller("organizations/:id/research-needs")
export class OrganizationResearchNeedsController {
  constructor(private readonly service: ResearchNeedsService) {}

  @Get()
  listForOrganization(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<ResearchNeedResponse[]> {
    return this.service.listForOrganization(actor, id);
  }
}
