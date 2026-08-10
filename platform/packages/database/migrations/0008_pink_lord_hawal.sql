CREATE TABLE "content_save" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"saver_user_id" uuid NOT NULL,
	"resource_id" uuid,
	"research_need_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_save" ADD CONSTRAINT "content_save_saver_user_id_user_account_id_fk" FOREIGN KEY ("saver_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_save" ADD CONSTRAINT "content_save_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_save" ADD CONSTRAINT "content_save_research_need_id_research_need_id_fk" FOREIGN KEY ("research_need_id") REFERENCES "public"."research_need"("id") ON DELETE no action ON UPDATE no action;