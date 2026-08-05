import { AuthorVerificationStatus, ErrorCode, ForbiddenError } from "@r2m/domain";
import type { ActorContext } from "./actor-context";
import { isOrgOwnerOrAdmin } from "./organization-membership.policy";

/** UC-RES-01 actor: "Verified Author/Authorized Organization Member" — decided as
 * `authorVerificationStatus === VERIFIED` (see plan B.0). */
export function canRegisterResource(actor: ActorContext): boolean {
  return actor.authorVerificationStatus === AuthorVerificationStatus.VERIFIED;
}

export function assertCanRegisterResource(actor: ActorContext): void {
  if (!canRegisterResource(actor)) {
    throw new ForbiddenError(
      ErrorCode.RESOURCE_AUTHOR_NOT_VERIFIED,
      "Only a verified author may register a resource.",
    );
  }
}

/** "Resource manager" in UC-RES-01/02 and SUC-04 = an active ORG_OWNER/ORG_ADMIN of the
 * resource's owning organization — same role pair used for org write-access elsewhere. */
export function canManageResource(actor: ActorContext, ownerOrganizationId: string): boolean {
  return isOrgOwnerOrAdmin(actor, ownerOrganizationId);
}

export function assertCanManageResource(actor: ActorContext, ownerOrganizationId: string): void {
  if (!canManageResource(actor, ownerOrganizationId)) {
    throw new ForbiddenError(
      ErrorCode.RESOURCE_ACCESS_DENIED,
      "Only an active ORG_OWNER or ORG_ADMIN of the owning organization may manage this resource.",
      { ownerOrganizationId },
    );
  }
}
