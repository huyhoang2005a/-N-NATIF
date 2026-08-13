import { Module } from "@nestjs/common";
import { StorageModule } from "../../../common/storage/storage.module";
import { AuditModule } from "../../platform-operations/audit/audit.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { AuthController } from "./auth.controller";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";
import { TokenService } from "./token.service";

@Module({
  imports: [OrganizationsModule, AuditModule, StorageModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, TokenService],
  exports: [TokenService],
})
export class AuthModule {}
