import type { Database } from "@r2m/database";
import { sql } from "drizzle-orm";

const PHASE1_TABLES = [
  "verification_document",
  "organization_verification_request",
  "organization_member",
  "organization_domain",
  "organization",
  "idempotency_key",
  "audit_log",
  "outbox_event",
  "notification",
  "user_profile",
  "user_identity",
  "user_account",
] as const;

/** Truncates every Phase 1 table between integration tests. CASCADE handles FK order. */
export async function resetDatabase(db: Database): Promise<void> {
  const tableList = PHASE1_TABLES.join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`));
}
