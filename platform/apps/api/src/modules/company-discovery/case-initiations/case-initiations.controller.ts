import type { CaseInitiationRequestResponse, CreateCaseInitiationRequest, DeclineCaseInitiationRequest } from "@r2m/contracts";
import { CreateCaseInitiationRequestSchema, DeclineCaseInitiationRequestSchema } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Get, Param, Post, Req, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { withIdempotencyKey } from "../../../common/idempotency/with-idempotency-key.util";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { IdempotencyService } from "../../platform-operations/jobs/idempotency.service";
import { CaseInitiationsService } from "./case-initiations.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

@Controller("recommendation-items/:id/case-initiation-requests")
export class RecommendationItemCaseInitiationsController {
  constructor(
    private readonly service: CaseInitiationsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(CreateCaseInitiationRequestSchema))
  create(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: CreateCaseInitiationRequest,
    @Req() req: Request,
  ): Promise<CaseInitiationRequestResponse> {
    return withIdempotencyKey(this.idempotencyService, actor.userId, req, body, 201, () =>
      this.service.create(actor, id, body, requestId(req)),
    );
  }
}

@Controller("case-initiation-requests")
export class CaseInitiationRequestsController {
  constructor(private readonly service: CaseInitiationsService) {}

  /** Requests received as the target author — no route param, scoped to the actor. */
  @Get()
  listReceived(@CurrentActor() actor: ActorContext): Promise<CaseInitiationRequestResponse[]> {
    return this.service.listReceived(actor);
  }

  @Post(":id/accept")
  accept(@CurrentActor() actor: ActorContext, @Param("id") id: string, @Req() req: Request): Promise<CaseInitiationRequestResponse> {
    return this.service.accept(actor, id, requestId(req));
  }

  @Post(":id/decline")
  @UsePipes(new ZodValidationPipe(DeclineCaseInitiationRequestSchema))
  decline(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: DeclineCaseInitiationRequest,
    @Req() req: Request,
  ): Promise<CaseInitiationRequestResponse> {
    return this.service.decline(actor, id, body, requestId(req));
  }
}

@Controller("organizations/:id/case-initiation-requests")
export class OrganizationCaseInitiationsController {
  constructor(private readonly service: CaseInitiationsService) {}

  /** Requests sent by this org (as the requesting company) — convenience list, not in
   * the spec's endpoint table but same precedent as every other "my own X" GET added
   * this phase (company-profile, research-needs). */
  @Get()
  listSent(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<CaseInitiationRequestResponse[]> {
    return this.service.listSent(actor, id);
  }
}
