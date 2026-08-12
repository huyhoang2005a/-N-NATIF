import { ErrorCode, ForbiddenError, PlatformRole } from "@r2m/domain";
import type { ActorContext } from "./actor-context";

export function isPlatformReviewerOrAdmin(actor: ActorContext): boolean {
  return (
    actor.platformRole === PlatformRole.PLATFORM_REVIEWER ||
    actor.platformRole === PlatformRole.PLATFORM_ADMIN
  );
}

export function isPlatformAdmin(actor: ActorContext): boolean {
  return actor.platformRole === PlatformRole.PLATFORM_ADMIN;
}

export function assertPlatformReviewerOrAdmin(actor: ActorContext): void {
  if (!isPlatformReviewerOrAdmin(actor)) {
    throw new ForbiddenError(
      ErrorCode.AUTH_FORBIDDEN,
      "Only a platform reviewer or platform admin may perform this action.",
    );
  }
}

/** Phase 7 Sprint 7.4 — stricter than `assertPlatformReviewerOrAdmin`: used for the
 * verification-document retention endpoint, which is a PII/legal-retention decision
 * (spec: retention policy needs organizational sign-off), not a routine review action. */
export function assertPlatformAdmin(actor: ActorContext): void {
  if (!isPlatformAdmin(actor)) {
    throw new ForbiddenError(ErrorCode.AUTH_FORBIDDEN, "Only a platform admin may perform this action.");
  }
}
