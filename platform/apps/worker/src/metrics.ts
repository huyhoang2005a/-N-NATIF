import { createServer } from "node:http";
import type { Pool } from "pg";
import { Counter, Gauge, Registry, collectDefaultMetrics } from "prom-client";
import { logger } from "./logger";

/** Phase 7 Sprint 7.3. Matches the spec's explicitly-named worker metrics
 * ("outbox_dead_letter_total", outbox lag against NFR-05's p95<=30s target). */
export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });

export const outboxDispatchTotal = new Counter({
  name: "outbox_dispatch_total",
  help: "Outbox events dispatched, by outcome.",
  labelNames: ["outcome"] as const, // "published" | "failed" | "dead_letter"
  registers: [metricsRegistry],
});

/** Set on every poll cycle to `now - oldest PENDING/FAILED row's available_at` (0 if the
 * queue is empty) — the actual lag the worker is behind on, not a request-scoped duration,
 * hence a Gauge rather than a Histogram. */
export const outboxDispatchLagSeconds = new Gauge({
  name: "outbox_dispatch_lag_seconds",
  help: "Age of the oldest still-pending outbox event, in seconds.",
  registers: [metricsRegistry],
});

/** Phase 7 Sprint 7.3 — same DB pool gauges as apps/api's metrics.registry.ts. */
export function registerDbPoolMetrics(pool: Pool): void {
  new Gauge({
    name: "db_pool_total_connections",
    help: "Total pg pool connections (in use + idle).",
    registers: [metricsRegistry],
    collect() {
      this.set(pool.totalCount);
    },
  });
  new Gauge({
    name: "db_pool_idle_connections",
    help: "Idle pg pool connections.",
    registers: [metricsRegistry],
    collect() {
      this.set(pool.idleCount);
    },
  });
  new Gauge({
    name: "db_pool_waiting_requests",
    help: "Requests waiting for a pg pool connection.",
    registers: [metricsRegistry],
    collect() {
      this.set(pool.waitingCount);
    },
  });
}

/** No NestJS here — a bare http.Server whose only job is serving GET /metrics. */
export function startMetricsServer(port: number): void {
  const server = createServer((req, res) => {
    if (req.url === "/metrics") {
      metricsRegistry
        .metrics()
        .then((body) => {
          res.writeHead(200, { "Content-Type": metricsRegistry.contentType });
          res.end(body);
        })
        .catch((error: unknown) => {
          res.writeHead(500);
          res.end(String(error));
        });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port, () => {
    logger.info({ port }, "metrics server listening");
  });
}
