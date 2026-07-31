import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

/** Ensures every request carries a stable X-Request-Id, used in the error envelope's
 * `traceId` and stamped onto every audit_log row (architecture plan §7.3 / §10). */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers["x-request-id"];
    const requestId = typeof incoming === "string" && incoming.length > 0 ? incoming : uuidv4();
    req.headers["x-request-id"] = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  }
}
