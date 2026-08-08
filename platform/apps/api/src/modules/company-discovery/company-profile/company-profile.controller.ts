import type { CompanyProfileResponse, CreateCompanyProfileRequest, UpdateCompanyProfileRequest } from "@r2m/contracts";
import { CreateCompanyProfileRequestSchema, UpdateCompanyProfileRequestSchema } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { Body, Controller, Get, Param, Patch, Post, UsePipes } from "@nestjs/common";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { CompanyProfileService } from "./company-profile.service";

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
  ): Promise<CompanyProfileResponse> {
    return this.companyProfileService.createProfile(actor, id, body);
  }

  @Patch()
  @UsePipes(new ZodValidationPipe(UpdateCompanyProfileRequestSchema))
  updateProfile(
    @CurrentActor() actor: ActorContext,
    @Param("id") id: string,
    @Body() body: UpdateCompanyProfileRequest,
  ): Promise<CompanyProfileResponse> {
    return this.companyProfileService.updateProfile(actor, id, body);
  }
}
