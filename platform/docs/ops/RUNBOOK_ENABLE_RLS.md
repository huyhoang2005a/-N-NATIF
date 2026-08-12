# Runbook — Enabling Row-Level Security (RLS)

Status as of Phase 7 Sprint 7.1: **prepared, not enabled**. This is a deliberate scope
decision (confirmed with the project owner) — see `docs/ops/enable-rls.sql`'s header
comment for why. This document is the procedure for actually flipping it on later, once the
one real blocking prerequisite below is done.

## The one hard blocker: transaction-per-request

`docs/ops/enable-rls.sql`'s policies key off two Postgres session variables:
`app.current_user_id` and `app.current_org_id`, set via `SET LOCAL` at the start of a
transaction. Today, `apps/api` and `apps/worker` share one connection pool
(`packages/database/src/client.ts`'s `getAppDb()`) and most repository calls run as a
single bare statement, **not** wrapped in an explicit transaction. `SET LOCAL` only has
transaction-scoped lifetime — issuing it outside a transaction behaves like `SET SESSION`,
which persists on that pooled connection until something resets it. On a connection pool,
the next unrelated request can be handed that same connection and silently inherit the
**previous request's actor identity** for RLS purposes. That is a cross-tenant identity
leak — the exact failure mode RLS exists to prevent.

Before enabling RLS anywhere with real traffic, every request into `apps/api` must run
inside one transaction that:
1. Begins.
2. Runs `SET LOCAL app.current_user_id = '<actor.userId>'` and
   `SET LOCAL app.current_org_id = '<actor's active org, if any>'` as the very first
   statements.
3. Runs the rest of that request's queries through that same transaction (a request-scoped
   Drizzle client — e.g. NestJS `REQUEST`-scoped provider or `AsyncLocalStorage`, not the
   global singleton `DATABASE` provider used today).
4. Commits (or rolls back on error) at the end of the request.

This touches every one of the ~8 bounded contexts in `apps/api` and is, by a wide margin,
the largest single refactor this codebase has undergone — bigger than any Phase 1–6 sprint.
It needs its own dedicated planning pass, not a rider on top of Phase 7. Do not enable RLS
against a real environment until this is done and has its own regression pass.

## Prerequisites checklist

- [ ] `manual-migrations/0012_phase7_app_role_grants.sql` applied (creates `r2m_app`,
      confirmed non-superuser: `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE
      rolname='r2m_app'` must return `f, f`).
- [ ] `apps/api`/`apps/worker` connect via `APP_DATABASE_URL` (the `r2m_app` role), not
      `DATABASE_URL` — confirmed in Phase 7 Sprint 7.1.
- [ ] **Transaction-per-request refactor above is done and regression-tested.**
- [ ] `packages/database/src/rls.integration.spec.ts` passes (proves the policies
      themselves are correct in isolation — already true today, doesn't depend on the
      transaction-per-request refactor).

## Enabling

1. Take a fresh backup first (`infra/scripts/backup-db.sh`).
2. Apply `docs/ops/enable-rls.sql` directly against the target database as the owner role
   (`r2m`), e.g.:
   ```
   psql "$DATABASE_URL" -f docs/ops/enable-rls.sql
   ```
   This is a deliberate one-time manual step, not part of `pnpm migrate` — see the file's
   header comment for why.
3. Restart `apps/api` and `apps/worker` so every connection is fresh.
4. Run the cross-tenant smoke test below before declaring it live.

## Verifying after enabling

Log in as two users in two different organizations (any two demo accounts from
`docs/ops/` or the seed data work). For each of the 4 covered tables
(`research_need`, `resource`, `technology_case`, `evidence`):
- User A's own org/case-scoped rows: still visible, still writable.
- User A hitting user B's PRIVATE-scoped rows directly by ID (e.g.
  `GET /technology-cases/<user B's case id>`): must now 404/403, not just at the
  application-authz layer (which already blocks this) but confirm via `EXPLAIN` or a direct
  `psql` session as `r2m_app` with the session vars set to user A's identity that the row
  genuinely isn't in the result set at the SQL level.
- A `PUBLIC`-visibility row from user B's org: still visible to user A (proves the policy
  isn't over-blocking).

If anything unexpectedly returns empty that used to return data, RLS is very likely blocking
a request whose session variables weren't set correctly (i.e. the transaction-per-request
wiring has a gap) — treat this as the RLS-specific incident class described in
`docs/ops/INCIDENT_RESPONSE_RUNBOOK.md`, not a business-logic bug.

## Rolling back

`docs/ops/enable-rls.sql`'s trailing comment block has the exact `DROP POLICY`/
`DISABLE ROW LEVEL SECURITY` statements. Run them (as `r2m`), restart both apps.
RLS being off is always a safe fallback state — application-layer authorization (the
`ActorContext`/`CurrentActor` checks already in every service) remains the primary access
control regardless of RLS; RLS is defense-in-depth on top of it, never the only layer.
