CREATE TABLE "author_follow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_user_id" uuid NOT NULL,
	"followed_author_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_follow" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_user_id" uuid NOT NULL,
	"followed_organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "author_follow" ADD CONSTRAINT "author_follow_follower_user_id_user_account_id_fk" FOREIGN KEY ("follower_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_follow" ADD CONSTRAINT "author_follow_followed_author_user_id_user_account_id_fk" FOREIGN KEY ("followed_author_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_follow" ADD CONSTRAINT "organization_follow_follower_user_id_user_account_id_fk" FOREIGN KEY ("follower_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_follow" ADD CONSTRAINT "organization_follow_followed_organization_id_organization_id_fk" FOREIGN KEY ("followed_organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_author_follow_follower_author" ON "author_follow" USING btree ("follower_user_id","followed_author_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_organization_follow_follower_org" ON "organization_follow" USING btree ("follower_user_id","followed_organization_id");