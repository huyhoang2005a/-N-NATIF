import type {
  AddTransferManifestItemRequest,
  AddTransferRecipientRequest,
  CreateTransferManifestRequest,
  ShareTransferManifestRequest,
  TransferManifestDetailResponse,
  TransferManifestItemResponse,
  TransferManifestResponse,
  TransferRecipientResponse,
} from "@r2m/contracts";
import {
  AddTransferManifestItemRequestSchema,
  AddTransferRecipientRequestSchema,
  CreateTransferManifestRequestSchema,
  ShareTransferManifestRequestSchema,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Get, Param, Post, Req, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { TransferManifestService } from "./transfer.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

/** Path tự đặt ngoài catalogue §13.2 (`GET .../transfer-manifests`) — cùng tiền lệ
 * `RoadmapCaseController` (Phase 4). */
@Controller("technology-cases")
export class TransferManifestCaseController {
  constructor(private readonly service: TransferManifestService) {}

  @Post(":id/transfer-manifests")
  @UsePipes(new ZodValidationPipe(CreateTransferManifestRequestSchema))
  create(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: CreateTransferManifestRequest,
    @Req() req: Request,
  ): Promise<TransferManifestResponse> {
    return this.service.create(actor, id, body, requestId(req));
  }

  @Get(":id/transfer-manifests")
  listByCase(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<TransferManifestResponse[]> {
    return this.service.listByCase(actor, id);
  }
}

@Controller("transfer-manifests")
export class TransferManifestsController {
  constructor(private readonly service: TransferManifestService) {}

  @Get(":id")
  getById(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<TransferManifestDetailResponse> {
    return this.service.getById(actor, id);
  }

  @Post(":id/items")
  @UsePipes(new ZodValidationPipe(AddTransferManifestItemRequestSchema))
  addItem(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: AddTransferManifestItemRequest,
  ): Promise<TransferManifestItemResponse> {
    return this.service.addItem(actor, id, body);
  }

  @Post(":id/recipients")
  @UsePipes(new ZodValidationPipe(AddTransferRecipientRequestSchema))
  addRecipient(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: AddTransferRecipientRequest,
  ): Promise<TransferRecipientResponse> {
    return this.service.addRecipient(actor, id, body);
  }

  @Post(":id/share")
  @UsePipes(new ZodValidationPipe(ShareTransferManifestRequestSchema))
  share(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: ShareTransferManifestRequest,
    @Req() req: Request,
  ): Promise<TransferManifestResponse> {
    return this.service.share(actor, id, body, requestId(req));
  }

  @Post(":id/revoke")
  revoke(@CurrentActor() actor: ActorContext, @Param("id") id: string, @Req() req: Request): Promise<TransferManifestResponse> {
    return this.service.revoke(actor, id, requestId(req));
  }
}
