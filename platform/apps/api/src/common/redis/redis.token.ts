/** Separate file from redis.module.ts to avoid a circular import with rate-limit.guard.ts
 * (which needs this token but is also a provider registered inside RedisModule) — NestJS
 * `@Inject(REDIS)` evaluates this at class-definition time, so a cycle through the module
 * file left it `undefined` when RateLimitGuard's decorator ran, breaking DI resolution. */
export const REDIS = Symbol("REDIS");
