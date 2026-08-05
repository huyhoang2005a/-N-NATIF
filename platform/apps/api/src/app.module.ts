import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { DomainErrorFilter } from "./common/filters/domain-error.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { DatabaseModule } from "./database/database.module";
import { IdentityOrganizationModule } from "./modules/identity-organization/identity-organization.module";
import { PlatformOperationsModule } from "./modules/platform-operations/platform-operations.module";
import { VerificationModule } from "./modules/verification/verification.module";
import { ResourceCatalogModule } from "./modules/resource-catalog/resource-catalog.module";

@Module({
  imports: [
    DatabaseModule,
    PlatformOperationsModule,
    IdentityOrganizationModule,
    VerificationModule,
    ResourceCatalogModule,
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
