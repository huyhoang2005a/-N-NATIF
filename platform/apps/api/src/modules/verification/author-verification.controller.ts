import type {
  AuthorVerificationRequestResponse,
  AuthorVerificationUploadResponse,
  RequestAuthorVerificationUploadRequest,
  SubmitAuthorVerificationRequest,
} from "@r2m/contracts";
import {
  RequestAuthorVerificationUploadSchema,
  SubmitAuthorVerificationRequestSchema,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Post, Req, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthorVerificationService } from "./author-verification.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

@Controller("author-verifications")
export class AuthorVerificationController {
  constructor(private readonly authorVerificationService: AuthorVerificationService) {}

  @Post("uploads")
  @UsePipes(new ZodValidationPipe(RequestAuthorVerificationUploadSchema))
  requestUpload(
    @CurrentActor() actor: ActorContext,
    @Body() body: RequestAuthorVerificationUploadRequest,
  ): Promise<AuthorVerificationUploadResponse> {
    return this.authorVerificationService.requestUpload(actor, body);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(SubmitAuthorVerificationRequestSchema))
  submit(
    @CurrentActor() actor: ActorContext,
    @Body() body: SubmitAuthorVerificationRequest,
    @Req() req: Request,
  ): Promise<AuthorVerificationRequestResponse> {
    return this.authorVerificationService.submit(actor, body, requestId(req));
  }
}
