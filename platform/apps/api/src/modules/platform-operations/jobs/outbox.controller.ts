import type { OutboxEventResponse } from "@r2m/contracts";
import type { ActorContext } from "@r2m/authz";
import { assertPlatformAdmin } from "@r2m/authz";
import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { parsePageLimit, parsePageOffset } from "../../../common/pagination/parse-page-params.util";
import { OutboxService } from "./outbox.service";

function toResponse(row: {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  status: string;
  attemptCount: number;
  lastError: string | null;
  availableAt: Date;
  publishedAt: Date | null;
  createdAt: Date;
}): OutboxEventResponse {
  return {
    id: row.id,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    eventType: row.eventType,
    payload: row.payload,
    status: row.status,
    attemptCount: row.attemptCount,
    lastError: row.lastError,
    availableAt: row.availableAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Not spec-mandated — explicit user-approved addition, the admin dead-letter queue
 * viewer (2026-08-16). Own controller for the same reason as `PlatformAuditLogController`
 * — `JobsModule` is imported by nearly every bounded context for the write-only
 * `OutboxService`; a controller there would be re-declared once per importer. */
@Controller("platform/outbox-events")
export class PlatformOutboxController {
  constructor(private readonly outboxService: OutboxService) {}

  @Get()
  list(
    @CurrentActor() actor: ActorContext,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("status") status?: string,
  ): Promise<OutboxEventResponse[]> {
    assertPlatformAdmin(actor);
    return this.outboxService
      .list({ limit: parsePageLimit(limit), offset: parsePageOffset(offset), status })
      .then((rows) => rows.map(toResponse));
  }

  @Post(":id/retry")
  async retry(@CurrentActor() actor: ActorContext, @Param("id") id: string): Promise<{ ok: true }> {
    assertPlatformAdmin(actor);
    await this.outboxService.retry(id);
    return { ok: true };
  }
}
