CREATE TYPE "public"."case_initiation_status" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."recommendation_item_status" AS ENUM('ACTIVE', 'DISMISSED', 'SELECTED');--> statement-breakpoint
CREATE TYPE "public"."recommendation_run_status" AS ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."recommendation_run_type" AS ENUM('FOCUSED', 'FEED');--> statement-breakpoint
CREATE TYPE "public"."research_need_status" AS ENUM('DRAFT', 'OPEN', 'PAUSED', 'CLOSED', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "case_initiation_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recommendation_item_id" uuid NOT NULL,
	"requesting_organization_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"target_author_user_id" uuid NOT NULL,
	"target_organization_id" uuid NOT NULL,
	"status" "case_initiation_status" DEFAULT 'PENDING' NOT NULL,
	"message" text,
	"response_note" text,
	"responded_by_user_id" uuid,
	"responded_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_profile" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"public_slug" varchar(160) NOT NULL,
	"industry_code" varchar(100),
	"company_size" varchar(50),
	"description" text,
	"contact_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_profile_public_slug_unique" UNIQUE("public_slug")
);
--> statement-breakpoint
CREATE TABLE "need_statement_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"research_need_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"problem_statement" text NOT NULL,
	"technical_field" varchar(150) NOT NULL,
	"desired_output_type" varchar(100) NOT NULL,
	"timeframe_months" integer,
	"constraints" text,
	"success_criteria" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_citation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recommendation_item_id" uuid NOT NULL,
	"citation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recommendation_run_id" uuid NOT NULL,
	"resource_version_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"match_score" numeric(6, 5) NOT NULL,
	"rationale" text NOT NULL,
	"status" "recommendation_item_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"research_need_id" uuid,
	"need_statement_version_id" uuid,
	"company_organization_id" uuid,
	"run_type" "recommendation_run_type" DEFAULT 'FOCUSED' NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"status" "recommendation_run_status" DEFAULT 'QUEUED' NOT NULL,
	"model_provider" varchar(100),
	"model_name" varchar(150),
	"prompt_version" varchar(100),
	"model_parameters" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_code" varchar(100),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_need" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_organization_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"visibility" "visibility_level" DEFAULT 'PRIVATE' NOT NULL,
	"status" "research_need_status" DEFAULT 'DRAFT' NOT NULL,
	"published_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_proposal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"research_need_id" uuid NOT NULL,
	"need_statement_version_id" uuid NOT NULL,
	"proposer_author_user_id" uuid NOT NULL,
	"proposer_organization_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"abstract" text NOT NULL,
	"methodology" text NOT NULL,
	"expected_outcome" text NOT NULL,
	"timeline_months" integer NOT NULL,
	"status" "proposal_status" DEFAULT 'DRAFT' NOT NULL,
	"submitted_at" timestamp with time zone,
	"decided_by_user_id" uuid,
	"decision_reason" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "author_profile" ADD COLUMN "public_slug" varchar(160);--> statement-breakpoint
