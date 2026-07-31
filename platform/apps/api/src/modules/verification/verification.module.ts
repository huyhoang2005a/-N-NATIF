import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { JobsModule } from "../jobs/jobs.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import {
  OrganizationVerificationRequestController,
  PlatformOrganizationVerificationController,
} from "./verification.controller";
import { VerificationRepository } from "./verification.repository";
import { VerificationService } from "./verification.service";

@Module({
  imports: [AuditModule, JobsModule, OrganizationsModule],
  controllers: [PlatformOrganizationVerificationController, OrganizationVerificationRequestController],
  providers: [VerificationService, VerificationRepository],
})
export class VerificationModule {}
