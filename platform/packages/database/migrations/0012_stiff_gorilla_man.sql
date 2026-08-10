CREATE TABLE "content_flag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_user_id" uuid NOT NULL,
	"target_type" "moderation_target_type" NOT NULL,
	"target_resource_id" uuid,
	"target_annotation_id" uuid,
	"target_technology_profile_id" uuid,
	"reason_code" varchar(100) NOT NULL,
	"details" text NOT NULL,
	"status" "content_flag_status" DEFAULT 'PENDING' NOT NULL,
	"assigned_reviewer_user_id" uuid,
	"hidden_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_flag_id" uuid NOT NULL,
	"reviewer_user_id" uuid NOT NULL,
	"action" "moderation_action" NOT NULL,
	"rationale" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_flag" ADD CONSTRAINT "content_flag_reporter_user_id_user_account_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_flag" ADD CONSTRAINT "content_flag_target_resource_id_resource_id_fk" FOREIGN KEY ("target_resource_id") REFERENCES "public"."resource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_flag" ADD CONSTRAINT "content_flag_target_annotation_id_annotation_id_fk" FOREIGN KEY ("target_annotation_id") REFERENCES "public"."annotation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_flag" ADD CONSTRAINT "content_flag_target_technology_profile_id_technology_profile_id_fk" FOREIGN KEY ("target_technology_profile_id") REFERENCES "public"."technology_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_flag" ADD CONSTRAINT "content_flag_assigned_reviewer_user_id_user_account_id_fk" FOREIGN KEY ("assigned_reviewer_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_decision" ADD CONSTRAINT "moderation_decision_content_flag_id_content_flag_id_fk" FOREIGN KEY ("content_flag_id") REFERENCES "public"."content_flag"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_decision" ADD CONSTRAINT "moderation_decision_reviewer_user_id_user_account_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_content_flag_status_created" ON "content_flag" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_content_flag_assigned_reviewer" ON "content_flag" USING btree ("assigned_reviewer_user_id");--> statement-breakpoint
CREATE INDEX "idx_moderation_decision_flag_created" ON "moderation_decision" USING btree ("content_flag_id","created_at");