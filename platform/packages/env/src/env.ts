import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  // Phase 7 Sprint 7.3 — apps/worker has no HTTP server otherwise; this exists solely to
  // serve GET /metrics for Prometheus to scrape.
  WORKER_METRICS_PORT: z.coerce.number().int().positive().default(9200),
  // Phase 7 Sprint 7.3 — OTLP collector endpoint (Jaeger's OTLP HTTP receiver locally).
  // Optional: when unset, OpenTelemetry instrumentation is not initialized at all (no
  // tracing overhead in environments that don't run the observability stack).
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().min(1).optional(),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Phase 7 Sprint 7.1 — apps/api and apps/worker's runtime connection, using the
  // non-superuser `r2m_app` role (see manual-migrations/0012_phase7_app_role_grants.sql).
  // Optional, falls back to DATABASE_URL so an unset value doesn't break existing local
  // setups; `migrate`/`seed` always use DATABASE_URL (the `r2m` owner role) directly.
  APP_DATABASE_URL: z.string().min(1).optional(),

  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_VERIFICATION_BUCKET: z.string().min(1),
  S3_RESOURCE_BUCKET: z.string().min(1),
  S3_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  // Phase 7 Sprint 7.4 — malware scan (packages/file-safety talks to clamd's INSTREAM
  // protocol directly over this host:port).
  CLAMAV_HOST: z.string().min(1).default("localhost"),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 chars"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 chars"),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),

  // --- Email (Resend) — optional so the worker can fall back to a console-logging
  // EmailSender until RESEND_API_KEY is filled in (see apps/worker/src/main.ts). ---
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM_ADDRESS: z.string().email().optional(),
  EMAIL_FROM_NAME: z.string().min(1).optional(),
  WEB_APP_URL: z.string().min(1).default("http://localhost:3001"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

/**
 * Parses and validates process.env once per process. Fails fast on boot instead of
 * surfacing missing-config errors deep inside a request handler.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

export function resetEnvCacheForTests(): void {
  cachedEnv = undefined;
}
