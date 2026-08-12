import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ensures every request carries a stable X-Request-Id, used in the error envelope's
 * `traceId` and stamped onto every audit_log row (architecture plan §7.3 / §10).
 * `audit_log.request_id` is a `uuid` column — a client-supplied header that isn't
 * valid-UUID-shaped is replaced with a freshly generated one rather than trusted verbatim
 * (found live in Phase 7 Sprint 7.3: a non-UUID header 500'd the whole request the moment
 * it reached an `AuditService.write()` call). */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers["x-request-id"];
    const requestId = typeof incoming === "string" && UUID_PATTERN.test(incoming) ? incoming : uuidv4();
    req.headers["x-request-id"] = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  }
}
