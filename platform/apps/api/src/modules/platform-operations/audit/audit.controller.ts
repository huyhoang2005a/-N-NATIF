import type { AuditLogEntryResponse } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertPlatformAdmin } from "@r2m/authz";
import { Controller, Get, Query } from "@nestjs/common";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { parsePageLimit, parsePageOffset } from "../../../common/pagination/parse-page-params.util";
import { AuditService } from "./audit.service";

function toResponse(row: {
  id: number;
  actorUserId: string | null;
  scopeOrganizationId: string | null;
  requestId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeData: unknown;
  afterData: unknown;
  createdAt: Date;
}): AuditLogEntryResponse {
  return {
    id: String(row.id),
    actorUserId: row.actorUserId,
    scopeOrganizationId: row.scopeOrganizationId,
    requestId: row.requestId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    beforeData: row.beforeData,
    afterData: row.afterData,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Not spec-mandated — explicit user-approved addition, the admin audit-log viewer
 * (2026-08-16). Deliberately its own controller, not folded into `AuditModule` — that
 * module is imported by nearly every other bounded context purely for the write-only
 * `AuditService`, and a controller registered there would be re-declared once per
 * importer. Lives in `PlatformOperationsModule` instead, which already imports
 * `AuditModule` for the service. */
@Controller("platform/audit-log")
export class PlatformAuditLogController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(
    @CurrentActor() actor: ActorContext,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("entityType") entityType?: string,
    @Query("actorUserId") actorUserId?: string,
  ): Promise<AuditLogEntryResponse[]> {
    assertPlatformAdmin(actor);
    return this.auditService
      .list({ limit: parsePageLimit(limit), offset: parsePageOffset(offset), entityType, actorUserId })
      .then((rows) => rows.map(toResponse));
  }
}
