import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
    // *.integration.spec.ts needs a live DB/Redis/S3 connection and (per rls.integration.
    // spec.ts) tables that only exist after `pnpm db:migrate` — CI runs migrations AFTER
    // this plain `pnpm test` step, and this task has no `passThroughEnv` for the real
    // connection env vars (unlike `test:integration` in turbo.json). Excluded here so it's
    // only ever picked up via each package's own `test:integration` script/config, same
    // convention as apps/api's vitest.integration.config.ts.
    exclude: ["src/**/*.integration.spec.ts"],
  },
});
