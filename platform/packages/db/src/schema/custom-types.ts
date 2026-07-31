import { customType } from "drizzle-orm/pg-core";

/**
 * PostgreSQL `citext` (case-insensitive text) — used for email and domain columns so
 * uniqueness checks are case-insensitive at the database layer, matching the dbml spec.
 * Requires `CREATE EXTENSION citext` (applied in migrations/0002_v5_constraints.sql).
 */
export const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});
