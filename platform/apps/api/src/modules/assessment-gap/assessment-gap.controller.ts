import type {
  AssessmentDecisionRequest,
  AssessmentScoreResponse,
  CreateAssessmentRequest,
  CreateGapRequest,
  GapResponse,
  ReadinessAssessmentResponse,
  TransitionGapRequest,
  UpdateGapRequest,
  UpsertAssessmentScoreRequest,
} from "@r2m/contracts";
import {
  AssessmentDecisionRequestSchema,
  CreateAssessmentRequestSchema,
  CreateGapRequestSchema,
  TransitionGapRequestSchema,
  UpdateGapRequestSchema,
  UpsertAssessmentScoreRequestSchema,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Get, Param, Patch, Post, Put, Req, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AssessmentService } from "./assessment.service";
import { GapService } from "./gap.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

/** Route lồng dưới `/technology-cases/:id/...` cho Assessment & Gap — path riêng khỏi
 * `TechnologyCasesController` (Phase 3) theo đúng tách bounded context (plan PHẦN D
 * mục D.8), NestJS cho phép nhiều controller class dùng chung tiền tố `@Controller`
 * miễn sub-path không trùng nhau. */
@Controller("technology-cases")
export class AssessmentGapCaseController {
  constructor(
    private readonly assessmentService: AssessmentService,
    private readonly gapService: GapService,
  ) {}

  @Post(":id/assessments")
  @UsePipes(new ZodValidationPipe(CreateAssessmentRequestSchema))
  createAssessment(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: CreateAssessmentRequest,
    @Req() req: Request,
  ): Promise<ReadinessAssessmentResponse> {
    return this.assessmentService.create(actor, id, body, requestId(req));
  }

  @Get(":id/assessments")
  listAssessments(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
  ): Promise<ReadinessAssessmentResponse[]> {
    return this.assessmentService.listByCase(actor, id);
  }

  @Post(":id/gaps")
  @UsePipes(new ZodValidationPipe(CreateGapRequestSchema))
  createGap(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: CreateGapRequest,
    @Req() req: Request,
  ): Promise<GapResponse> {
    return this.gapService.create(actor, id, body, requestId(req));
  }

  @Get(":id/gaps")
  listGaps(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<GapResponse[]> {
    return this.gapService.listByCase(actor, id);
  }
}

@Controller("assessments")
export class AssessmentsController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Get(":id")
  getById(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<ReadinessAssessmentResponse> {
    return this.assessmentService.getById(actor, id);
  }

  @Put(":id/scores/:criterionId")
  @UsePipes(new ZodValidationPipe(UpsertAssessmentScoreRequestSchema))
  upsertScore(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Param("criterionId") criterionId: string,
    @Body() body: UpsertAssessmentScoreRequest,
    @Req() req: Request,
  ): Promise<AssessmentScoreResponse> {
    return this.assessmentService.upsertScore(actor, id, criterionId, body, requestId(req));
  }

  @Get(":id/scores")
  listScores(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<AssessmentScoreResponse[]> {
    return this.assessmentService.listScores(actor, id);
  }

  @Post(":id/submit")
  submit(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Req() req: Request,
  ): Promise<ReadinessAssessmentResponse> {
    return this.assessmentService.submit(actor, id, requestId(req));
  }

  @Post(":id/decision")
  @UsePipes(new ZodValidationPipe(AssessmentDecisionRequestSchema))
  decide(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: AssessmentDecisionRequest,
    @Req() req: Request,
  ): Promise<ReadinessAssessmentResponse> {
    return this.assessmentService.decide(actor, id, body, requestId(req));
  }
}

@Controller("gaps")
export class GapsController {
  constructor(private readonly gapService: GapService) {}

  @Get(":id")
  getById(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<GapResponse> {
    return this.gapService.getById(actor, id);
  }

  @Patch(":id")
  @UsePipes(new ZodValidationPipe(UpdateGapRequestSchema))
  update(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: UpdateGapRequest,
    @Req() req: Request,
  ): Promise<GapResponse> {
    return this.gapService.update(actor, id, body, requestId(req));
  }

  @Post(":id/transition")
  @UsePipes(new ZodValidationPipe(TransitionGapRequestSchema))
  transition(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: TransitionGapRequest,
    @Req() req: Request,
  ): Promise<GapResponse> {
    return this.gapService.transition(actor, id, body, requestId(req));
  }
}
