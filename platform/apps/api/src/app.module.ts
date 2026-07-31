import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { DomainErrorFilter } from "./common/filters/domain-error.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { DatabaseModule } from "./database/database.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { UsersModule } from "./modules/users/users.module";
import { VerificationModule } from "./modules/verification/verification.module";

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    JobsModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    VerificationModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: DomainErrorFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
