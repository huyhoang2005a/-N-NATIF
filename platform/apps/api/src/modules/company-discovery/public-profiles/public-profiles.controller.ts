import type { PublicAuthorProfileResponse, PublicOrganizationProfileResponse } from "@r2m/contracts";
import { Controller, Get, Param } from "@nestjs/common";
import { Public } from "../../../common/decorators/public.decorator";
import { PublicProfilesService } from "./public-profiles.service";

@Controller("authors")
export class PublicAuthorProfileController {
  constructor(private readonly service: PublicProfilesService) {}

  @Public()
  @Get(":slug/public-profile")
  getProfile(@Param("slug") slug: string): Promise<PublicAuthorProfileResponse> {
    return this.service.getAuthorProfile(slug);
  }
}

@Controller("organizations")
export class PublicOrganizationProfileController {
  constructor(private readonly service: PublicProfilesService) {}

  @Public()
  @Get(":slug/public-profile")
  getProfile(@Param("slug") slug: string): Promise<PublicOrganizationProfileResponse> {
    return this.service.getOrganizationProfile(slug);
  }
}
