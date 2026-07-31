import { ConflictError, ErrorCode } from "@r2m/domain";

interface MemberLike {
  role: string;
  status: string;
}

/**
 * "Mỗi Organization có đúng một active ORG_OWNER" (architecture plan §4 / §12.2 #1). The
 * database also defends this via a partial unique index, but the application must reject
 * the change with a clean error code before it ever reaches that constraint.
 */
export function assertNotRemovingLastActiveOwner(
  member: MemberLike,
  requestedStatus: string | undefined,
  requestedRole: string | undefined,
): void {
  const isCurrentlyActiveOwner = member.role === "ORG_OWNER" && member.status === "ACTIVE";
  if (!isCurrentlyActiveOwner) {
    return;
  }
  const wouldStayActiveOwner =
    (requestedRole ?? member.role) === "ORG_OWNER" && (requestedStatus ?? member.status) === "ACTIVE";
  if (!wouldStayActiveOwner) {
    throw new ConflictError(
      ErrorCode.ORG_CANNOT_REMOVE_LAST_OWNER,
      "Cannot change role/status of the organization's only active ORG_OWNER.",
    );
  }
}
