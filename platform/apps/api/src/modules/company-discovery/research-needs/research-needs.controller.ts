import type {
  CreateNeedStatementVersionRequest,
  CreateResearchNeedRequest,
  NeedStatementVersionResponse,
  ResearchNeedDetailResponse,
  ResearchNeedResponse,
  TechnicalFieldSummaryResponse,
} from "@r2m/contracts";
import { CreateNeedStatementVersionRequestSchema, CreateResearchNeedRequestSchema } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Delete, Get, Param, Post, Query, Req, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import type { ResearchNeedListSort } from "./research-needs.service";
import { ResearchNeedsService } from "./research-needs.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

@Controller("research-needs")
export class ResearchNeedsController {
  constructor(private readonly service: ResearchNeedsService) {}

  @Get()
  listPublic(
    @CurrentActor() actor: ActorContext,
    @Query("sort") sort?: ResearchNeedListSort,
    @Query("field") field?: string,
  ): Promise<ResearchNeedResponse[]> {
    return this.service.listPublic(actor, sort, field);
  }

  /** Cộng đồng đợt 7 — duyệt theo lĩnh vực kỹ thuật. Route "fields" phải khai báo TRƯỚC
   * `:id` bên dưới — Nest khớp route theo thứ tự khai báo, nếu để sau thì "fields" sẽ bị
   * `:id` "nuốt" mất, gọi `getById(actor, "fields")` thay vì route này. */
  @Get("fields")
  listTechnicalFields(): Promise<TechnicalFieldSummaryResponse[]> {
    return this.service.listTechnicalFields();
  }

  @Get(":id")
  getById(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<ResearchNeedDetailResponse> {
    return this.service.getById(actor, id);
  }

  /** Cộng đồng đợt 1 — upvote, không downvote. Idempotent. */
  @Post(":id/votes")
  vote(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<ResearchNeedResponse> {
    return this.service.vote(actor, id);
  }

  @Delete(":id/votes")
  unvote(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<ResearchNeedResponse> {
    return this.service.unvote(actor, id);
  }

  /** Cộng đồng đợt 2 — bookmark, cùng nguyên tắc idempotent như vote ở trên. */
  @Post(":id/saves")
  save(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<ResearchNeedResponse> {
    return this.service.save(actor, id);
  }

  @Delete(":id/saves")
  unsave(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<ResearchNeedResponse> {
    return this.service.unsave(actor, id);
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
  listForOrganization(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Query("sort") sort?: ResearchNeedListSort,
  ): Promise<ResearchNeedResponse[]> {
    return this.service.listForOrganization(actor, id, sort);
  }
}
