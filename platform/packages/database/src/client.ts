import { loadEnv } from "@r2m/env";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;
let db: Database | undefined;
let appPool: Pool | undefined;
let appDb: Database | undefined;

/** Phase 7 Sprint 7.4 — found live during load testing: `pg.Pool` emits `error` on any
 * *idle* client that drops (network blip, Postgres restart, `pg_terminate_backend`, etc.).
 * Node's default behavior for an `EventEmitter`'s `error` event with no listener is to
 * throw, which crashed the whole worker process. The pool recycles the broken client on
 * its own; logging here (not swallowing silently) is enough — the crash was the bug, not
 * the disconnect itself. */
function attachErrorHandler(target: Pool, label: string): void {
  target.on("error", (error) => {
    console.error(`[db] idle pool client error (${label}):`, error);
  });
}

export function getPool(): Pool {
  if (!pool) {
    const env = loadEnv();
    pool = new Pool({ connectionString: env.DATABASE_URL });
    attachErrorHandler(pool, "owner");
  }
  return pool;
}

export function getDb(): Database {
  if (!db) {
    db = drizzle(getPool(), { schema });
  }
  return db;
}

/** Phase 7 Sprint 7.1 — apps/api and apps/worker's runtime connection pool, using the
 * non-superuser `r2m_app` role via `APP_DATABASE_URL` (falls back to `DATABASE_URL` if
 * unset). Migration/seed scripts must keep using `getDb()`/`getPool()` (the `r2m` owner
 * role) since only that role can run DDL and GRANT statements. */
export function getAppPool(): Pool {
  if (!appPool) {
    const env = loadEnv();
    appPool = new Pool({ connectionString: env.APP_DATABASE_URL ?? env.DATABASE_URL });
    attachErrorHandler(appPool, "app");
  }
  return appPool;
}

export function getAppDb(): Database {
  if (!appDb) {
    appDb = drizzle(getAppPool(), { schema });
  }
  return appDb;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  db = undefined;
  await appPool?.end();
  appPool = undefined;
  appDb = undefined;
}
