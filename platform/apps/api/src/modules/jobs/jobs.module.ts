import { Module } from "@nestjs/common";
import { IdempotencyService } from "./idempotency.service";
import { OutboxService } from "./outbox.service";

@Module({
  providers: [OutboxService, IdempotencyService],
  exports: [OutboxService, IdempotencyService],
})
export class JobsModule {}
