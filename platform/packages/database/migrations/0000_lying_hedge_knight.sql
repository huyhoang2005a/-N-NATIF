CREATE TYPE "public"."identity_provider" AS ENUM('LOCAL', 'GOOGLE', 'MICROSOFT', 'ORCID', 'SAML');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('INVITED', 'ACTIVE', 'SUSPENDED', 'LEFT');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('UNREAD', 'READ', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."organization_member_role" AS ENUM('ORG_OWNER', 'ORG_ADMIN', 'MEMBER');--> statement-breakpoint
CREATE TYPE "public"."organization_status" AS ENUM('PENDING_VERIFICATION', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('RESEARCH_UNIT', 'ENTERPRISE', 'GOVERNMENT', 'SUPPORT_ORGANIZATION');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED', 'DEAD_LETTER');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('USER', 'PLATFORM_REVIEWER', 'PLATFORM_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');--> statement-breakpoint
CREATE TYPE "public"."verification_document_type" AS ENUM('IDENTITY_DOCUMENT', 'AFFILIATION_PROOF', 'ORGANIZATION_LETTER', 'TAX_DOCUMENT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."verification_request_status" AS ENUM('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "user_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"primary_email" "citext" NOT NULL,
	"platform_role" "platform_role" DEFAULT 'USER' NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "user_account_primary_email_unique" UNIQUE("primary_email")
);
--> statement-breakpoint
CREATE TABLE "user_identity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "identity_provider" NOT NULL,
	"provider_subject" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"phone" varchar(30),
	"avatar_url" text,
	"job_title" varchar(150),
	"locale" varchar(20) DEFAULT 'vi-VN',
	"timezone" varchar(50) DEFAULT 'Asia/Bangkok',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(160) NOT NULL,
	"type" "organization_type" NOT NULL,
	"status" "organization_status" DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	"website" text,
	"tax_code" varchar(100),
	"institution_identifier" varchar(150),
	"description" text,
	"primary_contact_user_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "organization_domain" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"domain" "citext" NOT NULL,
	"verification_token_hash" varchar(255),
	"verified_at" timestamp with time zone,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_domain_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "organization_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "organization_member_role" DEFAULT 'MEMBER' NOT NULL,
	"status" "membership_status" DEFAULT 'INVITED' NOT NULL,
	"invited_by_user_id" uuid,
	"invited_at" timestamp with time zone,
	"joined_at" timestamp with time zone,
	"left_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_verification_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"submitted_by_user_id" uuid NOT NULL,
	"status" "verification_request_status" DEFAULT 'PENDING' NOT NULL,
	"reviewer_user_id" uuid,
	"reviewer_note" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_verification_request_id" uuid NOT NULL,
	"document_type" "verification_document_type" NOT NULL,
	"storage_object_key" text NOT NULL,
	"original_filename" varchar(255),
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"checksum_sha256" varchar(64) NOT NULL,
	"encrypted" boolean DEFAULT true NOT NULL,
	"retention_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_user_id" uuid,
	"scope_organization_id" uuid,
	"request_id" uuid,
	"action" varchar(150) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" varchar(100) NOT NULL,
	"before_data" jsonb,
	"after_data" jsonb,
	"ip_hash" varchar(128),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" varchar(255) NOT NULL,
	"request_hash" varchar(128) NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"locked_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"scope_organization_id" uuid,
	"type" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"payload" jsonb,
	"status" "notification_status" DEFAULT 'UNREAD' NOT NULL,
	"dedupe_key" varchar(255),
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" varchar(100) NOT NULL,
	"aggregate_id" varchar(100) NOT NULL,
	"event_type" varchar(150) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'PENDING' NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_identity" ADD CONSTRAINT "user_identity_user_id_user_account_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_account_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_primary_contact_user_id_user_account_id_fk" FOREIGN KEY ("primary_contact_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_created_by_user_id_user_account_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_domain" ADD CONSTRAINT "organization_domain_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_user_id_user_account_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_invited_by_user_id_user_account_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_verification_request" ADD CONSTRAINT "organization_verification_request_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_verification_request" ADD CONSTRAINT "organization_verification_request_submitted_by_user_id_user_account_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_verification_request" ADD CONSTRAINT "organization_verification_request_reviewer_user_id_user_account_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_document" ADD CONSTRAINT "verification_document_organization_verification_request_id_organization_verification_request_id_fk" FOREIGN KEY ("organization_verification_request_id") REFERENCES "public"."organization_verification_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_user_account_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_scope_organization_id_organization_id_fk" FOREIGN KEY ("scope_organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_user_id_user_account_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_user_id_user_account_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_scope_organization_id_organization_id_fk" FOREIGN KEY ("scope_organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_account_status" ON "user_account" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_account_platform_role" ON "user_account" USING btree ("platform_role");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_identity_provider_subject" ON "user_identity" USING btree ("provider","provider_subject");--> statement-breakpoint
CREATE INDEX "idx_user_identity_user_id" ON "user_identity" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_organization_name_type" ON "organization" USING btree ("name","type");--> statement-breakpoint
CREATE INDEX "idx_organization_status" ON "organization" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_organization_tax_code" ON "organization" USING btree ("tax_code");--> statement-breakpoint
CREATE INDEX "idx_organization_domain_org_id" ON "organization_domain" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_organization_member_org_user" ON "organization_member" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_organization_member_user_status" ON "organization_member" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_organization_member_org_role_status" ON "organization_member" USING btree ("organization_id","role","status");--> statement-breakpoint
CREATE INDEX "idx_org_verification_org_status" ON "organization_verification_request" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "idx_org_verification_status_submitted" ON "organization_verification_request" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "idx_verification_document_org_request" ON "verification_document" USING btree ("organization_verification_request_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_entity" ON "audit_log" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_actor_created" ON "audit_log" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_request_id" ON "audit_log" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_idempotency_key_user_key" ON "idempotency_key" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "idx_idempotency_key_expires_at" ON "idempotency_key" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_notification_recipient_status_created" ON "notification" USING btree ("recipient_user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_scope_org_created" ON "notification" USING btree ("scope_organization_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_dedupe_key" ON "notification" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "idx_outbox_status_available" ON "outbox_event" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "idx_outbox_aggregate" ON "outbox_event" USING btree ("aggregate_type","aggregate_id");