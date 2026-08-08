import { decimal, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { authorProfile } from "./author";
import {
  caseInitiationStatusEnum,
  proposalStatusEnum,
  recommendationItemStatusEnum,
  recommendationRunStatusEnum,
  recommendationRunTypeEnum,
  researchNeedStatusEnum,
  visibilityLevelEnum,
} from "./enums";
import { userAccount } from "./identity";
import { organization } from "./organization";
import { citation, resourceVersion } from "./resource";

export const companyProfile = pgTable("company_profile", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organization.id),
  publicSlug: varchar("public_slug", { length: 160 }).notNull().unique(),
  industryCode: varchar("industry_code", { length: 100 }),
  companySize: varchar("company_size", { length: 50 }),
  description: text("description"),
  contactUserId: uuid("contact_user_id").references(() => userAccount.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const researchNeed = pgTable(
  "research_need",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyOrganizationId: uuid("company_organization_id")
      .notNull()
      .references(() => organization.id),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    title: varchar("title", { length: 200 }).notNull(),
    visibility: visibilityLevelEnum("visibility").notNull().default("PRIVATE"),
    status: researchNeedStatusEnum("status").notNull().default("DRAFT"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("idx_research_need_org_status").on(table.companyOrganizationId, table.status),
    index("idx_research_need_visibility_status_published").on(table.visibility, table.status, table.publishedAt),
  ],
);

export const needStatementVersion = pgTable(
  "need_statement_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    researchNeedId: uuid("research_need_id")
      .notNull()
      .references(() => researchNeed.id),
    versionNo: integer("version_no").notNull(),
    problemStatement: text("problem_statement").notNull(),
    technicalField: varchar("technical_field", { length: 150 }).notNull(),
    desiredOutputType: varchar("desired_output_type", { length: 100 }).notNull(),
    timeframeMonths: integer("timeframe_months"),
    constraints: text("constraints"),
    successCriteria: text("success_criteria"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("uq_need_statement_version_need_version_no").on(table.researchNeedId, table.versionNo)],
);

export const researchProposal = pgTable(
  "research_proposal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    researchNeedId: uuid("research_need_id")
      .notNull()
      .references(() => researchNeed.id),
    needStatementVersionId: uuid("need_statement_version_id")
      .notNull()
      .references(() => needStatementVersion.id),
    proposerAuthorUserId: uuid("proposer_author_user_id")
      .notNull()
      .references(() => authorProfile.userId),
    proposerOrganizationId: uuid("proposer_organization_id")
      .notNull()
      .references(() => organization.id),
    title: varchar("title", { length: 200 }).notNull(),
    abstract: text("abstract").notNull(),
    methodology: text("methodology").notNull(),
    expectedOutcome: text("expected_outcome").notNull(),
    timelineMonths: integer("timeline_months").notNull(),
    status: proposalStatusEnum("status").notNull().default("DRAFT"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    decidedByUserId: uuid("decided_by_user_id").references(() => userAccount.id),
    decisionReason: text("decision_reason"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("idx_research_proposal_need_status").on(table.researchNeedId, table.status),
    index("idx_research_proposal_author_status").on(table.proposerAuthorUserId, table.status),
  ],
);

/** `research_need_id`/`need_statement_version_id` nullable + `company_organization_id` +
 * `run_type` implement the Feed extension (Sprint 5.5) from day one — this table has no
 * prior Drizzle implementation to migrate, so the FEED-ready shape is written directly
 * instead of a create-then-alter dance. Matching CHECK constraint
 * (`chk_recommendation_run_context_matches_type`) lives in a manual migration, same
 * technique as `verification_document`'s "exactly one request FK" constraint. */
export const recommendationRun = pgTable(
  "recommendation_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    researchNeedId: uuid("research_need_id").references(() => researchNeed.id),
    needStatementVersionId: uuid("need_statement_version_id").references(() => needStatementVersion.id),
    companyOrganizationId: uuid("company_organization_id").references(() => organization.id),
    runType: recommendationRunTypeEnum("run_type").notNull().default("FOCUSED"),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    status: recommendationRunStatusEnum("status").notNull().default("QUEUED"),
    modelProvider: varchar("model_provider", { length: 100 }),
    modelName: varchar("model_name", { length: 150 }),
    promptVersion: varchar("prompt_version", { length: 100 }),
    modelParameters: jsonb("model_parameters"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorCode: varchar("error_code", { length: 100 }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_recommendation_run_need_created").on(table.researchNeedId, table.createdAt),
    index("idx_recommendation_run_status_created").on(table.status, table.createdAt),
    // Not in the original dbml — needed to efficiently find "the org's latest COMPLETED
    // FEED run" (Sprint 5.5 step 18). Additive index, no business-rule invention.
    index("idx_recommendation_run_company_created").on(table.companyOrganizationId, table.createdAt),
  ],
);

export const recommendationItem = pgTable(
  "recommendation_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recommendationRunId: uuid("recommendation_run_id")
      .notNull()
      .references(() => recommendationRun.id),
    resourceVersionId: uuid("resource_version_id")
      .notNull()
      .references(() => resourceVersion.id),
    rank: integer("rank").notNull(),
    matchScore: decimal("match_score", { precision: 6, scale: 5 }).notNull(),
    rationale: text("rationale").notNull(),
    status: recommendationItemStatusEnum("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_recommendation_item_run_rank").on(table.recommendationRunId, table.rank),
    uniqueIndex("uq_recommendation_item_run_resource_version").on(table.recommendationRunId, table.resourceVersionId),
  ],
);

export const recommendationCitation = pgTable(
  "recommendation_citation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recommendationItemId: uuid("recommendation_item_id")
      .notNull()
      .references(() => recommendationItem.id),
    citationId: uuid("citation_id")
      .notNull()
      .references(() => citation.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("uq_recommendation_citation_item_citation").on(table.recommendationItemId, table.citationId)],
);

export const caseInitiationRequest = pgTable(
  "case_initiation_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recommendationItemId: uuid("recommendation_item_id")
      .notNull()
      .references(() => recommendationItem.id),
    requestingOrganizationId: uuid("requesting_organization_id")
      .notNull()
      .references(() => organization.id),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    targetAuthorUserId: uuid("target_author_user_id")
      .notNull()
      .references(() => authorProfile.userId),
    targetOrganizationId: uuid("target_organization_id")
      .notNull()
      .references(() => organization.id),
    status: caseInitiationStatusEnum("status").notNull().default("PENDING"),
    message: text("message"),
    responseNote: text("response_note"),
    respondedByUserId: uuid("responded_by_user_id").references(() => userAccount.id),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("idx_case_initiation_target_author_status").on(table.targetAuthorUserId, table.status),
    index("idx_case_initiation_requesting_org_status").on(table.requestingOrganizationId, table.status),
  ],
);
