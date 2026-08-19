import type {
  AnnotationResponse,
  CreateAnnotationRequest,
  CreateResourceAccessRequest,
  CreateResourceVersionRequest,
  RegisterResourceRequest,
  RequestResourceUploadRequest,
  ResourceAccessGrantResponse,
  ResourceResponse,
  ResourceUploadResponse,
  ResourceVersionResponse,
} from "@r2m/contracts";
import {
  CreateAnnotationRequestSchema,
  CreateResourceAccessRequestSchema,
  CreateResourceVersionRequestSchema,
  RegisterResourceRequestSchema,
  RequestResourceUploadSchema,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Req, UseGuards, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AnnotationsService } from "./annotations.service";
import { ResourceAccessGrantsService } from "./resource-access-grants.service";
import type { ResourceListSort } from "./resources.service";
import { ResourcesService } from "./resources.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

@Controller("resources")
export class ResourcesController {
  constructor(
    private readonly resourcesService: ResourcesService,
    private readonly accessGrantsService: ResourceAccessGrantsService,
  ) {}

  @UseGuards(RateLimitGuard)
  @RateLimit({ keyPrefix: "resource-upload", points: 20, durationSeconds: 60 })
  @Post("uploads")
  @UsePipes(new ZodValidationPipe(RequestResourceUploadSchema))
  requestUpload(
    @CurrentActor() actor: ActorContext,
    @Body() body: RequestResourceUploadRequest,
  ): Promise<ResourceUploadResponse> {
    return this.resourcesService.requestUpload(actor, body);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(RegisterResourceRequestSchema))
  register(
    @CurrentActor() actor: ActorContext,
    @Body() body: RegisterResourceRequest,
    @Req() req: Request,
  ): Promise<ResourceResponse> {
    return this.resourcesService.register(actor, body, requestId(req));
  }

  /** SUC-05 (đã chốt sau review, 2026-08-05): `?q=` full-text search, không tạo path
   * `/resources/search` riêng vì §13.2 chỉ liệt kê `GET /resources`. Vector/semantic
   * search trì hoãn tới khi có embedding stack thật (Phase 5) — xác nhận không làm ở
   * Phase 2. */
  @Get()
  list(
    @CurrentActor() actor: ActorContext,
    @Query("q") q?: string,
    @Query("sort") sort?: ResourceListSort,
  ): Promise<ResourceResponse[]> {
    return this.resourcesService.list(actor, q, sort);
  }

  @Get(":id")
  getById(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<ResourceResponse> {
    return this.resourcesService.getById(actor, id);
  }

  /** Not spec-mandated — explicit user-approved addition, see resources.service.ts#remove.
   * Narrowly-scoped hard delete: creator-only, DRAFT-only, zero-dependents-only. */
  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentActor() actor: ActorContext, @Param("id") id: string, @Req() req: Request): Promise<void> {
    return this.resourcesService.remove(actor, id, requestId(req));
  }

  /** Cộng đồng đợt 1 — upvote, không downvote (đã chốt cùng người dùng). Idempotent: vote
   * lại khi đã vote / unvote khi chưa vote đều không lỗi. */
  @Post(":id/votes")
  vote(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<ResourceResponse> {
    return this.resourcesService.vote(actor, id);
  }

  @Delete(":id/votes")
  unvote(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<ResourceResponse> {
    return this.resourcesService.unvote(actor, id);
  }

  /** Cộng đồng đợt 2 — bookmark, cùng nguyên tắc idempotent như vote ở trên. */
  @Post(":id/saves")
  save(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<ResourceResponse> {
    return this.resourcesService.save(actor, id);
  }

  @Delete(":id/saves")
  unsave(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<ResourceResponse> {
    return this.resourcesService.unsave(actor, id);
  }

  @Post(":id/versions")
  @UsePipes(new ZodValidationPipe(CreateResourceVersionRequestSchema))
  createVersion(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: CreateResourceVersionRequest,
    @Req() req: Request,
  ): Promise<ResourceVersionResponse> {
    return this.resourcesService.createVersion(actor, id, body, requestId(req));
  }

  /** SUC-04 (đã chốt sau review, 2026-08-05): tên endpoint theo đúng §13.2
   * (`access-requests`), nhưng tạo `resource_access_grant` ACTIVE ngay — không có
   * bảng/state PENDING trong schema đã khoá. "Request" trong tên use case là hành động
   * resource-manager cấp quyền trực tiếp, không phải entity có vòng đời riêng. */
  @Post(":id/access-requests")
  @UsePipes(new ZodValidationPipe(CreateResourceAccessRequestSchema))
  createAccessGrant(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: CreateResourceAccessRequest,
    @Req() req: Request,
  ): Promise<ResourceAccessGrantResponse> {
    return this.accessGrantsService.create(actor, id, body, requestId(req));
  }

  /** Path tự đặt, không có trong catalogue §13.2 — đã chốt sau review (2026-08-05). */
  @Get(":id/access-grants")
  listAccessGrants(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
  ): Promise<ResourceAccessGrantResponse[]> {
    return this.accessGrantsService.listByResource(actor, id);
  }

  /** Not spec-mandated — explicit user-approved addition, see resources.service.ts. */
  @Get(":id/versions")
  listVersions(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
  ): Promise<ResourceVersionResponse[]> {
    return this.resourcesService.listVersions(actor, id);
  }
}

@Controller("access-grants")
export class ResourceAccessGrantsController {
  constructor(private readonly accessGrantsService: ResourceAccessGrantsService) {}

  /** Path tự đặt, không có trong catalogue §13.2. Đã chốt sau review (2026-08-05): giữ
   * `POST .../revoke` — khớp cách đặt tên action (submit/approve/publish) đã dùng ở các
   * use case khác, dùng nhất quán cho mọi endpoint tự đặt về sau. */
  @Post(":id/revoke")
  revoke(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<ResourceAccessGrantResponse> {
    return this.accessGrantsService.revoke(actor, id, requestId(req));
  }
}

@Controller("resource-versions")
export class ResourceVersionsController {
  constructor(
    private readonly resourcesService: ResourcesService,
    private readonly annotationsService: AnnotationsService,
  ) {}

  @Post(":id/publish")
  publish(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<ResourceVersionResponse> {
    return this.resourcesService.publishVersion(actor, id, requestId(req));
  }

  @Post(":id/annotations")
  @UsePipes(new ZodValidationPipe(CreateAnnotationRequestSchema))
  createAnnotation(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: CreateAnnotationRequest,
    @Req() req: Request,
  ): Promise<AnnotationResponse> {
    return this.annotationsService.create(actor, id, body, requestId(req));
  }

  /** Not spec-mandated — explicit user-approved addition, see annotations.service.ts. */
  @Get(":id/annotations")
  listAnnotations(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<AnnotationResponse[]> {
    return this.annotationsService.listByVersion(actor, id);
  }
}
