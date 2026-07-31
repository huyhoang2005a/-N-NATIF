import { ErrorCode, ForbiddenError, OrganizationMemberRole } from "@r2m/domain";
import type { ActorContext } from "./actor-context";
import { findActiveMembership } from "./actor-context";

export function isOrgOwnerOrAdmin(actor: ActorContext, organizationId: string): boolean {
  const membership = findActiveMembership(actor, organizationId);
  return (
    membership?.role === OrganizationMemberRole.ORG_OWNER ||
    membership?.role === OrganizationMemberRole.ORG_ADMIN
  );
}

export function isActiveMember(actor: ActorContext, organizationId: string): boolean {
  return findActiveMembership(actor, organizationId) !== undefined;
}

export function assertOrgOwnerOrAdmin(actor: ActorContext, organizationId: string): void {
  if (!isOrgOwnerOrAdmin(actor, organizationId)) {
    throw new ForbiddenError(
      ErrorCode.AUTH_FORBIDDEN,
      "Only an active ORG_OWNER or ORG_ADMIN of this organization may perform this action.",
      { organizationId },
    );
  }
}

export function assertActiveMember(actor: ActorContext, organizationId: string): void {
  if (!isActiveMember(actor, organizationId)) {
    throw new ForbiddenError(
      ErrorCode.ORG_NOT_MEMBER,
      "Actor is not an active member of this organization.",
      { organizationId },
    );
  }
}
