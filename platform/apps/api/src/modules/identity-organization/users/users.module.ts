import { Module } from "@nestjs/common";
import { AuditModule } from "../../platform-operations/audit/audit.module";
import { JobsModule } from "../../platform-operations/jobs/jobs.module";
import { PlatformUsersController, UserDirectoryController, UsersController } from "./users.controller";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

@Module({
  imports: [AuditModule, JobsModule],
  controllers: [UsersController, UserDirectoryController, PlatformUsersController],
  providers: [UsersService, UsersRepository],
})
export class UsersModule {}
