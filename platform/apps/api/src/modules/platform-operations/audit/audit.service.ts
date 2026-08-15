import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
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

  /** Not spec-mandated — explicit user-approved addition, the admin audit-log viewer
   * (2026-08-16). Read-only, newest first; `entityType`/`actorUserId` filters are optional
   * narrowing, not required — an admin browsing the trail usually starts unfiltered. */
  async list(params: { limit: number; offset: number; entityType?: string; actorUserId?: string }) {
    const conditions = [
      params.entityType ? eq(schema.auditLog.entityType, params.entityType) : undefined,
      params.actorUserId ? eq(schema.auditLog.actorUserId, params.actorUserId) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);

    return this.db.query.auditLog.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(schema.auditLog.createdAt)],
      limit: params.limit,
      offset: params.offset,
    });
  }
}
