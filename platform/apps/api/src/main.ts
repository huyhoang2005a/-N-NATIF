import "reflect-metadata";
import { loadEnv } from "@r2m/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
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
