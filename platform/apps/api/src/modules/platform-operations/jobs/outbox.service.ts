import type { DomainEvent } from "@r2m/contracts";
import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { ConflictError, ErrorCode, NotFoundError } from "@r2m/domain";
import { Inject, Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";

/**
 * Appends a domain event to `outbox_event` in the SAME transaction as the business write
 * that produced it (CLAUDE.md rule #3). apps/worker's outbox dispatcher polls this table
 * and publishes/delivers asynchronously — nothing here talks to Redis/email directly.
 */
@Injectable()
export class OutboxService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** `context.requestId`/`context.traceparent` are optional (Phase 7 Sprint 7.3) —
   * correlates the worker's later async processing of this event back to the API request
   * that produced it, for structured logs and OpenTelemetry tracing respectively. Existing
   * call sites that don't pass `context` are unaffected. */
  async append(
    aggregateType: string,
    aggregateId: string,
    event: DomainEvent,
    tx?: Database,
    context?: { requestId?: string | null; traceparent?: string | null },
  ): Promise<void> {
    const client = tx ?? this.db;
    await client.insert(schema.outboxEvent).values({
      aggregateType,
      aggregateId,
      eventType: event.type,
      payload: event,
      requestId: context?.requestId ?? undefined,
      traceparent: context?.traceparent ?? undefined,
    });
  }

  /** Not spec-mandated — explicit user-approved addition, the admin dead-letter queue
   * viewer (2026-08-16). This table was write-only from the API side until now — the
   * worker's `apps/worker/src/outbox-dispatcher.ts` polls PENDING/FAILED rows itself, but
   * nothing ever read DEAD_LETTER rows back out, and nothing retried them (verified: no
   * retry path exists anywhere in the worker either — a DEAD_LETTER row was permanent
   * until this). `status` filter is optional so an admin can browse the whole table, not
   * just dead letters. */
  async list(params: { limit: number; offset: number; status?: string }) {
    return this.db.query.outboxEvent.findMany({
      where: params.status ? eq(schema.outboxEvent.status, params.status as never) : undefined,
      orderBy: [desc(schema.outboxEvent.createdAt)],
      limit: params.limit,
      offset: params.offset,
    });
  }

  /** Resets a DEAD_LETTER row to PENDING with `attempt_count` zeroed, giving it a fresh
   * `DEFAULT_MAX_ATTEMPTS` (5, see `outbox-dispatcher.ts`) budget on the worker's next
   * poll cycle — the exact state the dispatcher itself already knows how to pick up, no
   * new dispatcher logic needed. Only DEAD_LETTER is retryable here: a PENDING/FAILED row
   * is already going to be retried by the dispatcher on its own, retrying it manually
   * would just race the dispatcher for no benefit. */
  async retry(id: string): Promise<void> {
    const row = await this.db.query.outboxEvent.findFirst({ where: eq(schema.outboxEvent.id, id) });
    if (!row) {
      throw new NotFoundError(ErrorCode.OUTBOX_EVENT_NOT_FOUND, "Outbox event not found.");
    }
    if (row.status !== "DEAD_LETTER") {
      throw new ConflictError(
        ErrorCode.OUTBOX_EVENT_NOT_RETRYABLE,
        `Only a DEAD_LETTER event can be retried (current status: ${row.status}).`,
      );
    }
    await this.db
      .update(schema.outboxEvent)
      .set({ status: "PENDING", attemptCount: 0, lastError: null })
      .where(eq(schema.outboxEvent.id, id));
  }
}
