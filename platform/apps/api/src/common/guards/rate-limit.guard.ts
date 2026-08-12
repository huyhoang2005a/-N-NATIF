import type { ActorContext } from "@r2m/authz";
import { ErrorCode, RateLimitedError } from "@r2m/domain";
import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { Redis } from "ioredis";
import { RATE_LIMIT_KEY, type RateLimitOptions } from "../decorators/rate-limit.decorator";
import { rateLimitRejectedTotal } from "../metrics/metrics.registry";
import { REDIS } from "../redis/redis.token";

interface RequestWithActor extends Request {
  actor?: ActorContext;
}

/** Phase 7 Sprint 7.2. Fixed-window counter in Redis (`INCR` + `EXPIRE` on first hit) —
 * simple, no extra dependency beyond `ioredis` already added for this. Keyed by
 * `actor.userId` when the route runs after `JwtAuthGuard` populates it (upload/
 * recommendation-run/proposal-submit — all authenticated), otherwise by IP (`POST
 * /auth/login`, which is `@Public()` and has no actor yet — rate limiting it by account
 * would let an attacker credential-stuff a victim's email from many IPs without ever
 * tripping a per-account limit). */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions | undefined>(RATE_LIMIT_KEY, context.getHandler());
    if (!options) return true;

    const request = context.switchToHttp().getRequest<RequestWithActor>();
    const identity = request.actor?.userId ?? request.ip ?? "unknown";
    const key = `ratelimit:${options.keyPrefix}:${identity}`;

    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, options.durationSeconds);
    }

    if (count > options.points) {
      rateLimitRejectedTotal.inc({ keyPrefix: options.keyPrefix });
      const ttl = await this.redis.ttl(key);
      throw new RateLimitedError(
        ErrorCode.SYSTEM_RATE_LIMITED,
        "Too many requests — please slow down and try again shortly.",
        { retryAfterSeconds: ttl > 0 ? ttl : options.durationSeconds },
      );
    }

    return true;
  }
}
