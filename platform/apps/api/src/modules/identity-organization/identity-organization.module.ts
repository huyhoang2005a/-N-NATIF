import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { OrganizationsModule } from "./organizations/organizations.module";

@Module({
  imports: [AuthModule, UsersModule, OrganizationsModule],
  // Re-export so consumers outside this bounded context (e.g. AppModule's global
  // APP_GUARD, which needs TokenService) can resolve providers from the sub-modules —
  // NestJS does not do this automatically just because a module is imported.
  exports: [AuthModule, UsersModule, OrganizationsModule],
})
export class IdentityOrganizationModule {}
