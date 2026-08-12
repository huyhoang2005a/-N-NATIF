import { createHash } from "node:crypto";
import type { Request } from "express";
import type { IdempotencyService } from "../../modules/platform-operations/jobs/idempotency.service";

/** Phase 7 Sprint 7.2 — thin wrapper around the already-existing (previously unused)
 * `IdempotencyService.withIdempotency`. The `Idempotency-Key` header is optional: a
 * request without it just runs normally, un-tracked — this only protects clients that
 * opt in by sending the header (the standard idempotency-key convention), not a mandatory
 * requirement on every caller. */
export async function withIdempotencyKey<T>(
  idempotencyService: IdempotencyService,
  actorUserId: string,
  req: Request,
  body: unknown,
  status: number,
  run: () => Promise<T>,
): Promise<T> {
  const key = req.headers["idempotency-key"];
  if (typeof key !== "string" || key.length === 0) {
    return run();
  }

  const requestHash = createHash("sha256").update(JSON.stringify(body ?? {})).digest("hex");
  const result = await idempotencyService.withIdempotency(actorUserId, key, requestHash, async () => ({
    status,
    body: await run(),
  }));
  return result.body;
}
