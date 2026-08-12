import { SpanStatusCode, context, propagation, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("r2m-worker");

/** Phase 7 Sprint 7.3 — when `traceparent` is present (captured by the API at
 * `OutboxService.append()` time via `getCurrentTraceparent()`), extracts the W3C trace
 * context and starts this span as a child of the original API request's trace, so Jaeger
 * shows "API request → outbox insert → (async gap) → worker processing" as one connected
 * trace instead of two unrelated ones. A no-op passthrough (no span at all) when tracing
 * isn't active or the event carries no `traceparent` — same behavior either way from the
 * caller's perspective, just without a span wrapping it. */
export async function withLinkedSpan<T>(traceparent: string | null, spanName: string, fn: () => Promise<T>): Promise<T> {
  if (!traceparent) return fn();

  const parentContext = propagation.extract(context.active(), { traceparent });
  return context.with(parentContext, async () => {
    const span = tracer.startSpan(spanName);
    try {
      return await context.with(trace.setSpan(context.active(), span), fn);
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      span.end();
    }
  });
}
