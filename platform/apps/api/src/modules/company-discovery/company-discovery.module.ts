import { Module } from "@nestjs/common";
import { OrganizationsModule } from "../identity-organization/organizations/organizations.module";
import { CompanyProfileController } from "./company-profile/company-profile.controller";
import { CompanyProfileRepository } from "./company-profile/company-profile.repository";
import { CompanyProfileService } from "./company-profile/company-profile.service";

/** Company & Discovery bounded context (Phase 5, §9.8). 1 aggregator module for the
 * whole context, sub-features added sprint by sprint (5.1 Company Profile first). */
@Module({
  imports: [OrganizationsModule],
  controllers: [CompanyProfileController],
  providers: [CompanyProfileRepository, CompanyProfileService],
})
export class CompanyDiscoveryModule {}
