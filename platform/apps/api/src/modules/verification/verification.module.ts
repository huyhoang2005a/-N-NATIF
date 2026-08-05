import { Module } from "@nestjs/common";
import { AuditModule } from "../platform-operations/audit/audit.module";
import { JobsModule } from "../platform-operations/jobs/jobs.module";
import { OrganizationsModule } from "../identity-organization/organizations/organizations.module";
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
