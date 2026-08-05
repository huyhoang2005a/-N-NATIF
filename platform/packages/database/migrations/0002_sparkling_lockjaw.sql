CREATE TYPE "public"."case_member_role" AS ENUM('OWNER', 'TECHNICAL_MEMBER', 'CASE_REVIEWER', 'PARTNER_MEMBER', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."case_organization_role" AS ENUM('OWNING_ORGANIZATION', 'PARTNER_COMPANY', 'REVIEW_ORGANIZATION', 'SUPPORT_ORGANIZATION');--> statement-breakpoint
CREATE TYPE "public"."case_origin_type" AS ENUM('MANUAL', 'DISCOVERY_RECOMMENDATION', 'RESEARCH_PROPOSAL', 'IMPORT');--> statement-breakpoint
CREATE TYPE "public"."evidence_status" AS ENUM('ACTIVE', 'SUPERSEDED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."technology_case_status" AS ENUM('DRAFT', 'EVIDENCE_COLLECTION', 'UNDER_ASSESSMENT', 'GAP_IDENTIFIED', 'ROADMAP_DRAFT', 'ROADMAP_APPROVED', 'PILOT_READY', 'TRANSFER_READY', 'COMMERCIALIZED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."visibility_level" AS ENUM('PUBLIC', 'ORGANIZATION_ONLY', 'PARTNERS_ONLY', 'PRIVATE');--> statement-breakpoint
CREATE TABLE "case_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technology_case_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "case_member_role" NOT NULL,
	"status" "membership_status" DEFAULT 'ACTIVE' NOT NULL,
	"invited_by_user_id" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technology_case_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "case_organization_role" NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "case_origin" (
	"technology_case_id" uuid PRIMARY KEY NOT NULL,
	"origin_type" "case_origin_type" NOT NULL,
	"imported_source_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technology_case_id" uuid NOT NULL,
	"from_status" "technology_case_status",
	"to_status" "technology_case_status" NOT NULL,
	"changed_by_user_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technology_case_id" uuid NOT NULL,
	"resource_version_id" uuid NOT NULL,
	"annotation_id" uuid,
	"title" varchar(255) NOT NULL,
	"claim" text NOT NULL,
	"relevance_note" text NOT NULL,
	"status" "evidence_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_citation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_id" uuid NOT NULL,
	"citation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technology_case" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owning_organization_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(180) NOT NULL,
	"description" text,
	"lifecycle_status" "technology_case_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technology_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technology_case_id" uuid NOT NULL,
	"summary" text,
	"value_proposition" text,
	"target_market" text,
	"maturity_level" varchar(100),
	"deployment_context" text,
	"licensing_notes" text,
	"visibility" "visibility_level" DEFAULT 'PRIVATE' NOT NULL,
	"moderation_status" "content_moderation_status" DEFAULT 'ACTIVE' NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "technology_profile_technology_case_id_unique" UNIQUE("technology_case_id")
);
--> statement-breakpoint
ALTER TABLE "case_member" ADD CONSTRAINT "case_member_technology_case_id_technology_case_id_fk" FOREIGN KEY ("technology_case_id") REFERENCES "public"."technology_case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_member" ADD CONSTRAINT "case_member_user_id_user_account_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_member" ADD CONSTRAINT "case_member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_member" ADD CONSTRAINT "case_member_invited_by_user_id_user_account_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_organization" ADD CONSTRAINT "case_organization_technology_case_id_technology_case_id_fk" FOREIGN KEY ("technology_case_id") REFERENCES "public"."technology_case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_organization" ADD CONSTRAINT "case_organization_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_origin" ADD CONSTRAINT "case_origin_technology_case_id_technology_case_id_fk" FOREIGN KEY ("technology_case_id") REFERENCES "public"."technology_case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_technology_case_id_technology_case_id_fk" FOREIGN KEY ("technology_case_id") REFERENCES "public"."technology_case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_changed_by_user_id_user_account_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_technology_case_id_technology_case_id_fk" FOREIGN KEY ("technology_case_id") REFERENCES "public"."technology_case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_resource_version_id_resource_version_id_fk" FOREIGN KEY ("resource_version_id") REFERENCES "public"."resource_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_annotation_id_annotation_id_fk" FOREIGN KEY ("annotation_id") REFERENCES "public"."annotation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_created_by_user_id_user_account_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_citation" ADD CONSTRAINT "evidence_citation_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_citation" ADD CONSTRAINT "evidence_citation_citation_id_citation_id_fk" FOREIGN KEY ("citation_id") REFERENCES "public"."citation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technology_case" ADD CONSTRAINT "technology_case_owning_organization_id_organization_id_fk" FOREIGN KEY ("owning_organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technology_case" ADD CONSTRAINT "technology_case_created_by_user_id_user_account_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technology_profile" ADD CONSTRAINT "technology_profile_technology_case_id_technology_case_id_fk" FOREIGN KEY ("technology_case_id") REFERENCES "public"."technology_case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technology_profile" ADD CONSTRAINT "technology_profile_updated_by_user_id_user_account_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_case_member_case_user" ON "case_member" USING btree ("technology_case_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_case_member_case_role_status" ON "case_member" USING btree ("technology_case_id","role","status");--> statement-breakpoint
CREATE INDEX "idx_case_member_user_status" ON "case_member" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_case_organization_case_org_role" ON "case_organization" USING btree ("technology_case_id","organization_id","role");--> statement-breakpoint
CREATE INDEX "idx_case_organization_org_role" ON "case_organization" USING btree ("organization_id","role");--> statement-breakpoint
CREATE INDEX "idx_case_status_history_case_created" ON "case_status_history" USING btree ("technology_case_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_evidence_case_status" ON "evidence" USING btree ("technology_case_id","status");--> statement-breakpoint
CREATE INDEX "idx_evidence_resource_version" ON "evidence" USING btree ("resource_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_evidence_citation_evidence_citation" ON "evidence_citation" USING btree ("evidence_id","citation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_technology_case_owning_org_slug" ON "technology_case" USING btree ("owning_organization_id","slug");--> statement-breakpoint
CREATE INDEX "idx_technology_case_owning_org_status" ON "technology_case" USING btree ("owning_organization_id","lifecycle_status");