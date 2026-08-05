import type { DomainEvent } from "@r2m/contracts";
import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../../database/database.module";

/**
 * Appends a domain event to `outbox_event` in the SAME transaction as the business write
 * that produced it (CLAUDE.md rule #3). apps/worker's outbox dispatcher polls this table
 * and publishes/delivers asynchronously — nothing here talks to Redis/email directly.
 */
@Injectable()
export class OutboxService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async append(
    aggregateType: string,
    aggregateId: string,
    event: DomainEvent,
    tx?: Database,
  ): Promise<void> {
    const client = tx ?? this.db;
    await client.insert(schema.outboxEvent).values({
      aggregateType,
      aggregateId,
      eventType: event.type,
      payload: event,
    });
  }
}
