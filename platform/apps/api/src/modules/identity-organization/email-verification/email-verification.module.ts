import { Module } from "@nestjs/common";
import { AuditModule } from "../../platform-operations/audit/audit.module";
import { JobsModule } from "../../platform-operations/jobs/jobs.module";
import { EmailVerificationController } from "./email-verification.controller";
import { EmailVerificationRepository } from "./email-verification.repository";
import { EmailVerificationService } from "./email-verification.service";

@Module({
  imports: [AuditModule, JobsModule],
  controllers: [EmailVerificationController],
  providers: [EmailVerificationService, EmailVerificationRepository],
  // Exported so OrganizationsService can generate a token in the same transaction as
  // registration — see organizations.service.ts::register().
  exports: [EmailVerificationRepository],
})
export class EmailVerificationModule {}
