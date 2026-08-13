import { Module } from "@nestjs/common";
import { StorageModule } from "../../../common/storage/storage.module";
import { AuditModule } from "../../platform-operations/audit/audit.module";
import { JobsModule } from "../../platform-operations/jobs/jobs.module";
import { PlatformUsersController, UserAvatarController, UserDirectoryController, UsersController } from "./users.controller";
import { UsersRepository } from "./users.repository";
import { UsersService } from "./users.service";

@Module({
  imports: [AuditModule, JobsModule, StorageModule],
  controllers: [UsersController, UserAvatarController, UserDirectoryController, PlatformUsersController],
  providers: [UsersService, UsersRepository],
})
export class UsersModule {}
