import { getAppPool } from "@r2m/database";
import { Module, type OnModuleInit } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { MetricsController } from "./metrics.controller";
import { MetricsInterceptor } from "./metrics.interceptor";
import { registerDbPoolMetrics } from "./metrics.registry";

@Module({
  controllers: [MetricsController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
})
export class MetricsModule implements OnModuleInit {
  onModuleInit(): void {
    registerDbPoolMetrics(getAppPool());
  }
}