ALTER TABLE "case_origin" ADD COLUMN "recommendation_item_id" uuid;--> statement-breakpoint
ALTER TABLE "case_origin" ADD COLUMN "research_proposal_id" uuid;--> statement-breakpoint
ALTER TABLE "case_origin" ADD COLUMN "case_initiation_request_id" uuid;--> statement-breakpoint
ALTER TABLE "case_initiation_request" ADD CONSTRAINT "case_initiation_request_recommendation_item_id_recommendation_item_id_fk" FOREIGN KEY ("recommendation_item_id") REFERENCES "public"."recommendation_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_initiation_request" ADD CONSTRAINT "case_initiation_request_requesting_organization_id_organization_id_fk" FOREIGN KEY ("requesting_organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_initiation_request" ADD CONSTRAINT "case_initiation_request_requested_by_user_id_user_account_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_initiation_request" ADD CONSTRAINT "case_initiation_request_target_author_user_id_author_profile_user_id_fk" FOREIGN KEY ("target_author_user_id") REFERENCES "public"."author_profile"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_initiation_request" ADD CONSTRAINT "case_initiation_request_target_organization_id_organization_id_fk" FOREIGN KEY ("target_organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_initiation_request" ADD CONSTRAINT "case_initiation_request_responded_by_user_id_user_account_id_fk" FOREIGN KEY ("responded_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_profile" ADD CONSTRAINT "company_profile_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_profile" ADD CONSTRAINT "company_profile_contact_user_id_user_account_id_fk" FOREIGN KEY ("contact_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_statement_version" ADD CONSTRAINT "need_statement_version_research_need_id_research_need_id_fk" FOREIGN KEY ("research_need_id") REFERENCES "public"."research_need"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_statement_version" ADD CONSTRAINT "need_statement_version_created_by_user_id_user_account_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_citation" ADD CONSTRAINT "recommendation_citation_recommendation_item_id_recommendation_item_id_fk" FOREIGN KEY ("recommendation_item_id") REFERENCES "public"."recommendation_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_citation" ADD CONSTRAINT "recommendation_citation_citation_id_citation_id_fk" FOREIGN KEY ("citation_id") REFERENCES "public"."citation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_item" ADD CONSTRAINT "recommendation_item_recommendation_run_id_recommendation_run_id_fk" FOREIGN KEY ("recommendation_run_id") REFERENCES "public"."recommendation_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_item" ADD CONSTRAINT "recommendation_item_resource_version_id_resource_version_id_fk" FOREIGN KEY ("resource_version_id") REFERENCES "public"."resource_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_run" ADD CONSTRAINT "recommendation_run_research_need_id_research_need_id_fk" FOREIGN KEY ("research_need_id") REFERENCES "public"."research_need"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_run" ADD CONSTRAINT "recommendation_run_need_statement_version_id_need_statement_version_id_fk" FOREIGN KEY ("need_statement_version_id") REFERENCES "public"."need_statement_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_run" ADD CONSTRAINT "recommendation_run_company_organization_id_organization_id_fk" FOREIGN KEY ("company_organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_run" ADD CONSTRAINT "recommendation_run_requested_by_user_id_user_account_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_need" ADD CONSTRAINT "research_need_company_organization_id_organization_id_fk" FOREIGN KEY ("company_organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_need" ADD CONSTRAINT "research_need_created_by_user_id_user_account_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_proposal" ADD CONSTRAINT "research_proposal_research_need_id_research_need_id_fk" FOREIGN KEY ("research_need_id") REFERENCES "public"."research_need"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_proposal" ADD CONSTRAINT "research_proposal_need_statement_version_id_need_statement_version_id_fk" FOREIGN KEY ("need_statement_version_id") REFERENCES "public"."need_statement_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_proposal" ADD CONSTRAINT "research_proposal_proposer_author_user_id_author_profile_user_id_fk" FOREIGN KEY ("proposer_author_user_id") REFERENCES "public"."author_profile"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_proposal" ADD CONSTRAINT "research_proposal_proposer_organization_id_organization_id_fk" FOREIGN KEY ("proposer_organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_proposal" ADD CONSTRAINT "research_proposal_decided_by_user_id_user_account_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_case_initiation_target_author_status" ON "case_initiation_request" USING btree ("target_author_user_id","status");--> statement-breakpoint
CREATE INDEX "idx_case_initiation_requesting_org_status" ON "case_initiation_request" USING btree ("requesting_organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_need_statement_version_need_version_no" ON "need_statement_version" USING btree ("research_need_id","version_no");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_recommendation_citation_item_citation" ON "recommendation_citation" USING btree ("recommendation_item_id","citation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_recommendation_item_run_rank" ON "recommendation_item" USING btree ("recommendation_run_id","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_recommendation_item_run_resource_version" ON "recommendation_item" USING btree ("recommendation_run_id","resource_version_id");--> statement-breakpoint
CREATE INDEX "idx_recommendation_run_need_created" ON "recommendation_run" USING btree ("research_need_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_recommendation_run_status_created" ON "recommendation_run" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_recommendation_run_company_created" ON "recommendation_run" USING btree ("company_organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_research_need_org_status" ON "research_need" USING btree ("company_organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_research_need_visibility_status_published" ON "research_need" USING btree ("visibility","status","published_at");--> statement-breakpoint
CREATE INDEX "idx_research_proposal_need_status" ON "research_proposal" USING btree ("research_need_id","status");--> statement-breakpoint
CREATE INDEX "idx_research_proposal_author_status" ON "research_proposal" USING btree ("proposer_author_user_id","status");--> statement-breakpoint
ALTER TABLE "case_origin" ADD CONSTRAINT "case_origin_recommendation_item_id_recommendation_item_id_fk" FOREIGN KEY ("recommendation_item_id") REFERENCES "public"."recommendation_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_origin" ADD CONSTRAINT "case_origin_research_proposal_id_research_proposal_id_fk" FOREIGN KEY ("research_proposal_id") REFERENCES "public"."research_proposal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_origin" ADD CONSTRAINT "case_origin_case_initiation_request_id_case_initiation_request_id_fk" FOREIGN KEY ("case_initiation_request_id") REFERENCES "public"."case_initiation_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_profile" ADD CONSTRAINT "author_profile_public_slug_unique" UNIQUE("public_slug");