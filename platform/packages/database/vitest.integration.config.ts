import { defineConfig } from "vitest/config";

/**
 * Separate from the root `vitest.config.ts` (which excludes `src/**\/*.integration.spec.ts`
 * precisely so it's only ever run through this config) — same split as apps/api's
 * `vitest.integration.config.ts`. `rls.integration.spec.ts` needs a live Postgres
 * connection and tables that only exist after `pnpm db:migrate`, which is why this is a
 * distinct `test:integration` script/task (turbo.json already passes the real DB/Redis/S3
 * env vars through to `test:integration`, and CI runs migrations before it) rather than
 * folded into the plain `pnpm test` step.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.spec.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
