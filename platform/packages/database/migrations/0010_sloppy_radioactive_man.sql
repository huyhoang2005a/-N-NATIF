CREATE TABLE "expertise_endorsement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endorser_user_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"tag" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expertise_endorsement" ADD CONSTRAINT "expertise_endorsement_endorser_user_id_user_account_id_fk" FOREIGN KEY ("endorser_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expertise_endorsement" ADD CONSTRAINT "expertise_endorsement_author_user_id_user_account_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_expertise_endorsement_endorser_author_tag" ON "expertise_endorsement" USING btree ("endorser_user_id","author_user_id","tag");