import type { Pool } from "pg";
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";

/** Phase 7 Sprint 7.3 — one process-wide registry (module-level singleton, same pattern as
 * `packages/database/src/client.ts`'s cached pool/db). `collectDefaultMetrics` adds the
 * standard Node process metrics (heap, event loop lag, GC, etc.) prom-client ships with. */
export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests handled, by route and status code.",
  labelNames: ["method", "route", "status"] as const,
  registers: [metricsRegistry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds, by route and status code.",
  labelNames: ["method", "route", "status"] as const,
  // NFR-02 targets p95<=400ms/p99<=1s for ordinary queries — buckets chosen to resolve
  // that range precisely rather than a generic log scale.
  buckets: [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.75, 1, 2, 5],
  registers: [metricsRegistry],
});

export const rateLimitRejectedTotal = new Counter({
  name: "rate_limit_rejected_total",
  help: "Requests rejected by RateLimitGuard, by keyPrefix.",
  labelNames: ["keyPrefix"] as const,
  registers: [metricsRegistry],
});

/** Phase 7 Sprint 7.3 — `pg.Pool` exposes these as plain synchronous getters (no query
 * needed), so a `collect` callback (invoked fresh on every scrape) is enough — no interval
 * timer to manage. Call once at bootstrap with the app's actual runtime pool
 * (`getAppPool()`, not the migration-owner one). */
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
