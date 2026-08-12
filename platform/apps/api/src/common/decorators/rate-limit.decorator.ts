import { SetMetadata } from "@nestjs/common";

export interface RateLimitOptions {
  /** Redis key namespace, e.g. "login", "resource-upload". */
  keyPrefix: string;
  /** Max requests allowed within one window. */
  points: number;
  durationSeconds: number;
}

export const RATE_LIMIT_KEY = "rateLimit";

/** Phase 7 Sprint 7.2 — opt-in per-route, same pattern as `@Public()`
 * (`RateLimitGuard` reads this via `Reflector`; a route without this decorator is never
 * rate limited). Numbers are a chosen operational default, not a business rule (spec §7.3
 * item 4 requires rate limiting on these routes but does not specify thresholds) — tune via
 * redeploy, not a config value, since there's no existing env-var-per-route convention in
 * this codebase to piggyback on. */
export const RateLimit = (options: RateLimitOptions): MethodDecorator => SetMetadata(RATE_LIMIT_KEY, options);
