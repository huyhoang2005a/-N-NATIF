import { loadEnv } from "@r2m/env";
import { Global, Module } from "@nestjs/common";
import { Redis } from "ioredis";
import { RateLimitGuard } from "../guards/rate-limit.guard";
import { REDIS } from "./redis.token";

export { REDIS };

/** Phase 7 Sprint 7.2 — first real consumer of the Redis container (already running in
 * docker-compose since Phase 1, unused by any app code until now). Also hosts
 * `RateLimitGuard`'s DI registration since it depends on the REDIS token — kept in this
 * module rather than a separate one to avoid an extra file for a single provider. */
@Global()
@Module({
  providers: [{ provide: REDIS, useFactory: () => new Redis(loadEnv().REDIS_URL) }, RateLimitGuard],
  exports: [REDIS, RateLimitGuard],
})
export class RedisModule {}
