ALTER TABLE "outbox_event" ADD COLUMN "request_id" varchar(100);--> statement-breakpoint
ALTER TABLE "outbox_event" ADD COLUMN "traceparent" varchar(100);