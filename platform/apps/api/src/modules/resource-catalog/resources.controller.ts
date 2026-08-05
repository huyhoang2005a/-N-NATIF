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
import { Body, Controller, Get, Param, Post, Query, Req, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AnnotationsService } from "./annotations.service";
import { ResourceAccessGrantsService } from "./resource-access-grants.service";
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

  /** SUC-05 (ĐỀ XUẤT — CẦN REVIEW, xem plan B.0.1): `?q=` full-text search, không tạo
   * path `/resources/search` riêng vì §13.2 chỉ liệt kê `GET /resources`. */
  @Get()
  list(@CurrentActor() actor: ActorContext, @Query("q") q?: string): Promise<ResourceResponse[]> {
    return this.resourcesService.list(actor, q);
  }

  @Get(":id")
  getById(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<ResourceResponse> {
    return this.resourcesService.getById(actor, id);
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

  /** SUC-04 (ĐỀ XUẤT — CẦN REVIEW, xem plan B.0.1): tên endpoint theo đúng §13.2
   * (`access-requests`), nhưng tạo `resource_access_grant` ACTIVE ngay — không có
   * bảng/state PENDING trong schema đã khoá. */
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

  /** Path tự đặt, không có trong catalogue §13.2 (xem plan B.0.1). */
  @Get(":id/access-grants")
  listAccessGrants(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
  ): Promise<ResourceAccessGrantResponse[]> {
    return this.accessGrantsService.listByResource(actor, id);
  }
}

@Controller("access-grants")
export class ResourceAccessGrantsController {
  constructor(private readonly accessGrantsService: ResourceAccessGrantsService) {}

  /** Path tự đặt, không có trong catalogue §13.2 (xem plan B.0.1). */
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
}
