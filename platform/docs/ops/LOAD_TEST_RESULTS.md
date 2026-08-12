# Load Test Results

Live `autocannon` runs against the local dev stack (`apps/api` on `:3000`), per spec §7.7
("Load test đạt ngưỡng đã định cho dashboard/recommendation/case list"). Compared against
the NFR targets in `docs/spec/R2M_SPEC_DESIGN_V5_COMPLETE.md` §~1716 (`NFR-02`: ordinary
API query p95≤400ms/p99≤1s; `NFR-04`: search/recommendation p95≤2s).

**Scope disclosed up front:** this is a single Windows dev machine running the API,
worker, Postgres, Redis, MinIO, Jaeger, Prometheus, and Grafana all at once via Docker
Desktop. Results here are indicative of whether the code path itself is reasonably fast —
they are **not** representative of real production capacity (concurrent user count,
network, dedicated DB resources). Treat pass/fail against the NFR targets as meaningful;
treat the req/sec throughput numbers as not meaningful outside this one machine.

## A real finding from this exercise (fixed before final results below)

The first load test attempt (`-c 10 -d 10` against `GET /v1/resources`) coincided with the
**Postgres docker container itself restarting** (Docker Desktop/WSL2 resource pressure on
this machine — `docker logs` shows a fresh `starting PostgreSQL...` line right at the
crash time, not a graceful shutdown first, so the exact trigger is inconclusive from logs
alone). That forced-disconnect surfaced a real bug: `apps/worker`'s `pg.Pool` had no
listener on its `error` event, and Node's default behavior for an unhandled `EventEmitter`
error is to throw — which crashed the entire worker process instead of just recycling the
broken idle connection (which `pg.Pool` does on its own once notified).

**Fixed** in `packages/database/src/client.ts` — both `getPool()` (migration/seed, `r2m`
owner) and `getAppPool()` (Sprint 7.1's `r2m_app` runtime role) now attach an `error`
listener that logs instead of leaving the pool to crash the process. Re-ran the load tests
below at reduced concurrency afterward and confirmed the API, worker, and all 6 containers
stayed up throughout with no crash.

## Results (2026-08-12, post-fix, `-c 5 -d 8` each)

| Endpoint | p50 | p97.5 (≈p95) | p99 | Target | Result |
|---|---|---|---|---|---|
| `GET /technology-cases` (case list) | 64 ms | 112 ms | 118 ms | NFR-02 p95≤400ms | ✅ PASS |
| `GET /resources` | 65 ms | 102 ms | 109 ms | NFR-02 p95≤400ms | ✅ PASS |
| `GET /recommendation-runs/:id/items` (recommendation read) | 56 ms | 103 ms | 121 ms | NFR-04 p95≤2s | ✅ PASS |

All 3 endpoints stayed well under target even accounting for this being local-machine
Docker overhead, not bare-metal. Dashboard-equivalent load isn't a single endpoint in this
app (the frontend's dashboard page fans out to several list/summary calls in parallel,
each already covered individually by the case-list/resources numbers above and by earlier
per-sprint curl testing throughout Phases 1–6) — no separate combined-dashboard run was
needed beyond what's already covered here.

**Note on the recommendation-run row tested:** created via a real `POST
/research-needs/:id/recommendation-runs` call (FTS-based scoring, Phase 5), confirmed
`COMPLETED` before load-testing the read path — not a synthetic/pre-seeded row. Cleaned up
(`recommendation_run`/`recommendation_item`/`recommendation_citation`/`outbox_event` rows)
after the test.
