import { ConflictError, ErrorCode } from "@r2m/domain";
import type { Database } from "@r2m/database";
import { schema } from "@r2m/database";
import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../../database/database.module";

export interface IdempotentResult<T> {
  status: number;
  body: T;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Protects create/mutate commands from duplicate submission (architecture plan §7.6 /
 * §12.2). A replayed request with the same (userId, Idempotency-Key, requestHash) gets the
 * stored response back instead of re-running the command; reusing the same key for a
 * different payload is rejected rather than silently executed.
 */
@Injectable()
export class IdempotencyService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async withIdempotency<T>(
    userId: string,
    key: string,
    requestHash: string,
    run: () => Promise<IdempotentResult<T>>,
  ): Promise<IdempotentResult<T>> {
    const existing = await this.db.query.idempotencyKey.findFirst({
      where: and(eq(schema.idempotencyKey.userId, userId), eq(schema.idempotencyKey.key, key)),
    });

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictError(
          ErrorCode.SYSTEM_IDEMPOTENCY_KEY_REUSED,
          "This Idempotency-Key was already used with a different request payload.",
        );
      }
      if (existing.responseStatus !== null) {
        return { status: existing.responseStatus, body: existing.responseBody as T };
      }
    } else {
      await this.db.insert(schema.idempotencyKey).values({
        userId,
        key,
        requestHash,
        expiresAt: new Date(Date.now() + DEFAULT_TTL_MS),
      });
    }

    const result = await run();

    await this.db
      .update(schema.idempotencyKey)
      .set({ responseStatus: result.status, responseBody: result.body as never })
      .where(and(eq(schema.idempotencyKey.userId, userId), eq(schema.idempotencyKey.key, key)));

    return result;
  }
}
