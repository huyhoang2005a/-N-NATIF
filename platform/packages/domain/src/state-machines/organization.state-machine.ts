import { OrganizationStatus } from "../enums/organization.enum";
import { ConflictError } from "../errors/domain-error";
import { ErrorCode } from "../errors/error-codes";
import { TransitionTable } from "./transition-table";

/** Organization lifecycle — architecture plan §5.1 / §8. */
const organizationTransitions = new TransitionTable<OrganizationStatus>({
  [OrganizationStatus.PENDING_VERIFICATION]: [OrganizationStatus.ACTIVE, OrganizationStatus.REJECTED],
  [OrganizationStatus.ACTIVE]: [OrganizationStatus.SUSPENDED, OrganizationStatus.ARCHIVED],
  [OrganizationStatus.SUSPENDED]: [OrganizationStatus.ACTIVE, OrganizationStatus.ARCHIVED],
  [OrganizationStatus.REJECTED]: [],
  [OrganizationStatus.ARCHIVED]: [],
});

export function canTransitionOrganization(
  from: OrganizationStatus,
  to: OrganizationStatus,
): boolean {
  return organizationTransitions.canTransition(from, to);
}

export function assertOrganizationTransition(
  from: OrganizationStatus,
  to: OrganizationStatus,
): void {
  if (!canTransitionOrganization(from, to)) {
    throw new ConflictError(
      ErrorCode.ORG_INVALID_TRANSITION,
      `Organization cannot transition from ${from} to ${to}.`,
      { from, to },
    );
  }
}
