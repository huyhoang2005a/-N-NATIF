import type { AuthorVerificationDecisionRequest, AuthorVerificationRequestResponse } from "@r2m/contracts";
import { AuthorVerificationDecisionRequestSchema } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Get, Param, Post, Req, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthorVerificationService } from "./author-verification.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

@Controller("platform/author-verifications")
export class PlatformAuthorVerificationController {
  constructor(private readonly authorVerificationService: AuthorVerificationService) {}

  @Get()
  listPending(@CurrentActor() actor: ActorContext): Promise<AuthorVerificationRequestResponse[]> {
    return this.authorVerificationService.listPending(actor);
  }

  @Post(":id/claim")
  claim(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
  ): Promise<AuthorVerificationRequestResponse> {
    return this.authorVerificationService.claim(actor, id);
  }

  /** Path chosen to fit the reviewer's document-review step (UC-VER-02) — not listed
   * explicitly in R2M_SPEC_DESIGN_V5_COMPLETE.md §13.2, self-defined like the resource
   * access-grant revoke/list endpoints (see plan B.0.1). */
  @Get(":id/document-url")
  getDocumentUrl(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
  ): Promise<{ url: string; expiresIn: number }> {
    return this.authorVerificationService.getDocumentDownloadUrl(actor, id);
  }

  @Post(":id/decision")
  @UsePipes(new ZodValidationPipe(AuthorVerificationDecisionRequestSchema))
  decide(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: AuthorVerificationDecisionRequest,
    @Req() req: Request,
  ): Promise<AuthorVerificationRequestResponse> {
    return this.authorVerificationService.decide(actor, id, body, requestId(req));
  }
}
