/** `GET /platform/outbox-events` + `POST /platform/outbox-events/:id/retry` (admin-only,
 * 2026-08-16). `outbox_event` was write-only from the API side (the worker's dispatcher
 * reads it independently) — a DEAD_LETTER row (5 failed delivery attempts) was permanent
 * until this, with zero visibility beyond direct DB access or the Prometheus counter. */
export interface OutboxEventResponse {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  status: string;
  attemptCount: number;
  lastError: string | null;
  availableAt: string;
  publishedAt: string | null;
  createdAt: string;
}
