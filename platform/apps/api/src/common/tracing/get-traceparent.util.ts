import { context, propagation } from "@opentelemetry/api";

/** Phase 7 Sprint 7.3 — captures the current request's W3C `traceparent` (if tracing is
 * active; `undefined` when `OTEL_EXPORTER_OTLP_ENDPOINT` isn't set, since no SDK ran to
 * create a span in the first place) so it can be stored on `outbox_event.traceparent` and
 * later used by the worker to link its processing span back to this request's trace. */
export function getCurrentTraceparent(): string | undefined {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier.traceparent;
}
