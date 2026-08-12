import type { CreateResearchProposalRequest, RejectResearchProposalRequest, ResearchProposalResponse } from "@r2m/contracts";
import { CreateResearchProposalRequestSchema, RejectResearchProposalRequestSchema } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Get, Param, Post, Req, UseGuards, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { RateLimit } from "../../../common/decorators/rate-limit.decorator";
import { RateLimitGuard } from "../../../common/guards/rate-limit.guard";
import { withIdempotencyKey } from "../../../common/idempotency/with-idempotency-key.util";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { IdempotencyService } from "../../platform-operations/jobs/idempotency.service";
import { ProposalsService } from "./proposals.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

@Controller("research-needs/:id/proposals")
export class ResearchNeedProposalsController {
  constructor(
    private readonly service: ProposalsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Get()
  listForNeed(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<ResearchProposalResponse[]> {
    return this.service.listForNeed(actor, id);
  }

  @UseGuards(RateLimitGuard)
  @RateLimit({ keyPrefix: "proposal-submit", points: 10, durationSeconds: 60 })
  @Post()
  @UsePipes(new ZodValidationPipe(CreateResearchProposalRequestSchema))
  create(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: CreateResearchProposalRequest,
    @Req() req: Request,
  ): Promise<ResearchProposalResponse> {
    return withIdempotencyKey(this.idempotencyService, actor.userId, req, body, 201, () =>
      this.service.create(actor, id, body, requestId(req)),
    );
  }
}

@Controller("proposals")
export class ProposalsController {
  constructor(private readonly service: ProposalsService) {}

  @Get()
  listMine(@CurrentActor() actor: ActorContext): Promise<ResearchProposalResponse[]> {
    return this.service.listMine(actor);
  }

  @Post(":id/review")
  review(@CurrentActor() actor: ActorContext, @Param("id") id: string, @Req() req: Request): Promise<ResearchProposalResponse> {
    return this.service.review(actor, id, requestId(req));
  }

  @Post(":id/accept")
  accept(@CurrentActor() actor: ActorContext, @Param("id") id: string, @Req() req: Request): Promise<ResearchProposalResponse> {
    return this.service.accept(actor, id, requestId(req));
  }

  @Post(":id/reject")
  @UsePipes(new ZodValidationPipe(RejectResearchProposalRequestSchema))
  reject(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: RejectResearchProposalRequest,
    @Req() req: Request,
  ): Promise<ResearchProposalResponse> {
    return this.service.reject(actor, id, body, requestId(req));
  }

  @Post(":id/withdraw")
  withdraw(@CurrentActor() actor: ActorContext, @Param("id") id: string, @Req() req: Request): Promise<ResearchProposalResponse> {
    return this.service.withdraw(actor, id, requestId(req));
  }
}
