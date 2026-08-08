import type { CompanyProfileResponse, CreateCompanyProfileRequest, UpdateCompanyProfileRequest } from "@r2m/contracts";
import { CreateCompanyProfileRequestSchema, UpdateCompanyProfileRequestSchema } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Get, Param, Patch, Post, Req, UsePipes } from "@nestjs/common";
import type { Request } from "express";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { CompanyProfileService } from "./company-profile.service";

function requestId(req: Request): string | null {
  return (req.headers["x-request-id"] as string) ?? null;
}

@Controller("organizations/:id/company-profile")
export class CompanyProfileController {
  constructor(private readonly companyProfileService: CompanyProfileService) {}

  @Get()
  getProfile(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
  ): Promise<CompanyProfileResponse> {
    return this.companyProfileService.getProfile(actor, id);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateCompanyProfileRequestSchema))
  createProfile(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: CreateCompanyProfileRequest,
    @Req() req: Request,
  ): Promise<CompanyProfileResponse> {
    return this.companyProfileService.createProfile(actor, id, body, requestId(req));
  }

  @Patch()
  @UsePipes(new ZodValidationPipe(UpdateCompanyProfileRequestSchema))
  updateProfile(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: UpdateCompanyProfileRequest,
    @Req() req: Request,
  ): Promise<CompanyProfileResponse> {
    return this.companyProfileService.updateProfile(actor, id, body, requestId(req));
  }
}
