import { Module } from "@nestjs/common";
import { AuditModule } from "./audit/audit.module";
import { JobsModule } from "./jobs/jobs.module";

@Module({
  imports: [AuditModule, JobsModule],
  // Re-export for the same reason as IdentityOrganizationModule — see comment there.
  exports: [AuditModule, JobsModule],
})
export class PlatformOperationsModule {}
