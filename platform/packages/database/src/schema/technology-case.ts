import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { userAccount } from "./identity";
import { organization } from "./organization";
import { annotation, citation, resourceVersion } from "./resource";
import {
  caseMemberRoleEnum,
  caseOrganizationRoleEnum,
  caseOriginTypeEnum,
  contentModerationStatusEnum,
  evidenceStatusEnum,
  membershipStatusEnum,
  technologyCaseStatusEnum,
  visibilityLevelEnum,
} from "./enums";

export const technologyCase = pgTable(
  "technology_case",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    owningOrganizationId: uuid("owning_organization_id")
      .notNull()
      .references(() => organization.id),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    description: text("description"),
    lifecycleStatus: technologyCaseStatusEnum("lifecycle_status").notNull().default("DRAFT"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("uq_technology_case_owning_org_slug").on(table.owningOrganizationId, table.slug),
    index("idx_technology_case_owning_org_status").on(table.owningOrganizationId, table.lifecycleStatus),
  ],
);

/** `recommendation_item_id` / `research_proposal_id` / `case_initiation_request_id`
 * (Phase 5 "Discovery & Recommendation" FKs) omitted — those tables don't exist yet.
 * Phase 3 only ever creates `origin_type = MANUAL`. Added additively in Phase 5, same
 * pattern as `resource_access_grant.source_transfer_manifest_id` in Phase 2. */
export const caseOrigin = pgTable("case_origin", {
  technologyCaseId: uuid("technology_case_id")
    .primaryKey()
    .references(() => technologyCase.id),
  originType: caseOriginTypeEnum("origin_type").notNull(),
  importedSourceReference: text("imported_source_reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const technologyProfile = pgTable("technology_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  technologyCaseId: uuid("technology_case_id")
    .notNull()
    .unique()
    .references(() => technologyCase.id),
  summary: text("summary"),
  valueProposition: text("value_proposition"),
  targetMarket: text("target_market"),
  maturityLevel: varchar("maturity_level", { length: 100 }),
  deploymentContext: text("deployment_context"),
  licensingNotes: text("licensing_notes"),
  visibility: visibilityLevelEnum("visibility").notNull().default("PRIVATE"),
  moderationStatus: contentModerationStatusEnum("moderation_status").notNull().default("ACTIVE"),
  updatedByUserId: uuid("updated_by_user_id")
    .notNull()
    .references(() => userAccount.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
});

export const caseOrganization = pgTable(
  "case_organization",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technologyCaseId: uuid("technology_case_id")
      .notNull()
      .references(() => technologyCase.id),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id),
    role: caseOrganizationRoleEnum("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("uq_case_organization_case_org_role").on(
      table.technologyCaseId,
      table.organizationId,
      table.role,
    ),
    index("idx_case_organization_org_role").on(table.organizationId, table.role),
  ],
);

export const caseMember = pgTable(
  "case_member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technologyCaseId: uuid("technology_case_id")
      .notNull()
      .references(() => technologyCase.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => userAccount.id),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id),
    role: caseMemberRoleEnum("role").notNull(),
    status: membershipStatusEnum("status").notNull().default("ACTIVE"),
    invitedByUserId: uuid("invited_by_user_id").references(() => userAccount.id),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_case_member_case_user").on(table.technologyCaseId, table.userId),
    index("idx_case_member_case_role_status").on(table.technologyCaseId, table.role, table.status),
    index("idx_case_member_user_status").on(table.userId, table.status),
  ],
);

export const caseStatusHistory = pgTable(
  "case_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technologyCaseId: uuid("technology_case_id")
      .notNull()
      .references(() => technologyCase.id),
    fromStatus: technologyCaseStatusEnum("from_status"),
    toStatus: technologyCaseStatusEnum("to_status").notNull(),
    changedByUserId: uuid("changed_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_case_status_history_case_created").on(table.technologyCaseId, table.createdAt)],
);

export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technologyCaseId: uuid("technology_case_id")
      .notNull()
      .references(() => technologyCase.id),
    resourceVersionId: uuid("resource_version_id")
      .notNull()
      .references(() => resourceVersion.id),
    annotationId: uuid("annotation_id").references(() => annotation.id),
    title: varchar("title", { length: 255 }).notNull(),
    claim: text("claim").notNull(),
    relevanceNote: text("relevance_note").notNull(),
    status: evidenceStatusEnum("status").notNull().default("ACTIVE"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("idx_evidence_case_status").on(table.technologyCaseId, table.status),
    index("idx_evidence_resource_version").on(table.resourceVersionId),
  ],
);

export const evidenceCitation = pgTable(
  "evidence_citation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => evidence.id),
    citationId: uuid("citation_id")
      .notNull()
      .references(() => citation.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("uq_evidence_citation_evidence_citation").on(table.evidenceId, table.citationId)],
);
