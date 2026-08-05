import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/**
 * Separate from the root `vitest.config.ts` (which only picks up `src/**\/*.spec.ts` —
 * fast, mock-DI unit tests, no external services). This config is for
 * `test/**\/*.integration-spec.ts`: boots the real Nest DI container (`Test.
 * createTestingModule({ imports: [AppModule] })`) against real Postgres/Redis/MinIO
 * (see infra/docker/docker-compose.yml). Run explicitly via `pnpm test:integration` —
 * never picked up by plain `pnpm test` (different file suffix, different config file).
 *
 * `swc()` plugin (đã ghi lại lý do đầy đủ ở README §4 bug #8): Vitest's default esbuild
 * transform does not reliably emit `design:paramtypes` decorator metadata, which real
 * NestJS DI (via `Reflector.getAllAndOverride` etc.) depends on at request time — this
 * is the exact same class of problem as bug #3 (esbuild vs NestJS decorator metadata),
 * just surfacing here instead of in the `tsx` dev server. `legacyDecorator` +
 * `decoratorMetadata` below are the 2 flags NestJS's own DI requires; without them,
 * `Test.createTestingModule(...).compile()` still succeeds (module resolution doesn't
 * need runtime metadata) but any guard/interceptor that reads constructor-injected
 * providers at request time silently gets `undefined`. Deliberately scoped to THIS
 * config only — `vitest.config.ts` (unit tests) manually `new Service(...)` and never
 * go through Nest's reflection-based DI, so it doesn't need this and stays on the
 * faster esbuild default.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.integration-spec.ts"],
    // Real DB/HTTP round-trips are slower than mocked unit tests, and app.init() itself
    // resolves the entire DI graph — give both more headroom than Vitest's 5s default.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Integration specs share one real Postgres — run files serially to avoid two
    // specs racing resetDatabase() against each other.
    fileParallelism: false,
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: "es2022",
        keepClassNames: true,
      },
      module: { type: "es6" },
      sourceMaps: true,
    }),
  ],
});
