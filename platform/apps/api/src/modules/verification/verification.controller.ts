import type { OrganizationVerificationDecisionRequest, OrganizationVerificationRequestResponse } from "@r2m/contracts";
import { OrganizationVerificationDecisionRequestSchema } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Get, Param, Post, Req, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
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

@Controller("organizations")
export class OrganizationVerificationRequestController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post(":id/verification-requests")
  resubmit(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
  ): Promise<OrganizationVerificationRequestResponse> {
    return this.verificationService.resubmit(actor, id);
  }
}
