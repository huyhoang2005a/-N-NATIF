CREATE TYPE "public"."content_flag_status" AS ENUM('PENDING', 'IN_REVIEW', 'CLOSED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."moderation_action" AS ENUM('KEEP', 'HIDE', 'REMOVE', 'RESTRICT_AUTHOR', 'RESTORE');--> statement-breakpoint
CREATE TYPE "public"."moderation_target_type" AS ENUM('RESOURCE', 'ANNOTATION', 'TECHNOLOGY_PROFILE');--> statement-breakpoint
CREATE TYPE "public"."transfer_manifest_status" AS ENUM('DRAFT', 'READY', 'SHARED', 'EXPIRED', 'REVOKED');--> statement-breakpoint
CREATE TABLE "transfer_manifest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technology_case_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" "transfer_manifest_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"generated_at" timestamp with time zone,
	"shared_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfer_manifest_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_manifest_id" uuid NOT NULL,
	"resource_version_id" uuid NOT NULL,
	"location_url_snapshot" text NOT NULL,
	"checksum_sha256" varchar(64),
	"permission" "access_permission" DEFAULT 'VIEW' NOT NULL,
	"metadata_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfer_recipient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_manifest_id" uuid NOT NULL,
	"recipient_organization_id" uuid,
	"recipient_user_id" uuid,
	"permission" "access_permission" DEFAULT 'VIEW' NOT NULL,
	"expires_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resource_access_grant" ADD COLUMN "source_transfer_manifest_id" uuid;--> statement-breakpoint
ALTER TABLE "transfer_manifest" ADD CONSTRAINT "transfer_manifest_technology_case_id_technology_case_id_fk" FOREIGN KEY ("technology_case_id") REFERENCES "public"."technology_case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_manifest" ADD CONSTRAINT "transfer_manifest_created_by_user_id_user_account_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_manifest_item" ADD CONSTRAINT "transfer_manifest_item_transfer_manifest_id_transfer_manifest_id_fk" FOREIGN KEY ("transfer_manifest_id") REFERENCES "public"."transfer_manifest"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_manifest_item" ADD CONSTRAINT "transfer_manifest_item_resource_version_id_resource_version_id_fk" FOREIGN KEY ("resource_version_id") REFERENCES "public"."resource_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_recipient" ADD CONSTRAINT "transfer_recipient_transfer_manifest_id_transfer_manifest_id_fk" FOREIGN KEY ("transfer_manifest_id") REFERENCES "public"."transfer_manifest"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_recipient" ADD CONSTRAINT "transfer_recipient_recipient_organization_id_organization_id_fk" FOREIGN KEY ("recipient_organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_recipient" ADD CONSTRAINT "transfer_recipient_recipient_user_id_user_account_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_transfer_manifest_case_version" ON "transfer_manifest" USING btree ("technology_case_id","version_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_transfer_manifest_item_manifest_version" ON "transfer_manifest_item" USING btree ("transfer_manifest_id","resource_version_id");--> statement-breakpoint
ALTER TABLE "resource_access_grant" ADD CONSTRAINT "resource_access_grant_source_transfer_manifest_id_transfer_manifest_id_fk" FOREIGN KEY ("source_transfer_manifest_id") REFERENCES "public"."transfer_manifest"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_resource_access_grant_source_manifest" ON "resource_access_grant" USING btree ("source_transfer_manifest_id");