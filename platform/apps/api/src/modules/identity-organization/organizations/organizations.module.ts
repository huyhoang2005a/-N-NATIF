import { Module } from "@nestjs/common";
import { StorageModule } from "../../../common/storage/storage.module";
import { AuditModule } from "../../platform-operations/audit/audit.module";
import { JobsModule } from "../../platform-operations/jobs/jobs.module";
import { EmailVerificationModule } from "../email-verification/email-verification.module";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsRepository } from "./organizations.repository";
import { OrganizationsService } from "./organizations.service";

@Module({
  imports: [AuditModule, JobsModule, EmailVerificationModule, StorageModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationsRepository],
  exports: [OrganizationsRepository, OrganizationsService],
})
export class OrganizationsModule {}
