import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { userAccount } from "./identity";
import { citation } from "./resource";
import { evidence, technologyCase } from "./technology-case";
import {
  assessmentStatusEnum,
  frameworkStatusEnum,
  gapSeverityEnum,
  gapStatusEnum,
} from "./enums";

export const assessmentFramework = pgTable(
  "assessment_framework",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 100 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    versionNo: integer("version_no").notNull(),
    description: text("description"),
    status: frameworkStatusEnum("status").notNull().default("DRAFT"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("uq_assessment_framework_code_version").on(table.code, table.versionNo),
    index("idx_assessment_framework_status").on(table.status),
  ],
);

export const assessmentCriterion = pgTable(
  "assessment_criterion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    frameworkId: uuid("framework_id")
      .notNull()
      .references(() => assessmentFramework.id),
    categoryCode: varchar("category_code", { length: 100 }).notNull(),
    criterionCode: varchar("criterion_code", { length: 100 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    guidance: text("guidance"),
    minScore: numeric("min_score", { precision: 8, scale: 2 }).notNull().default("0"),
    maxScore: numeric("max_score", { precision: 8, scale: 2 }).notNull(),
    weight: numeric("weight", { precision: 8, scale: 4 }).notNull().default("1"),
    requiresEvidence: boolean("requires_evidence").notNull().default(true),
    requiresCitation: boolean("requires_citation").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [
    uniqueIndex("uq_assessment_criterion_framework_code").on(table.frameworkId, table.criterionCode),
    index("idx_assessment_criterion_framework_category_sort").on(
      table.frameworkId,
      table.categoryCode,
      table.sortOrder,
    ),
  ],
);

export const readinessAssessment = pgTable(
  "readiness_assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technologyCaseId: uuid("technology_case_id")
      .notNull()
      .references(() => technologyCase.id),
    frameworkId: uuid("framework_id")
      .notNull()
      .references(() => assessmentFramework.id),
    status: assessmentStatusEnum("status").notNull().default("DRAFT"),
    compositeScore: numeric("composite_score", { precision: 10, scale: 4 }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    submittedByUserId: uuid("submitted_by_user_id").references(() => userAccount.id),
    approvedByUserId: uuid("approved_by_user_id").references(() => userAccount.id),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("idx_readiness_assessment_case_status").on(table.technologyCaseId, table.status),
    index("idx_readiness_assessment_framework").on(table.frameworkId),
  ],
);

export const assessmentScore = pgTable(
  "assessment_score",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => readinessAssessment.id),
    criterionId: uuid("criterion_id")
      .notNull()
      .references(() => assessmentCriterion.id),
    score: numeric("score", { precision: 8, scale: 2 }).notNull(),
    rationale: text("rationale").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    updatedByUserId: uuid("updated_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("uq_assessment_score_assessment_criterion").on(table.assessmentId, table.criterionId)],
);

export const assessmentScoreEvidence = pgTable(
  "assessment_score_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentScoreId: uuid("assessment_score_id")
      .notNull()
      .references(() => assessmentScore.id),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => evidence.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_assessment_score_evidence_score_evidence").on(table.assessmentScoreId, table.evidenceId),
  ],
);

export const assessmentScoreCitation = pgTable(
  "assessment_score_citation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentScoreId: uuid("assessment_score_id")
      .notNull()
      .references(() => assessmentScore.id),
    citationId: uuid("citation_id")
      .notNull()
      .references(() => citation.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_assessment_score_citation_score_citation").on(table.assessmentScoreId, table.citationId),
  ],
);

export const gapRecord = pgTable(
  "gap_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technologyCaseId: uuid("technology_case_id")
      .notNull()
      .references(() => technologyCase.id),
    sourceAssessmentId: uuid("source_assessment_id").references(() => readinessAssessment.id),
    sourceAssessmentScoreId: uuid("source_assessment_score_id").references(() => assessmentScore.id),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    category: varchar("category", { length: 120 }),
    severity: gapSeverityEnum("severity").notNull(),
    status: gapStatusEnum("status").notNull().default("OPEN"),
    ownerUserId: uuid("owner_user_id").references(() => userAccount.id),
    dueDate: date("due_date"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => userAccount.id),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => userAccount.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("idx_gap_record_case_status_severity").on(table.technologyCaseId, table.status, table.severity),
    index("idx_gap_record_owner").on(table.ownerUserId),
  ],
);

export const gapEvidence = pgTable(
  "gap_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gapRecordId: uuid("gap_record_id")
      .notNull()
      .references(() => gapRecord.id),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => evidence.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("uq_gap_evidence_gap_evidence").on(table.gapRecordId, table.evidenceId)],
);

export const gapCitation = pgTable(
  "gap_citation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gapRecordId: uuid("gap_record_id")
      .notNull()
      .references(() => gapRecord.id),
    citationId: uuid("citation_id")
      .notNull()
      .references(() => citation.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("uq_gap_citation_gap_citation").on(table.gapRecordId, table.citationId)],
);
