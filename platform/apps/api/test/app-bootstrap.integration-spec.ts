import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";

/**
 * Highest-value test in this suite (see README §4/§5 bug log — bug #5 and #7 were both
 * pure DI/config wiring defects invisible to unit tests, which construct services
 * manually with `new Service(...)` and never touch the real Nest DI container). This
 * test boots the ENTIRE app through `Test.createTestingModule({ imports: [AppModule] })`
 * — the same graph resolution `NestFactory.create(AppModule)` does in `main.ts` — and
 * asserts only that it doesn't throw. No endpoint calls needed: if a module forgets to
 * `exports` a provider another module needs (bug #5), or a global guard/provider can't
 * be constructed, `app.init()` throws here before any HTTP request would even be
 * possible. Automatically covers every module registered in `AppModule`, present and
 * future — Phase 4's new modules get this check for free just by being added to
 * `app.module.ts`.
 */
describe("App bootstrap (integration)", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("resolves the full DI graph and boots without throwing", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();

    // If init() throws (missing `exports`, unresolved provider, etc.) the test fails
    // naturally — no assertion needed beyond "this didn't throw".
    await app.init();

    expect(app.getHttpServer()).toBeDefined();
  });
});
