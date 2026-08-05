import { Module } from "@nestjs/common";
import { AuditModule } from "./audit/audit.module";
import { JobsModule } from "./jobs/jobs.module";

@Module({ imports: [AuditModule, JobsModule] })
export class PlatformOperationsModule {}
