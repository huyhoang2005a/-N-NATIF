import { getDb } from "@r2m/database";
import { Global, Module } from "@nestjs/common";

export const DATABASE = Symbol("DATABASE");

@Global()
@Module({
  providers: [{ provide: DATABASE, useFactory: () => getDb() }],
  exports: [DATABASE],
})
export class DatabaseModule {}
