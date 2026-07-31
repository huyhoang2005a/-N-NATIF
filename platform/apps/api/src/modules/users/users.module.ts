import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { JobsModule } from "../jobs/jobs.module";
import { UsersController } from "./users.controller";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

@Module({
  imports: [AuditModule, JobsModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
})
export class UsersModule {}
