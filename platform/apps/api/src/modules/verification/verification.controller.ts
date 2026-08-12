import type {
  OrganizationVerificationDecisionRequest,
  OrganizationVerificationDocumentResponse,
  OrganizationVerificationRequestResponse,
  SetVerificationDocumentRetentionRequest,
  SubmitOrganizationVerificationDocumentRequest,
  VerificationDocumentRetentionResponse,
} from "@r2m/contracts";
import {
  MAX_DOCUMENT_SIZE_BYTES,
  OrganizationVerificationDecisionRequestSchema,
  SetVerificationDocumentRetentionRequestSchema,
  SubmitOrganizationVerificationDocumentSchema,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
  UsePipes,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { toDocumentUpload } from "../../common/multipart/document-upload.util";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { VerificationService } from "./verification.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

@Controller("platform/organization-verifications")
export class PlatformOrganizationVerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get()
  listPending(@CurrentActor() actor: ActorContext): Promise<OrganizationVerificationRequestResponse[]> {
    return this.verificationService.listPending(actor);
  }

  @Get(":id/documents")
  listDocuments(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
  ): Promise<OrganizationVerificationDocumentResponse[]> {
    return this.verificationService.listDocuments(actor, id);
  }

  @Post(":id/claim")
  claim(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
  ): Promise<OrganizationVerificationRequestResponse> {
    return this.verificationService.claim(actor, id);
  }

  @Post(":id/decision")
  @UsePipes(new ZodValidationPipe(OrganizationVerificationDecisionRequestSchema))
  decide(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: OrganizationVerificationDecisionRequest,
    @Req() req: Request,
  ): Promise<OrganizationVerificationRequestResponse> {
    return this.verificationService.decide(actor, id, body, requestId(req));
  }
}

/** Phase 7 Sprint 7.4 — `verification_document` is shared between org and author
 * verification, so this lives at its own top-level path rather than nested under either. */
@Controller("platform/verification-documents")
export class PlatformVerificationDocumentController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post(":id/retention")
  @UsePipes(new ZodValidationPipe(SetVerificationDocumentRetentionRequestSchema))
  async setRetention(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: SetVerificationDocumentRetentionRequest,
    @Req() req: Request,
  ): Promise<VerificationDocumentRetentionResponse> {
    const result = await this.verificationService.setDocumentRetention(actor, id, new Date(body.retentionUntil), requestId(req));
    return { id: result.id, retentionUntil: result.retentionUntil.toISOString() };
  }
}

@Controller("organizations")
export class OrganizationVerificationRequestController {
  constructor(private readonly verificationService: VerificationService) {}

  /** Multipart on purpose (create request + upload the minimum-required document in one
   * call, no separate presign step) — see mục 1 of the "vá lỗ hổng xác minh" plan. */
  @Post(":id/verification-requests")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES } }))
  @UsePipes(new ZodValidationPipe(SubmitOrganizationVerificationDocumentSchema))
  resubmit(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: SubmitOrganizationVerificationDocumentRequest,
    @Req() req: Request,
  ): Promise<OrganizationVerificationRequestResponse> {
    return this.verificationService.resubmit(actor, id, toDocumentUpload(file, body.documentType), requestId(req));
  }

  /** Attaches a document to the org's currently open request — needed because the first
   * request is created implicitly by org registration with zero documents (see plan). */
  @Post(":id/verification-requests/documents")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES } }))
  @UsePipes(new ZodValidationPipe(SubmitOrganizationVerificationDocumentSchema))
  attachDocument(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: SubmitOrganizationVerificationDocumentRequest,
    @Req() req: Request,
  ): Promise<OrganizationVerificationRequestResponse> {
    return this.verificationService.attachDocument(actor, id, toDocumentUpload(file, body.documentType), requestId(req));
  }
}
