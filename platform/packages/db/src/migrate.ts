import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { closeDb, getDb, getPool } from "./client";

const MANUAL_MIGRATIONS_DIR = join(__dirname, "..", "manual-migrations");

async function applyManualMigrations(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _manual_migration (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const files = readdirSync(MANUAL_MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const { rows } = await pool.query("SELECT 1 FROM _manual_migration WHERE name = $1", [file]);
    if (rows.length > 0) {
      console.log(`[manual-migrations] skip ${file} (already applied)`);
      continue;
    }
    console.log(`[manual-migrations] applying ${file}`);
    const sql = readFileSync(join(MANUAL_MIGRATIONS_DIR, file), "utf-8");
    await pool.query(sql);
    await pool.query("INSERT INTO _manual_migration (name) VALUES ($1)", [file]);
  }
}

async function main(): Promise<void> {
  console.log("[migrate] applying drizzle-kit baseline migrations");
  await migrate(getDb(), { migrationsFolder: join(__dirname, "..", "migrations") });

  console.log("[migrate] applying hand-written constraint migrations");
  await applyManualMigrations();

  console.log("[migrate] done");
  await closeDb();
}

main().catch((error) => {
  console.error("[migrate] failed", error);
  process.exitCode = 1;
});
