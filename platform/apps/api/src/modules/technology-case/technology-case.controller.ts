import type {
  AddCaseMemberRequest,
  AddCaseOrganizationRequest,
  CaseMemberResponse,
  CaseOrganizationResponse,
  CreateEvidenceRequest,
  EvidenceResponse,
  RegisterTechnologyCaseRequest,
  TechnologyCaseResponse,
  TransitionCaseRequest,
} from "@r2m/contracts";
import {
  AddCaseMemberRequestSchema,
  AddCaseOrganizationRequestSchema,
  CreateEvidenceRequestSchema,
  RegisterTechnologyCaseRequestSchema,
  TransitionCaseRequestSchema,
} from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Get, Param, Post, Req, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../common/decorators/current-actor.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { EvidenceService } from "./evidence.service";
import { TechnologyCaseService } from "./technology-case.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

@Controller("technology-cases")
export class TechnologyCasesController {
  constructor(
    private readonly technologyCaseService: TechnologyCaseService,
    private readonly evidenceService: EvidenceService,
  ) {}

  @Post()
  @UsePipes(new ZodValidationPipe(RegisterTechnologyCaseRequestSchema))
  register(
    @CurrentActor() actor: ActorContext,
    @Body() body: RegisterTechnologyCaseRequest,
    @Req() req: Request,
  ): Promise<TechnologyCaseResponse> {
    return this.technologyCaseService.register(actor, body, requestId(req));
  }

  @Get()
  list(@CurrentActor() actor: ActorContext): Promise<TechnologyCaseResponse[]> {
    return this.technologyCaseService.list(actor);
  }

  @Get(":id")
  getById(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<TechnologyCaseResponse> {
    return this.technologyCaseService.getById(actor, id);
  }

  @Post(":id/members")
  @UsePipes(new ZodValidationPipe(AddCaseMemberRequestSchema))
  addMember(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: AddCaseMemberRequest,
    @Req() req: Request,
  ): Promise<CaseMemberResponse> {
    return this.technologyCaseService.addMember(actor, id, body, requestId(req));
  }

  @Post(":id/organizations")
  @UsePipes(new ZodValidationPipe(AddCaseOrganizationRequestSchema))
  addOrganization(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: AddCaseOrganizationRequest,
    @Req() req: Request,
  ): Promise<CaseOrganizationResponse> {
    return this.technologyCaseService.addOrganization(actor, id, body, requestId(req));
  }

  @Post(":id/transitions")
  @UsePipes(new ZodValidationPipe(TransitionCaseRequestSchema))
  transition(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: TransitionCaseRequest,
    @Req() req: Request,
  ): Promise<TechnologyCaseResponse> {
    return this.technologyCaseService.transition(actor, id, body.toStatus, body.reason, requestId(req));
  }

  @Post(":id/evidence")
  @UsePipes(new ZodValidationPipe(CreateEvidenceRequestSchema))
  createEvidence(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: CreateEvidenceRequest,
    @Req() req: Request,
  ): Promise<EvidenceResponse> {
    return this.evidenceService.create(actor, id, body, requestId(req));
  }
}
