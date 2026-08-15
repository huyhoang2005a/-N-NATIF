/** `GET /platform/audit-log` (admin-only, 2026-08-16) — the audit trail was write-only
 * until now (`AuditService.write` on every domain transition, per CLAUDE.md rule #3), no
 * endpoint ever read it back. `actorUserId`/`actorDisplayName` resolution follows this
 * app's existing pattern (`fetchUserNames`) — the frontend resolves display names from
 * `actorUserId`, this response doesn't join to `user_profile` itself. */
export interface AuditLogEntryResponse {
  id: string;
  actorUserId: string | null;
  scopeOrganizationId: string | null;
  requestId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeData: unknown;
  afterData: unknown;
  createdAt: string;
}
