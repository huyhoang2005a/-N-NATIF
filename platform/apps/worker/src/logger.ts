import pino from "pino";

/** Phase 7 Sprint 7.3 — same structured-JSON-logs requirement as apps/api's `nestjs-pino`
 * setup, plain `pino` here since the worker isn't a NestJS app. */
export const logger = pino({
  transport: process.env.NODE_ENV === "production" ? undefined : { target: "pino-pretty", options: { singleLine: true } },
});
