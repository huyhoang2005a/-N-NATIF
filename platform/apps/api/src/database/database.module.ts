import { getAppDb } from "@r2m/database";
import { Global, Module } from "@nestjs/common";

export const DATABASE = Symbol("DATABASE");

/** Phase 7 Sprint 7.1 — runs as `r2m_app` (non-superuser, narrower grants than the
 * migration-owner role `r2m`), via `getAppDb()`. */
@Global()
@Module({
  providers: [{ provide: DATABASE, useFactory: () => getAppDb() }],
  exports: [DATABASE],
})
export class DatabaseModule {}
