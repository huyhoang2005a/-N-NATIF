import { Module } from "@nestjs/common";
import { AuditModule } from "../../platform-operations/audit/audit.module";
import { JobsModule } from "../../platform-operations/jobs/jobs.module";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsRepository } from "./organizations.repository";
import { OrganizationsService } from "./organizations.service";

@Module({
  imports: [AuditModule, JobsModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationsRepository],
  exports: [OrganizationsRepository],
})
export class OrganizationsModule {}
