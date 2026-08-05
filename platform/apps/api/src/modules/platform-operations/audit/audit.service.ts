import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../../../database/database.module";

export interface WriteAuditLogInput {
  actorUserId: string | null;
  scopeOrganizationId?: string | null;
  requestId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: unknown;
  afterData?: unknown;
}

/**
 * Append-only audit trail (architecture plan §9.8 / CLAUDE.md rule #3). Every domain
 * service that performs a write MUST call this in the same transaction as the write —
 * accepts an optional `tx` so callers can pass the transaction client they're already in.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async write(input: WriteAuditLogInput, tx?: Database): Promise<void> {
    const client = tx ?? this.db;
    await client.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      scopeOrganizationId: input.scopeOrganizationId ?? null,
      requestId: input.requestId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeData: input.beforeData ?? null,
      afterData: input.afterData ?? null,
    });
  }
}
