CREATE TYPE "public"."access_grant_status" AS ENUM('ACTIVE', 'EXPIRED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."access_permission" AS ENUM('VIEW', 'DOWNLOAD', 'MANAGE');--> statement-breakpoint
CREATE TYPE "public"."annotation_status" AS ENUM('ACTIVE', 'DEPRECATED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."author_verification_status" AS ENUM('UNVERIFIED', 'PENDING', 'VERIFIED', 'DECLINED', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."content_moderation_status" AS ENUM('ACTIVE', 'HIDDEN', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."ingestion_status" AS ENUM('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."resource_access_level" AS ENUM('PUBLIC', 'ORGANIZATION', 'CASE_ONLY', 'APPROVAL_REQUIRED', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "public"."resource_status" AS ENUM('DRAFT', 'ACTIVE', 'ARCHIVED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('PAPER', 'REPORT', 'DATASET', 'MODEL', 'CHECKPOINT', 'SOURCE_CODE', 'PATENT', 'LICENSE', 'ARCHITECTURE_DOCUMENT', 'EXPERIMENT_RESULT', 'PILOT_EVIDENCE', 'VIDEO', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."resource_version_status" AS ENUM('DRAFT', 'PUBLISHED', 'SUPERSEDED', 'WITHDRAWN');--> statement-breakpoint
CREATE TABLE "author_profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"current_affiliation_org_id" uuid,
	"orcid" varchar(50),
	"bio" text,
	"expertise_tags" text[],
	"verification_status" "author_verification_status" DEFAULT 'UNVERIFIED' NOT NULL,
	"verified_at" timestamp with time zone,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "author_profile_orcid_unique" UNIQUE("orcid")
);
--> statement-breakpoint
CREATE TABLE "author_verification_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_user_id" uuid NOT NULL,
	"affiliation_org_id" uuid NOT NULL,
	"status" "verification_request_status" DEFAULT 'PENDING' NOT NULL,
	"submitted_note" text,
	"reviewer_user_id" uuid,
	"reviewer_note" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "annotation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_version_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"status" "annotation_status" DEFAULT 'ACTIVE' NOT NULL,
	"moderation_status" "content_moderation_status" DEFAULT 'ACTIVE' NOT NULL,
	"latest_revision_no" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "annotation_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"annotation_id" uuid NOT NULL,
	"revision_no" integer NOT NULL,
	"content" text NOT NULL,
	"target_snippet" text NOT NULL,
	"page_number" integer,
	"section_label" varchar(255),
	"offset_start" integer,
	"offset_end" integer,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "citation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_version_id" uuid NOT NULL,
	"resource_chunk_id" uuid,
	"snippet" text NOT NULL,
	"page_number" integer,
	"section_label" varchar(255),
	"offset_start" integer,
	"offset_end" integer,
	"locator_metadata" jsonb,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paper_metadata" (
	"resource_id" uuid PRIMARY KEY NOT NULL,
	"doi" "citext",
	"abstract" text,
	"publisher" varchar(255),
	"venue" varchar(255),
	"publication_date" date,
	"language" varchar(20),
	CONSTRAINT "paper_metadata_doi_unique" UNIQUE("doi")
);
--> statement-breakpoint
CREATE TABLE "resource" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_organization_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"type" "resource_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"access_level" "resource_access_level" NOT NULL,
	"status" "resource_status" DEFAULT 'DRAFT' NOT NULL,
	"moderation_status" "content_moderation_status" DEFAULT 'ACTIVE' NOT NULL,
	"external_identifier" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_access_grant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"recipient_organization_id" uuid,
	"recipient_user_id" uuid,
	"permission" "access_permission" NOT NULL,
	"status" "access_grant_status" DEFAULT 'ACTIVE' NOT NULL,
	"granted_by_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_chunk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_version_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"page_number" integer,
	"section_label" varchar(255),
	"offset_start" integer,
	"offset_end" integer,
	"token_count" integer,
	"embedding" vector(1536),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_ingestion_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_version_id" uuid NOT NULL,
	"status" "ingestion_status" DEFAULT 'QUEUED' NOT NULL,
	"extractor_version" varchar(100),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_code" varchar(100),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"version_label" varchar(100),
	"source_url" text,
	"storage_object_key" text,
	"content_hash_sha256" varchar(64),
	"metadata" jsonb,
	"published_at" timestamp with time zone,
	"status" "resource_version_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verification_document" ALTER COLUMN "organization_verification_request_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "verification_document" ADD COLUMN "author_verification_request_id" uuid;--> statement-breakpoint
ALTER TABLE "author_profile" ADD CONSTRAINT "author_profile_user_id_user_account_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_profile" ADD CONSTRAINT "author_profile_current_affiliation_org_id_organization_id_fk" FOREIGN KEY ("current_affiliation_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_verification_request" ADD CONSTRAINT "author_verification_request_author_user_id_author_profile_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."author_profile"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_verification_request" ADD CONSTRAINT "author_verification_request_affiliation_org_id_organization_id_fk" FOREIGN KEY ("affiliation_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_verification_request" ADD CONSTRAINT "author_verification_request_reviewer_user_id_user_account_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotation" ADD CONSTRAINT "annotation_resource_version_id_resource_version_id_fk" FOREIGN KEY ("resource_version_id") REFERENCES "public"."resource_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotation" ADD CONSTRAINT "annotation_created_by_user_id_user_account_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotation_revision" ADD CONSTRAINT "annotation_revision_annotation_id_annotation_id_fk" FOREIGN KEY ("annotation_id") REFERENCES "public"."annotation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotation_revision" ADD CONSTRAINT "annotation_revision_created_by_user_id_user_account_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_resource_version_id_resource_version_id_fk" FOREIGN KEY ("resource_version_id") REFERENCES "public"."resource_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_resource_chunk_id_resource_chunk_id_fk" FOREIGN KEY ("resource_chunk_id") REFERENCES "public"."resource_chunk"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citation" ADD CONSTRAINT "citation_created_by_user_id_user_account_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_metadata" ADD CONSTRAINT "paper_metadata_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_owner_organization_id_organization_id_fk" FOREIGN KEY ("owner_organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource" ADD CONSTRAINT "resource_created_by_user_id_user_account_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_access_grant" ADD CONSTRAINT "resource_access_grant_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_access_grant" ADD CONSTRAINT "resource_access_grant_recipient_organization_id_organization_id_fk" FOREIGN KEY ("recipient_organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_access_grant" ADD CONSTRAINT "resource_access_grant_recipient_user_id_user_account_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_access_grant" ADD CONSTRAINT "resource_access_grant_granted_by_user_id_user_account_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_access_grant" ADD CONSTRAINT "resource_access_grant_revoked_by_user_id_user_account_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_chunk" ADD CONSTRAINT "resource_chunk_resource_version_id_resource_version_id_fk" FOREIGN KEY ("resource_version_id") REFERENCES "public"."resource_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_ingestion_job" ADD CONSTRAINT "resource_ingestion_job_resource_version_id_resource_version_id_fk" FOREIGN KEY ("resource_version_id") REFERENCES "public"."resource_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_version" ADD CONSTRAINT "resource_version_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_version" ADD CONSTRAINT "resource_version_created_by_user_id_user_account_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_author_verification_user_status" ON "author_verification_request" USING btree ("author_user_id","status");--> statement-breakpoint
CREATE INDEX "idx_author_verification_status_submitted" ON "author_verification_request" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "idx_annotation_resource_version_status" ON "annotation" USING btree ("resource_version_id","status");--> statement-breakpoint
CREATE INDEX "idx_annotation_created_by" ON "annotation" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_annotation_revision_annotation_revision_no" ON "annotation_revision" USING btree ("annotation_id","revision_no");--> statement-breakpoint
CREATE INDEX "idx_citation_resource_version" ON "citation" USING btree ("resource_version_id");--> statement-breakpoint
CREATE INDEX "idx_citation_resource_chunk" ON "citation" USING btree ("resource_chunk_id");--> statement-breakpoint
CREATE INDEX "idx_resource_owner_status" ON "resource" USING btree ("owner_organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_resource_type_status" ON "resource" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "idx_resource_external_identifier" ON "resource" USING btree ("external_identifier");--> statement-breakpoint
CREATE INDEX "idx_resource_access_grant_resource_status" ON "resource_access_grant" USING btree ("resource_id","status");--> statement-breakpoint
CREATE INDEX "idx_resource_access_grant_recipient_org" ON "resource_access_grant" USING btree ("recipient_organization_id");--> statement-breakpoint
CREATE INDEX "idx_resource_access_grant_recipient_user" ON "resource_access_grant" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_resource_chunk_version_index" ON "resource_chunk" USING btree ("resource_version_id","chunk_index");--> statement-breakpoint
CREATE INDEX "idx_resource_chunk_resource_version" ON "resource_chunk" USING btree ("resource_version_id");--> statement-breakpoint
CREATE INDEX "idx_resource_ingestion_job_status_created" ON "resource_ingestion_job" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_resource_ingestion_job_resource_version" ON "resource_ingestion_job" USING btree ("resource_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_resource_version_resource_version_no" ON "resource_version" USING btree ("resource_id","version_no");--> statement-breakpoint
CREATE INDEX "idx_resource_version_resource_status" ON "resource_version" USING btree ("resource_id","status");--> statement-breakpoint
CREATE INDEX "idx_resource_version_content_hash" ON "resource_version" USING btree ("content_hash_sha256");--> statement-breakpoint
ALTER TABLE "verification_document" ADD CONSTRAINT "verification_document_author_verification_request_id_author_verification_request_id_fk" FOREIGN KEY ("author_verification_request_id") REFERENCES "public"."author_verification_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_verification_document_author_request" ON "verification_document" USING btree ("author_verification_request_id");