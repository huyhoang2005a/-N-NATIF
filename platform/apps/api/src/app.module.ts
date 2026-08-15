import { randomUUID } from "node:crypto";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { DomainErrorFilter } from "./common/filters/domain-error.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { MetricsModule } from "./common/metrics/metrics.module";
import { RedisModule } from "./common/redis/redis.module";
import { DatabaseModule } from "./database/database.module";
import { IdentityOrganizationModule } from "./modules/identity-organization/identity-organization.module";
import { PlatformOperationsModule } from "./modules/platform-operations/platform-operations.module";
import { VerificationModule } from "./modules/verification/verification.module";
import { ResourceCatalogModule } from "./modules/resource-catalog/resource-catalog.module";
import { TechnologyCaseModule } from "./modules/technology-case/technology-case.module";
import { AssessmentGapModule } from "./modules/assessment-gap/assessment-gap.module";
import { RoadmapTransferModule } from "./modules/roadmap-transfer/roadmap-transfer.module";
import { CompanyDiscoveryModule } from "./modules/company-discovery/company-discovery.module";
import { CommunityModule } from "./modules/community/community.module";
import { AssistantModule } from "./modules/assistant/assistant.module";

@Module({
  imports: [
    // Phase 7 Sprint 7.3 — structured JSON logs with request ID (spec §7.3 item 7).
    // `genReqId` defers to the id `RequestIdMiddleware` already put on the request (same
    // id used in the error envelope's `traceId` and every `audit_log` row) instead of
    // minting a second, different one — one id per request across logs/errors/audit.
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req) => {
          const existing = (req.headers as Record<string, string | undefined>)["x-request-id"];
          return existing ?? randomUUID();
        },
        transport: process.env.NODE_ENV === "production" ? undefined : { target: "pino-pretty", options: { singleLine: true } },
        autoLogging: { ignore: (req) => req.url === "/v1/metrics" },
      },
    }),
    DatabaseModule,
    RedisModule,
    MetricsModule,
    PlatformOperationsModule,
    IdentityOrganizationModule,
    VerificationModule,
    ResourceCatalogModule,
    TechnologyCaseModule,
    AssessmentGapModule,
    RoadmapTransferModule,
    CompanyDiscoveryModule,
    CommunityModule,
    AssistantModule,
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
