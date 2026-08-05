import type {
  AuthorVerificationStatus,
  MembershipStatus,
  OrganizationMemberRole,
  PlatformRole,
} from "@r2m/domain";

export interface OrganizationMembershipContext {
  organizationId: string;
  role: OrganizationMemberRole;
  status: MembershipStatus;
}

/**
 * The authenticated caller for one request. MUST be built exclusively from data the server
 * loaded itself (session lookup + a fresh membership query) — never trust an
 * `organizationId`/`role` field sent by the client (architecture plan §7.3).
 */
export interface ActorContext {
  userId: string;
  platformRole: PlatformRole;
  memberships: OrganizationMembershipContext[];
  /** `UNVERIFIED` when the actor has no `author_profile` row yet (not every user goes
   * through author verification — see JwtAuthGuard). */
  authorVerificationStatus: AuthorVerificationStatus;
}

export function findActiveMembership(
  actor: ActorContext,
  organizationId: string,
): OrganizationMembershipContext | undefined {
  return actor.memberships.find(
    (membership) => membership.organizationId === organizationId && membership.status === "ACTIVE",
  );
}
