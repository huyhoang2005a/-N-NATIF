/**
 * Phase 7 Sprint 7.3 — MUST be the first import in main.ts, before "reflect-metadata" and
 * everything else. OpenTelemetry's Node auto-instrumentation works by monkey-patching
 * modules (`http`, `pg`, ...) the moment they're `require()`'d for the first time; if
 * anything imports them before this file runs, those call sites are never instrumented.
 *
 * No-ops (does not start the SDK at all) when `OTEL_EXPORTER_OTLP_ENDPOINT` is unset — so
 * environments that don't run the observability stack (Jaeger) pay zero tracing overhead
 * and don't fail trying to reach a collector that isn't there.
 */
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (endpoint) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: "r2m-api" }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
  process.on("SIGTERM", () => void sdk.shutdown());
}
