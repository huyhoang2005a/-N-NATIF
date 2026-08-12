import type {
  InviteMemberRequest,
  JoinOrganizationRequest,
  OrganizationMemberResponse,
  OrganizationResponse,
  RegisterOrganizationWithDocumentRequest,
  UpdateMemberRequest,
} from "@r2m/contracts";
import {
  InviteMemberRequestSchema,
  JoinOrganizationRequestSchema,
  MAX_DOCUMENT_SIZE_BYTES,
  RegisterOrganizationWithDocumentSchema,
  UpdateMemberRequestSchema,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
  UsePipes,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { toDocumentUpload } from "../../../common/multipart/document-upload.util";
import { Public } from "../../../common/decorators/public.decorator";
import { parsePageLimit, parsePageOffset } from "../../../common/pagination/parse-page-params.util";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { OrganizationsService } from "./organizations.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /** Multipart on purpose — the mandatory minimum verification document is submitted in
   * the same call as registration, not a separate post-registration step. */
  @Public()
  @Post("register")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES } }))
  @UsePipes(new ZodValidationPipe(RegisterOrganizationWithDocumentSchema))
  register(
    @Body() body: RegisterOrganizationWithDocumentRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ): Promise<OrganizationResponse> {
    return this.organizationsService.register(body, toDocumentUpload(file, body.documentType), requestId(req));
  }

  /** Self-service join request for an organization already registered under the
   * requester's email domain — no invite token, membership starts PENDING_APPROVAL. */
  @Public()
  @Post(":id/join-requests")
  @UsePipes(new ZodValidationPipe(JoinOrganizationRequestSchema))
  joinRequest(
    @Param("id") id: string,
    @Body() body: JoinOrganizationRequest,
    @Req() req: Request,
  ): Promise<OrganizationMemberResponse> {
    return this.organizationsService.joinRequest(id, body, requestId(req));
  }

  @Get()
  listMine(@CurrentActor() actor: ActorContext): Promise<OrganizationResponse[]> {
    return this.organizationsService.listMine(actor);
  }

  @Get(":id")
  getById(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
  ): Promise<OrganizationResponse> {
    return this.organizationsService.getById(actor, id);
  }

  @Get(":id/members")
  listMembers(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
  ): Promise<OrganizationMemberResponse[]> {
    return this.organizationsService.listMembers(actor, id);
  }

  @Post(":id/members/invitations")
  @UsePipes(new ZodValidationPipe(InviteMemberRequestSchema))
  inviteMember(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: InviteMemberRequest,
    @Req() req: Request,
  ): Promise<OrganizationMemberResponse> {
    return this.organizationsService.inviteMember(actor, id, body, requestId(req));
  }

  @Patch(":id/members/:memberId")
  @UsePipes(new ZodValidationPipe(UpdateMemberRequestSchema))
  updateMember(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Param("memberId") memberId: string,
    @Body() body: UpdateMemberRequest,
    @Req() req: Request,
  ): Promise<OrganizationMemberResponse> {
    return this.organizationsService.updateMember(actor, id, memberId, body, requestId(req));
  }
}

/** Not spec-mandated — explicit user-approved addition, see organizations.service.ts. */
@Controller("platform/organizations")
export class PlatformOrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  listAll(
    @CurrentActor() actor: ActorContext,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ): Promise<OrganizationResponse[]> {
    return this.organizationsService.listAllForPlatform(actor, parsePageLimit(limit), parsePageOffset(offset));
  }
}
