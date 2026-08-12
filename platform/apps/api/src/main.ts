import "./tracing";
import "reflect-metadata";
import { loadEnv } from "@r2m/env";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  // Phase 7 Sprint 7.3 — buffer logs until the pino Logger (registered by LoggerModule in
  // AppModule) is ready, then switch Nest's own internal logging over to it too, so
  // framework logs ("Nest application successfully started" etc.) come out as the same
  // structured JSON as request logs, not a separate unstructured console.log stream.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // apps/web runs on a separate port in local dev (Next.js dev server can't share :3000
  // with the API) — allow cross-origin requests so the browser doesn't block them.
  app.enableCors();
  app.setGlobalPrefix("v1");
  await app.listen(env.API_PORT);
  console.log(`[api] listening on :${env.API_PORT} (v1)`);
}

bootstrap().catch((error) => {
  console.error("[api] failed to start", error);
  process.exit(1);
});
