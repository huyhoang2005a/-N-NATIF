CREATE TYPE "public"."assessment_status" AS ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "public"."dependency_type" AS ENUM('FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH', 'START_TO_FINISH');--> statement-breakpoint
CREATE TYPE "public"."framework_status" AS ENUM('DRAFT', 'ACTIVE', 'RETIRED');--> statement-breakpoint
CREATE TYPE "public"."gap_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."gap_status" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'ACCEPTED_RISK', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."priority_level" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."roadmap_review_decision" AS ENUM('APPROVED', 'REJECTED', 'CHANGES_REQUESTED');--> statement-breakpoint
CREATE TYPE "public"."roadmap_status" AS ENUM('DRAFT', 'IN_REVIEW', 'APPROVED', 'ACTIVE', 'COMPLETED', 'REJECTED', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "assessment_criterion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework_id" uuid NOT NULL,
	"category_code" varchar(100) NOT NULL,
	"criterion_code" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"guidance" text,
	"min_score" numeric(8, 2) DEFAULT '0' NOT NULL,
	"max_score" numeric(8, 2) NOT NULL,
	"weight" numeric(8, 4) DEFAULT '1' NOT NULL,
	"requires_evidence" boolean DEFAULT true NOT NULL,
	"requires_citation" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_framework" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"version_no" integer NOT NULL,
	"description" text,
	"status" "framework_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	"retired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "assessment_score" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"criterion_id" uuid NOT NULL,
	"score" numeric(8, 2) NOT NULL,
	"rationale" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_score_citation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_score_id" uuid NOT NULL,
	"citation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_score_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_score_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gap_citation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gap_record_id" uuid NOT NULL,
	"citation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gap_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gap_record_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gap_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technology_case_id" uuid NOT NULL,
	"source_assessment_id" uuid,
	"source_assessment_score_id" uuid,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(120),
	"severity" "gap_severity" NOT NULL,
	"status" "gap_status" DEFAULT 'OPEN' NOT NULL,
	"owner_user_id" uuid,
	"due_date" date,
	"created_by_user_id" uuid NOT NULL,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "readiness_assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technology_case_id" uuid NOT NULL,
	"framework_id" uuid NOT NULL,
	"status" "assessment_status" DEFAULT 'DRAFT' NOT NULL,
	"composite_score" numeric(10, 4),
	"created_by_user_id" uuid NOT NULL,
	"submitted_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestone_dependency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"predecessor_milestone_id" uuid NOT NULL,
	"successor_milestone_id" uuid NOT NULL,
	"dependency_type" "dependency_type" DEFAULT 'FINISH_TO_START' NOT NULL,
	"lag_days" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestone_gap" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milestone_id" uuid NOT NULL,
	"gap_record_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmap" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technology_case_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"objective" text,
	"status" "roadmap_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"submitted_by_user_id" uuid,
	"approved_by_user_id" uuid,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmap_milestone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roadmap_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "milestone_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"priority" "priority_level" DEFAULT 'MEDIUM' NOT NULL,
	"start_date" date,
	"due_date" date,
	"owner_user_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmap_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roadmap_id" uuid NOT NULL,
	"reviewer_user_id" uuid NOT NULL,
	"decision" "roadmap_review_decision" NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmap_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"milestone_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'TODO' NOT NULL,
	"priority" "priority_level" DEFAULT 'MEDIUM' NOT NULL,
	"assignee_user_id" uuid,
	"start_date" date,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessment_criterion" ADD CONSTRAINT "assessment_criterion_framework_id_assessment_framework_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."assessment_framework"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_framework" ADD CONSTRAINT "assessment_framework_created_by_user_id_user_account_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_score" ADD CONSTRAINT "assessment_score_assessment_id_readiness_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."readiness_assessment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_score" ADD CONSTRAINT "assessment_score_criterion_id_assessment_criterion_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."assessment_criterion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_score" ADD CONSTRAINT "assessment_score_created_by_user_id_user_account_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_score" ADD CONSTRAINT "assessment_score_updated_by_user_id_user_account_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_score_citation" ADD CONSTRAINT "assessment_score_citation_assessment_score_id_assessment_score_id_fk" FOREIGN KEY ("assessment_score_id") REFERENCES "public"."assessment_score"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_score_citation" ADD CONSTRAINT "assessment_score_citation_citation_id_citation_id_fk" FOREIGN KEY ("citation_id") REFERENCES "public"."citation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_score_evidence" ADD CONSTRAINT "assessment_score_evidence_assessment_score_id_assessment_score_id_fk" FOREIGN KEY ("assessment_score_id") REFERENCES "public"."assessment_score"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_score_evidence" ADD CONSTRAINT "assessment_score_evidence_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gap_citation" ADD CONSTRAINT "gap_citation_gap_record_id_gap_record_id_fk" FOREIGN KEY ("gap_record_id") REFERENCES "public"."gap_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gap_citation" ADD CONSTRAINT "gap_citation_citation_id_citation_id_fk" FOREIGN KEY ("citation_id") REFERENCES "public"."citation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gap_evidence" ADD CONSTRAINT "gap_evidence_gap_record_id_gap_record_id_fk" FOREIGN KEY ("gap_record_id") REFERENCES "public"."gap_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gap_evidence" ADD CONSTRAINT "gap_evidence_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gap_record" ADD CONSTRAINT "gap_record_technology_case_id_technology_case_id_fk" FOREIGN KEY ("technology_case_id") REFERENCES "public"."technology_case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gap_record" ADD CONSTRAINT "gap_record_source_assessment_id_readiness_assessment_id_fk" FOREIGN KEY ("source_assessment_id") REFERENCES "public"."readiness_assessment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gap_record" ADD CONSTRAINT "gap_record_source_assessment_score_id_assessment_score_id_fk" FOREIGN KEY ("source_assessment_score_id") REFERENCES "public"."assessment_score"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gap_record" ADD CONSTRAINT "gap_record_owner_user_id_user_account_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gap_record" ADD CONSTRAINT "gap_record_created_by_user_id_user_account_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gap_record" ADD CONSTRAINT "gap_record_resolved_by_user_id_user_account_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_assessment" ADD CONSTRAINT "readiness_assessment_technology_case_id_technology_case_id_fk" FOREIGN KEY ("technology_case_id") REFERENCES "public"."technology_case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_assessment" ADD CONSTRAINT "readiness_assessment_framework_id_assessment_framework_id_fk" FOREIGN KEY ("framework_id") REFERENCES "public"."assessment_framework"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_assessment" ADD CONSTRAINT "readiness_assessment_created_by_user_id_user_account_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_assessment" ADD CONSTRAINT "readiness_assessment_submitted_by_user_id_user_account_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_assessment" ADD CONSTRAINT "readiness_assessment_approved_by_user_id_user_account_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_dependency" ADD CONSTRAINT "milestone_dependency_predecessor_milestone_id_roadmap_milestone_id_fk" FOREIGN KEY ("predecessor_milestone_id") REFERENCES "public"."roadmap_milestone"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_dependency" ADD CONSTRAINT "milestone_dependency_successor_milestone_id_roadmap_milestone_id_fk" FOREIGN KEY ("successor_milestone_id") REFERENCES "public"."roadmap_milestone"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_gap" ADD CONSTRAINT "milestone_gap_milestone_id_roadmap_milestone_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."roadmap_milestone"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_gap" ADD CONSTRAINT "milestone_gap_gap_record_id_gap_record_id_fk" FOREIGN KEY ("gap_record_id") REFERENCES "public"."gap_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap" ADD CONSTRAINT "roadmap_technology_case_id_technology_case_id_fk" FOREIGN KEY ("technology_case_id") REFERENCES "public"."technology_case"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap" ADD CONSTRAINT "roadmap_created_by_user_id_user_account_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap" ADD CONSTRAINT "roadmap_submitted_by_user_id_user_account_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap" ADD CONSTRAINT "roadmap_approved_by_user_id_user_account_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_milestone" ADD CONSTRAINT "roadmap_milestone_roadmap_id_roadmap_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmap"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_milestone" ADD CONSTRAINT "roadmap_milestone_owner_user_id_user_account_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_review" ADD CONSTRAINT "roadmap_review_roadmap_id_roadmap_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmap"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_review" ADD CONSTRAINT "roadmap_review_reviewer_user_id_user_account_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_task" ADD CONSTRAINT "roadmap_task_milestone_id_roadmap_milestone_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."roadmap_milestone"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_task" ADD CONSTRAINT "roadmap_task_assignee_user_id_user_account_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."user_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_assessment_criterion_framework_code" ON "assessment_criterion" USING btree ("framework_id","criterion_code");--> statement-breakpoint
CREATE INDEX "idx_assessment_criterion_framework_category_sort" ON "assessment_criterion" USING btree ("framework_id","category_code","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_assessment_framework_code_version" ON "assessment_framework" USING btree ("code","version_no");--> statement-breakpoint
CREATE INDEX "idx_assessment_framework_status" ON "assessment_framework" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_assessment_score_assessment_criterion" ON "assessment_score" USING btree ("assessment_id","criterion_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_assessment_score_citation_score_citation" ON "assessment_score_citation" USING btree ("assessment_score_id","citation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_assessment_score_evidence_score_evidence" ON "assessment_score_evidence" USING btree ("assessment_score_id","evidence_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_gap_citation_gap_citation" ON "gap_citation" USING btree ("gap_record_id","citation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_gap_evidence_gap_evidence" ON "gap_evidence" USING btree ("gap_record_id","evidence_id");--> statement-breakpoint
CREATE INDEX "idx_gap_record_case_status_severity" ON "gap_record" USING btree ("technology_case_id","status","severity");--> statement-breakpoint
CREATE INDEX "idx_gap_record_owner" ON "gap_record" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "idx_readiness_assessment_case_status" ON "readiness_assessment" USING btree ("technology_case_id","status");--> statement-breakpoint
CREATE INDEX "idx_readiness_assessment_framework" ON "readiness_assessment" USING btree ("framework_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_milestone_dependency_predecessor_successor" ON "milestone_dependency" USING btree ("predecessor_milestone_id","successor_milestone_id");--> statement-breakpoint
CREATE INDEX "idx_milestone_dependency_successor" ON "milestone_dependency" USING btree ("successor_milestone_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_milestone_gap_milestone_gap" ON "milestone_gap" USING btree ("milestone_id","gap_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_roadmap_case_version" ON "roadmap" USING btree ("technology_case_id","version_no");--> statement-breakpoint
CREATE INDEX "idx_roadmap_case_status" ON "roadmap" USING btree ("technology_case_id","status");--> statement-breakpoint
CREATE INDEX "idx_roadmap_milestone_roadmap_sort" ON "roadmap_milestone" USING btree ("roadmap_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_roadmap_milestone_roadmap_status" ON "roadmap_milestone" USING btree ("roadmap_id","status");--> statement-breakpoint
CREATE INDEX "idx_roadmap_review_roadmap_created" ON "roadmap_review" USING btree ("roadmap_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_roadmap_task_milestone_sort" ON "roadmap_task" USING btree ("milestone_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_roadmap_task_assignee_status" ON "roadmap_task" USING btree ("assignee_user_id","status");